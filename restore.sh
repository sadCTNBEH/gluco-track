#!/usr/bin/env bash
# ==============================================================================
# GlucoTrack Pro — Скрипт безопасного восстановления базы данных из бэкапа (SEC-07)
# ==============================================================================

set -euo pipefail
umask 077

export TZ="Europe/Moscow"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${DATA_DIR:-$SCRIPT_DIR/data}"
DEFAULT_DB_FILE="$DATA_DIR/glucotrack.db"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S MSK')] $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S MSK')] ОШИБКА: $1" >&2
}

if [ $# -lt 1 ]; then
    echo "Использование: $0 <файл_бэкапа.db[.enc]> [путь_к_целевой_бд]"
    echo ""
    echo "Примеры:"
    echo "  $0 backups/glucotrack_backup_20261102_000000.db"
    echo "  $0 backups/glucotrack_backup_20261102_000000.db.enc"
    echo "  $0 backups/glucotrack_latest_backup.db"
    echo "  BACKUP_ENCRYPTION_KEY='...' $0 backups/glucotrack_backup_20261102_000000.db.enc"
    exit 1
fi

BACKUP_SRC="$1"
TARGET_DB="${2:-$DEFAULT_DB_FILE}"

if [ ! -f "$BACKUP_SRC" ]; then
    log_error "Файл резервной копии '$BACKUP_SRC' не найден!"
    exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
    log_error "Утилита 'sqlite3' не найдена в системе. Установите sqlite3 для проверки и восстановления базы данных."
    exit 1
fi

TARGET_DIR="$(dirname "$TARGET_DB")"
mkdir -p "$TARGET_DIR"
chmod 700 "$TARGET_DIR"

TMP_WORK="$TARGET_DIR/.tmp_restore_work_$$.db"
TMP_PRE_RESTORE="$TARGET_DIR/glucotrack.db.pre_restore_$(date '+%Y%m%d_%H%M%S')"

cleanup() {
    rm -f "$TMP_WORK" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

log "Подготовка к восстановлению базы данных из '$BACKUP_SRC' в '$TARGET_DB'..."

IS_ENCRYPTED=false
if [[ "$BACKUP_SRC" == *.enc ]]; then
    IS_ENCRYPTED=true
fi

if [ "$IS_ENCRYPTED" = true ]; then
    log "Обнаружен зашифрованный бэкап. Проверка ключа расшифровки..."
    if ! command -v openssl >/dev/null 2>&1; then
        log_error "Утилита 'openssl' не найдена в системе. Расшифровка невозможна."
        exit 1
    fi

    PASSPHRASE=""
    if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        PASSPHRASE="$BACKUP_ENCRYPTION_KEY"
    elif [ -n "${BACKUP_ENCRYPTION_KEY_FILE:-}" ] && [ -f "$BACKUP_ENCRYPTION_KEY_FILE" ]; then
        PASSPHRASE=$(cat "$BACKUP_ENCRYPTION_KEY_FILE")
    else
        log_error "Ключ расшифровки не задан. Укажите ключ через BACKUP_ENCRYPTION_KEY или BACKUP_ENCRYPTION_KEY_FILE."
        exit 1
    fi

    log "Расшифровка резервной копии (AES-256-CBC с PBKDF2)..."
    if ! openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "$BACKUP_SRC" -out "$TMP_WORK" -pass "pass:$PASSPHRASE"; then
        log_error "Не удалось расшифровать файл бэкапа (неверный ключ или поврежденный файл)."
        exit 1
    fi
else
    # Незашифрованный бэкап: создаем временную копию для проверки
    cp -f "$BACKUP_SRC" "$TMP_WORK"
fi

chmod 600 "$TMP_WORK"

# Проверка целостности восстанавливаемой базы данных
log "Проверка целостности восстанавливаемого файла (PRAGMA integrity_check)..."
INTEGRITY_CHECK=$(sqlite3 "$TMP_WORK" "PRAGMA integrity_check;" 2>&1 || true)
if [ "$INTEGRITY_CHECK" != "ok" ]; then
    log_error "Восстанавливаемая база данных повреждена (PRAGMA integrity_check = $INTEGRITY_CHECK). Восстановление отменено!"
    exit 1
fi
log "Проверка целостности успешно пройдена (PRAGMA integrity_check = ok)."

# Если целевая БД уже существует, создаем защитный снимок перед заменой (SEC-07 Req 7)
if [ -f "$TARGET_DB" ]; then
    log "Создание защитного снимка текущей базы данных перед заменой ($TMP_PRE_RESTORE)..."
    cp -f "$TARGET_DB" "$TMP_PRE_RESTORE"
    chmod 600 "$TMP_PRE_RESTORE"
fi

# Атомарное перемещение проверенного бэкапа на место целевой БД (SEC-07 Req 5)
mv -f "$TMP_WORK" "$TARGET_DB"
chmod 600 "$TARGET_DB"

# Удаляем устаревшие WAL-файлы целевой базы, если они остались от предыдущего состояния
rm -f "${TARGET_DB}-wal" "${TARGET_DB}-shm" 2>/dev/null || true

SIZE=$(du -h "$TARGET_DB" | cut -f1)
log "Успешно: База данных восстановлена в '$TARGET_DB' (размер: $SIZE)."
log "Рекомендация: Перезапустите приложение (docker compose restart) для применения восстановленных данных."
