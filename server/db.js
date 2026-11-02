import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const defaultDataDir = path.resolve('./data');
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');

// Защита от случайного запуска тестов с рабочей/production директорией (REQ-4, REQ-8)
const isTestRunning =
  process.env.NODE_ENV === 'test' ||
  (process.execArgv && process.execArgv.includes('--test')) ||
  (process.argv && process.argv.some((arg) => arg.includes('.test.') || arg === '--test'));

const isProductionDataDir =
  !process.env.DATA_DIR ||
  DATA_DIR === defaultDataDir ||
  DATA_DIR.startsWith(defaultDataDir + path.sep);

if (isTestRunning && isProductionDataDir) {
  throw new Error(
    'КРИТИЧЕСКАЯ ОШИБКА БЕЗОПАСНОСТИ: Запуск тестов с рабочей директорией ./data категорически запрещен! ' +
    'Укажите изолированный временный DATA_DIR перед запуском тестов.'
  );
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'glucotrack.db');
export const db = new DatabaseSync(DB_PATH);

/**
 * Безопасное закрытие базы данных для освобождения файловых дескрипторов (для тестов и graceful shutdown)
 */
export function closeDb(database = db) {
  try {
    database.close();
  } catch {}
}

/**
 * Идемпотентная и атомарная миграция таблицы sessions (SEC-04).
 * Переводит хранение токенов с открытого вида на SHA-256 хеши,
 * добавляет last_activity_at и сохраняет все действующие сессии.
 */
export function migrateSessionsTable(database = db) {
  // Проверяем существование таблицы sessions
  const tableCheck = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'")
    .get();

  if (!tableCheck) {
    // Таблица еще не создана — создаем сразу в новой схеме с token_hash и last_activity_at
    database.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_activity ON sessions(last_activity_at);
    `);
    return;
  }

  // Проверяем существующие колонки таблицы sessions
  const columns = database.prepare('PRAGMA table_info(sessions)').all();
  const columnNames = new Set(columns.map((c) => c.name));

  // Если схема уже обновлена (есть token_hash и last_activity_at) — гарантируем наличие индексов и выходим (идемпотентность)
  if (columnNames.has('token_hash') && columnNames.has('last_activity_at')) {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_activity ON sessions(last_activity_at);
    `);
    return;
  }

  // Атомарная миграция таблицы sessions
  database.exec('BEGIN TRANSACTION');
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS sessions_new (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Если в старой таблице была колонка token (открытый токен):
    if (columnNames.has('token')) {
      const now = Date.now();
      // Выбираем только еще не истекшие сессии
      const oldSessions = database
        .prepare('SELECT token, user_id, created_at, expires_at FROM sessions WHERE expires_at > ?')
        .all(now);

      const insertStmt = database.prepare(`
        INSERT OR IGNORE INTO sessions_new (token_hash, user_id, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const s of oldSessions) {
        if (!s.token) continue;
        const tokenHash = crypto.createHash('sha256').update(s.token).digest('hex');
        const lastActivity = s.created_at || now;
        insertStmt.run(tokenHash, s.user_id, s.created_at, s.expires_at, lastActivity);
      }
    }

    // Заменяем старую таблицу новой
    database.exec('DROP TABLE sessions');
    database.exec('ALTER TABLE sessions_new RENAME TO sessions');

    // Пересоздаем индексы
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_activity ON sessions(last_activity_at);
    `);

    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    console.error('Ошибка миграции таблицы sessions:', err);
    throw err;
  }
}

/**
 * Идемпотентная и атомарная миграция таблицы entries (SEC-12).
 * Переводит первичный ключ на составной: PRIMARY KEY (user_id, id),
 * полностью исключая коллизии ID между разными пользователями при сохранении всех медицинских записей.
 */
export function migrateEntriesTable(database = db) {
  const tableCheck = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'entries'")
    .get();

  if (!tableCheck) {
    // Таблица еще не создана — создаем сразу с составным первичным ключом PRIMARY KEY (user_id, id)
    database.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        glucose REAL,
        carbs REAL,
        xe REAL,
        rin_fast REAL,
        tresiba REAL,
        calories REAL,
        notes TEXT,
        tag TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_entries_user_date_time ON entries(user_id, date DESC, time ASC);
      DROP INDEX IF EXISTS idx_entries_user_id;
      DROP INDEX IF EXISTS idx_entries_user_date;
    `);
    return;
  }

  // Проверяем существующие колонки и их primary key статус в таблице entries
  const columns = database.prepare('PRAGMA table_info(entries)').all();
  const userIdCol = columns.find((c) => c.name === 'user_id');
  const idCol = columns.find((c) => c.name === 'id');

  // Если оба поля входят в составной первичный ключ (pk > 0 для user_id и id) — таблица уже обновлена (идемпотентность)
  if (userIdCol && userIdCol.pk > 0 && idCol && idCol.pk > 0) {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_entries_user_date_time ON entries(user_id, date DESC, time ASC);
      DROP INDEX IF EXISTS idx_entries_user_id;
      DROP INDEX IF EXISTS idx_entries_user_date;
    `);
    return;
  }

  // Атомарная миграция таблицы entries на составной первичный ключ
  database.exec('BEGIN TRANSACTION');
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS entries_new (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        glucose REAL,
        carbs REAL,
        xe REAL,
        rin_fast REAL,
        tresiba REAL,
        calories REAL,
        notes TEXT,
        tag TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Переносим все существующие записи
    database.exec(`
      INSERT OR IGNORE INTO entries_new (
        id, user_id, date, time, glucose, carbs, xe, rin_fast, tresiba, calories, notes, tag, created_at
      )
      SELECT id, user_id, date, time, glucose, carbs, xe, rin_fast, tresiba, calories, notes, tag, created_at
      FROM entries;
    `);

    database.exec('DROP TABLE entries');
    database.exec('ALTER TABLE entries_new RENAME TO entries');

    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_entries_user_date_time ON entries(user_id, date DESC, time ASC);
      DROP INDEX IF EXISTS idx_entries_user_id;
      DROP INDEX IF EXISTS idx_entries_user_date;
    `);

    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    console.error('Ошибка миграции таблицы entries:', err);
    throw err;
  }
}

// Настройка SQLite: WAL-режим для скорости и безопасности, внешние ключи, таймаут ожидания блокировок
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY,
    settings_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS entries (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    glucose REAL,
    carbs REAL,
    xe REAL,
    rin_fast REAL,
    tresiba REAL,
    calories REAL,
    notes TEXT,
    tag TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_entries_user_date_time ON entries(user_id, date DESC, time ASC);
  DROP INDEX IF EXISTS idx_entries_user_id;
  DROP INDEX IF EXISTS idx_entries_user_date;
`);

// Запуск миграций сессий и записей для рабочей базы данных
migrateSessionsTable(db);
migrateEntriesTable(db);
