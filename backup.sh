#!/usr/bin/env bash
# ==============================================================================
# GlucoTrack Pro — Скрипт создания резервной копии базы данных SQLite (SEC-07)
# Расписание: ежедневно в 00:00 по московскому времени (MSK / UTC+3)
# ==============================================================================

set -euo pipefail
umask 077

# Принудительно устанавливаем часовой пояс Москвы для логов и временных меток (SEC-07 Req 10)
export TZ="Europe/Moscow"

# Определяем абсолютный путь к каталогу проекта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DATA_DIR:-$SCRIPT_DIR/data}"
DB_FILE="${DB_FILE:-$DATA_DIR/glucotrack.db}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
LOG_FILE="$BACKUP_DIR/backup.log"
LOCK_FILE="$BACKUP_DIR/.backup.lock"
MAX_BACKUPS="${MAX_BACKUPS:-30}"

# Создаем директорию для бэкапов с правами 0700 (SEC-07 Req 8)
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S MSK')] $1"
    echo "$msg"
    if [ ! -f "$LOG_FILE" ]; then
        touch "$LOG_FILE"
        chmod 600 "$LOG_FILE"
    fi
    echo "$msg" >> "$LOG_FILE"
}

log_error() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S MSK')] ОШИБКА: $1"
    echo "$msg" >&2
    if [ ! -f "$LOG_FILE" ]; then
        touch "$LOG_FILE"
        chmod 600 "$LOG_FILE"
    fi
    echo "$msg" >> "$LOG_FILE"
}

# --- ЗАЩИТА ОТ ОДНОВРЕМЕННОГО ЗАПУСКА (SEC-07 Req 11) ---
LOCK_ACQUIRED=false

acquire_lock() {
    if command -v flock >/dev/null 2>&1; then
        exec 200>"$LOCK_FILE"
        if ! flock -n 200; then
            log_error "Другой экземпляр backup.sh уже выполняется (файл блокировки $LOCK_FILE занят). Завершение работы."
            exit 1
        fi
        LOCK_ACQUIRED=true
    else
        local lockdir="${LOCK_FILE}.dir"
        if ! mkdir "$lockdir" 2>/dev/null; then
            log_error "Другой экземпляр backup.sh уже выполняется (каталог блокировки $lockdir занят). Завершение работы."
            exit 1
        fi
        LOCK_ACQUIRED=true
    fi
}

release_lock() {
    if [ "$LOCK_ACQUIRED" = true ]; then
        if command -v flock >/dev/null 2>&1; then
            flock -u 200 2>/dev/null || true
            rm -f "$LOCK_FILE" 2>/dev/null || true
        else
            rmdir "${LOCK_FILE}.dir" 2>/dev/null || true
        fi
        LOCK_ACQUIRED=false
    fi
}

# --- ОЧИСТКА ВРЕМЕННЫХ ФАЙЛОВ ПРИ СБОЕ (SEC-07 Req 5, 7) ---
TMP_FILES=()

register_tmp() {
    TMP_FILES+=("$1")
}

cleanup() {
    local exit_code=$?
    for f in "${TMP_FILES[@]}"; do
        if [ -n "$f" ] && [ -f "$f" ]; then
            rm -f "$f" 2>/dev/null || true
        fi
    done
    release_lock
    if [ $exit_code -ne 0 ]; then
        log_error "Процесс резервного копирования завершился с кодом $exit_code. Предыдущие бэкапы сохранены без изменений."
    fi
}
trap cleanup EXIT INT TERM

# --- ПРОВЕРКА ИНСТРУМЕНТОВ (SEC-07 Req 1, 2) ---
if ! command -v sqlite3 >/dev/null 2>&1; then
    log_error "Утилита 'sqlite3' не найдена в системе. Небезопасный fallback через 'cp' запрещен из-за риска повреждения WAL-журнала. Установите sqlite3 (например: apt-get install -y sqlite3 или apk add sqlite) и повторите попытку."
    exit 1
fi

acquire_lock

if [ ! -f "$DB_FILE" ]; then
    log "ВНИМАНИЕ: Файл базы данных $DB_FILE еще не существует. Проверьте запуск приложения."
    exit 0
fi

if [ ! -r "$DB_FILE" ]; then
    log_error "Файл базы данных $DB_FILE недоступен для чтения (проверьте права доступа и владельца файла)."
    exit 1
fi

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
TMP_BACKUP="$BACKUP_DIR/.tmp_glucotrack_${TIMESTAMP}_$$.db"
TMP_ENC="$BACKUP_DIR/.tmp_glucotrack_${TIMESTAMP}_$$.db.enc"
register_tmp "$TMP_BACKUP"
register_tmp "$TMP_ENC"

log "Запуск резервного копирования базы данных ($DB_FILE)..."

# --- СОЗДАНИЕ ГОРЯЧЕГО БЭКАПА ЧЕРЕЗ ONLINE BACKUP API (SEC-07 Req 1) ---
# .backup создает согласованный снимок БД, включая все незафиксированные транзакции из WAL-журнала
if ! sqlite3 "$DB_FILE" ".backup '$TMP_BACKUP'"; then
    log_error "Не удалось создать резервную копию через SQLite Online Backup API (.backup)."
    exit 1
fi

chmod 600 "$TMP_BACKUP"

# --- ПРОВЕРКА ЦЕЛОСТНОСТИ БЭКАПА (SEC-07 Req 6) ---
log "Проверка целостности созданного снимка (PRAGMA integrity_check)..."
INTEGRITY_CHECK=$(sqlite3 "$TMP_BACKUP" "PRAGMA integrity_check;" 2>&1 || true)
if [ "$INTEGRITY_CHECK" != "ok" ]; then
    log_error "Проверка целостности созданного бэкапа завершилась ошибкой: $INTEGRITY_CHECK. Бэкап отменен, существующие копии не затронуты."
    exit 1
fi
log "Проверка целостности успешно пройдена (PRAGMA integrity_check = ok)."

# --- ШИФРОВАНИЕ БЭКАПА (SEC-07 Req 9) ---
ENCRYPTION_ENABLED=false
PASSPHRASE=""

if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    ENCRYPTION_ENABLED=true
    PASSPHRASE="$BACKUP_ENCRYPTION_KEY"
elif [ -n "${BACKUP_ENCRYPTION_KEY_FILE:-}" ]; then
    if [ ! -f "$BACKUP_ENCRYPTION_KEY_FILE" ]; then
        log_error "Указанный файл ключа шифрования '$BACKUP_ENCRYPTION_KEY_FILE' не существует. Запрещен скрытый fallback на незашифрованные копии!"
        exit 1
    fi
    if [ ! -r "$BACKUP_ENCRYPTION_KEY_FILE" ]; then
        log_error "Файл ключа шифрования '$BACKUP_ENCRYPTION_KEY_FILE' недоступен для чтения."
        exit 1
    fi
    PASSPHRASE=$(cat "$BACKUP_ENCRYPTION_KEY_FILE")
    if [ -z "$PASSPHRASE" ]; then
        log_error "Файл ключа шифрования '$BACKUP_ENCRYPTION_KEY_FILE' пуст. Запрещен скрытый fallback на незашифрованные копии!"
        exit 1
    fi
    ENCRYPTION_ENABLED=true
elif [ "${REQUIRE_ENCRYPTION:-false}" = "true" ] || [ "${REQUIRE_ENCRYPTION:-0}" = "1" ]; then
    log_error "Включен флаг обязательного шифрования REQUIRE_ENCRYPTION, но ключ не задан (BACKUP_ENCRYPTION_KEY или BACKUP_ENCRYPTION_KEY_FILE)."
    exit 1
fi

FINAL_BACKUP=""

if [ "$ENCRYPTION_ENABLED" = true ]; then
    if ! command -v openssl >/dev/null 2>&1; then
        log_error "Утилита 'openssl' не найдена в системе, шифрование невозможно. Скрытый fallback на незашифрованные копии запрещен!"
        exit 1
    fi

    log "Шифрование резервной копии (AES-256-CBC с PBKDF2)..."
    if ! openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "$TMP_BACKUP" -out "$TMP_ENC" -pass "pass:$PASSPHRASE"; then
        log_error "Ошибка при выполнении шифрования через openssl. Бэкап отменен."
        exit 1
    fi

    chmod 600 "$TMP_ENC"
    FINAL_BACKUP="$BACKUP_DIR/glucotrack_backup_${TIMESTAMP}.db.enc"

    # Атомарная публикация зашифрованного файла (SEC-07 Req 5)
    mv -f "$TMP_ENC" "$FINAL_BACKUP"
    rm -f "$TMP_BACKUP"
    log "Шифрование успешно завершено (файл: $(basename "$FINAL_BACKUP"))."
else
    FINAL_BACKUP="$BACKUP_DIR/glucotrack_backup_${TIMESTAMP}.db"
    # Атомарная публикация незашифрованного файла (SEC-07 Req 5)
    mv -f "$TMP_BACKUP" "$FINAL_BACKUP"
    log "Инфо: Ключ шифрования не настроен. Резервная копия сохранена с правами 0600 (файл: $(basename "$FINAL_BACKUP"))."
fi

chmod 600 "$FINAL_BACKUP"

# Обновляем безопасную симлинк-ссылку glucotrack_latest_backup
LATEST_LINK="$BACKUP_DIR/glucotrack_latest_backup"
if [ "$ENCRYPTION_ENABLED" = true ]; then
    ln -sf "$(basename "$FINAL_BACKUP")" "${LATEST_LINK}.db.enc"
else
    ln -sf "$(basename "$FINAL_BACKUP")" "${LATEST_LINK}.db"
fi

SIZE=$(du -h "$FINAL_BACKUP" | cut -f1)
log "Успешно: Резервная копия создана и проверена ($FINAL_BACKUP, размер: $SIZE)."

# --- РОТАЦИЯ: ХРАНЕНИЕ ПОСЛЕДНИХ 30 ЕЖЕДНЕВНЫХ КОПИЙ (SEC-07 Req 4) ---
# Находим все регулярные бэкапы (как зашифрованные, так и незашифрованные), сортируем по имени (метка YYYYMMDD_HHMMSS)
mapfile -t ALL_BACKUPS < <(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "glucotrack_backup_*.db" -o -name "glucotrack_backup_*.db.enc" \) | sort)

TOTAL_COUNT=${#ALL_BACKUPS[@]}
log "Всего резервных копий в хранилище: $TOTAL_COUNT (лимит ротации: $MAX_BACKUPS)."

if [ "$TOTAL_COUNT" -gt "$MAX_BACKUPS" ]; then
    EXCESS=$((TOTAL_COUNT - MAX_BACKUPS))
    log "Выполняется ротация: удаление $EXCESS устаревших резервных копий..."
    for (( i=0; i<EXCESS; i++ )); do
        OLD_BACKUP="${ALL_BACKUPS[$i]}"
        if [ -f "$OLD_BACKUP" ]; then
            rm -f "$OLD_BACKUP"
            log "Ротация: удален устаревший бэкап $(basename "$OLD_BACKUP")."
        fi
    done
fi

log "Процесс резервного копирования успешно завершен."
