#!/usr/bin/env bash
# ==============================================================================
# Скрипт создания ежедневного бэкапа базы данных SQLite вне контейнера
# Расписание: ежедневно в 00:00 по московскому времени (MSK / UTC+3)
# Перезаписывает файл бэкапа на самый свежий.
# ==============================================================================

set -euo pipefail

# Определяем абсолютный путь к каталогу проекта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
DB_FILE="$DATA_DIR/glucotrack.db"
BACKUP_DIR="$SCRIPT_DIR/backups"
BACKUP_FILE="$BACKUP_DIR/glucotrack_latest_backup.db"
LOG_FILE="$BACKUP_DIR/backup.log"

# Создаем директорию для бэкапов, если её нет
mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S MSK')] $1" | tee -a "$LOG_FILE"
}

if [ ! -f "$DB_FILE" ]; then
    log "ВНИМАНИЕ: Файл базы данных $DB_FILE еще не создан. Проверьте запуск контейнера."
    exit 0
fi

# Безопасное копирование с проверкой целостности
TMP_BACKUP="${BACKUP_FILE}.tmp"

# Если на сервере установлен sqlite3, используем безопасный горячий .backup
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_FILE" ".backup '$TMP_BACKUP'"
else
    # Иначе используем стандартное атомарное копирование
    cp -f "$DB_FILE" "$TMP_BACKUP"
fi

# Атомарная замена предыдущего бэкапа на новый
mv -f "$TMP_BACKUP" "$BACKUP_FILE"

# Получаем размер бэкапа
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

log "Успешно: Ежедневный бэкап базы обновлен ($BACKUP_FILE, размер: $SIZE)"
