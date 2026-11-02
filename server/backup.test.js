import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const BASH_PATH = 'C:/Program Files/Git/bin/bash.exe';
const HAS_BASH = fs.existsSync(BASH_PATH);

// Создаем изолированные временные каталоги для тестов (SEC-07: не трогать production-данные)
const TEST_ROOT = path.resolve('test_sandbox_sec07');
const TEST_DATA_DIR = path.join(TEST_ROOT, 'data');
const TEST_BACKUP_DIR = path.join(TEST_ROOT, 'backups');
const TEST_BIN_DIR = path.join(TEST_ROOT, 'bin');
const TEST_DB_FILE = path.join(TEST_DATA_DIR, 'test_glucotrack.db');

function setupTestEnvironment() {
  if (fs.existsSync(TEST_ROOT)) {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });
  fs.mkdirSync(TEST_BIN_DIR, { recursive: true });

  // Создаем js-хелпер для эмуляции sqlite3 CLI через Node.js DatabaseSync
  const helperJsPath = path.join(TEST_BIN_DIR, 'sqlite3_helper.cjs');
  const helperContent = `const { DatabaseSync } = require('node:sqlite');
const dbPath = process.argv[2];
const cmd = process.argv[3];

if (!cmd) process.exit(0);

if (cmd.includes('.backup')) {
  const match = cmd.match(/\\.backup\\s+['"]?([^'"]+)['"]?/);
  if (match) {
    const target = match[1];
    const db = new DatabaseSync(dbPath, { readOnly: true });
    db.exec(\`VACUUM INTO '\${target.replace(/\\\\/g, '/')}'\`);
    db.close();
  }
} else if (cmd.includes('integrity_check')) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const row = db.prepare('PRAGMA integrity_check').get();
  console.log(row.integrity_check);
  db.close();
} else {
  const db = new DatabaseSync(dbPath);
  db.exec(cmd);
  db.close();
}
`;
  fs.writeFileSync(helperJsPath, helperContent);

  const sqlite3Wrapper = `#!/usr/bin/env bash
node "${helperJsPath.replace(/\\/g, '/')}" "$@"
`;
  const sqliteBinPath = path.join(TEST_BIN_DIR, 'sqlite3');
  fs.writeFileSync(sqliteBinPath, sqlite3Wrapper, { mode: 0o755 });
}

function cleanupTestEnvironment() {
  if (fs.existsSync(TEST_ROOT)) {
    for (let i = 0; i < 10; i++) {
      try {
        fs.rmSync(TEST_ROOT, { recursive: true, force: true });
        break;
      } catch {
        const start = Date.now();
        while (Date.now() - start < 100) {}
      }
    }
  }
}

function runBashScript(scriptPath, env = {}, args = []) {
  const normBin = TEST_BIN_DIR.replace(/\\/g, '/');
  const existingPath = process.env.PATH || '';
  const mergedPath = `${normBin}:${existingPath}`;

  const bashScript = scriptPath.replace(/\\/g, '/');
  const commandArgs = [bashScript, ...args];

  try {
    const stdout = cp.execFileSync(BASH_PATH, commandArgs, {
      env: {
        ...process.env,
        PATH: mergedPath,
        DATA_DIR: TEST_DATA_DIR.replace(/\\/g, '/'),
        DB_FILE: TEST_DB_FILE.replace(/\\/g, '/'),
        BACKUP_DIR: TEST_BACKUP_DIR.replace(/\\/g, '/'),
        TZ: 'Europe/Moscow',
        ...env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { status: 0, stdout: stdout.toString(), stderr: '' };
  } catch (err) {
    return {
      status: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : err.message,
    };
  }
}

test('SEC-07: Отсутствие sqlite3 завершается ошибкой (код 1) без небезопасного fallback на cp', { skip: !HAS_BASH }, () => {
  setupTestEnvironment();
  try {
    // Создаем тестовую БД
    const db = new DatabaseSync(TEST_DB_FILE);
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY);');
    db.close();

    // Запускаем backup.sh с PATH БЕЗ sqlite3 (исключаем TEST_BIN_DIR)
    const res = runBashScript(path.resolve('backup.sh'), {
      PATH: 'C:/Program Files/Git/usr/bin;C:/Program Files/Git/bin', // без sqlite3
    });

    assert.notEqual(res.status, 0, 'Скрипт должен завершаться с ненулевым кодом при отсутствии sqlite3');
    const output = res.stderr + res.stdout;
    assert.match(
      output,
      /sqlite3.*не найдена.*Небезопасный fallback через.*cp.*запрещен/i,
      'Сообщение должно указывать на запрет fallback через cp и требовать sqlite3'
    );

    // Убеждаемся, что резервная копия НЕ была создана через cp
    const files = fs.readdirSync(TEST_BACKUP_DIR).filter((f) => f.endsWith('.db'));
    assert.equal(files.length, 0, 'Не должно быть создано ни одного бэкапа');
  } finally {
    cleanupTestEnvironment();
  }
});

test('SEC-07: Создание согласованного бэкапа в SQLite WAL-режиме с проверкой PRAGMA integrity_check', { skip: !HAS_BASH }, () => {
  setupTestEnvironment();
  let db = null;
  try {
    // 1. Создаем рабочую БД в WAL-режиме
    db = new DatabaseSync(TEST_DB_FILE);
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE entries (id TEXT PRIMARY KEY, glucose REAL, notes TEXT);
      INSERT INTO entries VALUES ('entry-1', 5.5, 'Завтрак');
      INSERT INTO entries VALUES ('entry-2', 7.2, 'Обед');
    `);

    // 2. Выполняем backup.sh
    const res = runBashScript(path.resolve('backup.sh'));
    if (res.status !== 0) {
      console.error('backup.sh stdout:', res.stdout);
      console.error('backup.sh stderr:', res.stderr);
    }
    assert.equal(res.status, 0, `backup.sh должен успешно выполниться. stderr: ${res.stderr}, stdout: ${res.stdout}`);

    // Проверяем логи
    const logContent = fs.readFileSync(path.join(TEST_BACKUP_DIR, 'backup.log'), 'utf-8');
    assert.match(logContent, /PRAGMA integrity_check = ok/, 'Лог должен подтверждать успешную проверку integrity_check');
    assert.match(logContent, /Успешно: Резервная копия создана и проверена/, 'Лог должен фиксировать успешное создание');

    // Проверяем созданный файл бэкапа
    const backupFiles = fs.readdirSync(TEST_BACKUP_DIR).filter((f) => f.startsWith('glucotrack_backup_') && f.endsWith('.db'));
    assert.equal(backupFiles.length, 1, 'Должен быть создан ровно один файл бэкапа с датой/временем');

    const backupFilePath = path.join(TEST_BACKUP_DIR, backupFiles[0]);
    assert.ok(backupFiles[0].match(/^glucotrack_backup_\d{8}_\d{6}\.db$/), 'Имя файла должно содержать дату и время YYYYMMDD_HHMMSS');

    // Проверяем симлинк latest
    assert.ok(fs.existsSync(path.join(TEST_BACKUP_DIR, 'glucotrack_latest_backup.db')), 'Симлинк latest должен существовать');

    // Проверяем данные в бэкапе
    const bDb = new DatabaseSync(backupFilePath, { readOnly: true });
    const rows = bDb.prepare('SELECT * FROM entries ORDER BY id').all();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].glucose, 5.5);
    assert.equal(rows[1].glucose, 7.2);
    bDb.close();
  } finally {
    if (db) db.close();
    cleanupTestEnvironment();
  }
});

test('SEC-07: Восстановление из бэкапа через restore.sh в отдельную тестовую БД', { skip: !HAS_BASH }, () => {
  setupTestEnvironment();
  try {
    // 1. Создаем исходную БД и бэкап
    const db = new DatabaseSync(TEST_DB_FILE);
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE patients (id TEXT PRIMARY KEY, name TEXT);
      INSERT INTO patients VALUES ('p1', 'Иванов Иван');
    `);
    db.close();

    const backupRes = runBashScript(path.resolve('backup.sh'));
    assert.equal(backupRes.status, 0);

    const backupFile = fs.readdirSync(TEST_BACKUP_DIR).find((f) => f.startsWith('glucotrack_backup_') && f.endsWith('.db'));
    assert.ok(backupFile);
    const backupPath = path.join(TEST_BACKUP_DIR, backupFile).replace(/\\/g, '/');

    // 2. Восстанавливаем в ОТДЕЛЬНУЮ тестовую БД
    const targetRestoredDb = path.join(TEST_DATA_DIR, 'restored_test.db').replace(/\\/g, '/');
    const restoreRes = runBashScript(path.resolve('restore.sh'), {}, [backupPath, targetRestoredDb]);
    assert.equal(restoreRes.status, 0, `restore.sh должен успешно выполниться: ${restoreRes.stderr}`);

    // Проверяем восстановленные данные
    const rDb = new DatabaseSync(targetRestoredDb, { readOnly: true });
    const check = rDb.prepare('PRAGMA integrity_check').get();
    assert.equal(check.integrity_check, 'ok');
    const patients = rDb.prepare('SELECT * FROM patients').all();
    assert.equal(patients.length, 1);
    assert.equal(patients[0].name, 'Иванов Иван');
    rDb.close();
  } finally {
    cleanupTestEnvironment();
  }
});

test('SEC-07: Шифрование AES-256-CBC PBKDF2: создание .enc, отказ при неверном ключе и безопасная расшифровка', { skip: !HAS_BASH }, () => {
  setupTestEnvironment();
  try {
    const db = new DatabaseSync(TEST_DB_FILE);
    db.exec(`
      CREATE TABLE secure_records (id INTEGER PRIMARY KEY, secret TEXT);
      INSERT INTO secure_records VALUES (1, 'medical-secret-12345');
    `);
    db.close();

    const SECRET_KEY = 'ClinicalPassphrase2026!StrictSecret';

    // 1. Создание зашифрованного бэкапа
    const backupRes = runBashScript(path.resolve('backup.sh'), {
      BACKUP_ENCRYPTION_KEY: SECRET_KEY,
    });
    assert.equal(backupRes.status, 0, `Бэкап с шифрованием должен пройти успешно: ${backupRes.stderr}`);

    const encFiles = fs.readdirSync(TEST_BACKUP_DIR).filter((f) => f.startsWith('glucotrack_backup_') && f.endsWith('.db.enc'));
    assert.equal(encFiles.length, 1, 'Должен быть создан файл с расширением .db.enc');

    const encFilePath = path.join(TEST_BACKUP_DIR, encFiles[0]);
    const fileBytes = fs.readFileSync(encFilePath);

    // Зашифрованный файл не должен содержать сигнатуру SQLite в открытом виде
    assert.equal(fileBytes.slice(0, 15).toString('utf-8').includes('SQLite format 3'), false, 'Зашифрованный файл не должен содержать открытый заголовок SQLite');

    // Незашифрованный временный .db должен быть удален
    const plainFiles = fs.readdirSync(TEST_BACKUP_DIR).filter((f) => f.startsWith('glucotrack_backup_') && f.endsWith('.db'));
    assert.equal(plainFiles.length, 0, 'Незашифрованный бэкап не должен оставаться при включенном шифровании');

    // 2. Попытка восстановления с НЕВЕРНЫМ ключом должна провалиться
    const failTarget = path.join(TEST_DATA_DIR, 'should_fail.db').replace(/\\/g, '/');
    const failRestore = runBashScript(
      path.resolve('restore.sh'),
      { BACKUP_ENCRYPTION_KEY: 'WrongKey12345' },
      [encFilePath.replace(/\\/g, '/'), failTarget]
    );
    assert.notEqual(failRestore.status, 0, 'Восстановление с неверным ключом должно отклоняться');
    assert.equal(fs.existsSync(failTarget), false, 'Целевая БД не должна создаваться при ошибке расшифровки');

    // 3. Успешное восстановление с ПРАВИЛЬНЫМ ключом
    const successTarget = path.join(TEST_DATA_DIR, 'decrypted_restored.db').replace(/\\/g, '/');
    const successRestore = runBashScript(
      path.resolve('restore.sh'),
      { BACKUP_ENCRYPTION_KEY: SECRET_KEY },
      [encFilePath.replace(/\\/g, '/'), successTarget]
    );
    assert.equal(successRestore.status, 0, `Восстановление с правильным ключом должно пройти успешно: ${successRestore.stderr}`);

    const sDb = new DatabaseSync(successTarget, { readOnly: true });
    const row = sDb.prepare('SELECT secret FROM secure_records WHERE id = 1').get();
    assert.equal(row.secret, 'medical-secret-12345');
    sDb.close();
  } finally {
    cleanupTestEnvironment();
  }
});

test('SEC-07: Запрет скрытого fallback на незашифрованные копии при сбое настройки ключа', { skip: !HAS_BASH }, () => {
  setupTestEnvironment();
  try {
    const db = new DatabaseSync(TEST_DB_FILE);
    db.exec('CREATE TABLE dummy (id INT);');
    db.close();

    // Задаем несуществующий файл ключа шифрования
    const res = runBashScript(path.resolve('backup.sh'), {
      BACKUP_ENCRYPTION_KEY_FILE: '/non/existent/secret.key',
    });

    assert.notEqual(res.status, 0, 'Скрипт должен завершаться с ошибкой, если файл ключа не существует');
    assert.match(
      res.stderr + res.stdout,
      /Запрещен скрытый fallback на незашифрованные копии/i,
      'Должно быть явное сообщение о запрете fallback на незашифрованные копии'
    );

    // Никаких копий не должно быть создано
    const backups = fs.readdirSync(TEST_BACKUP_DIR).filter((f) => f.includes('glucotrack_backup_'));
    assert.equal(backups.length, 0);
  } finally {
    cleanupTestEnvironment();
  }
});

test('SEC-07: Безопасная ротация: сохранение ровно последних 30 ежедневных копий при превышении лимита', { skip: !HAS_BASH }, () => {
  setupTestEnvironment();
  try {
    const db = new DatabaseSync(TEST_DB_FILE);
    db.exec('CREATE TABLE test_rot (id INT);');
    db.close();

    // Создаем 35 искусственных архивных копий с датами от 2026-09-01 до 2026-10-05
    for (let day = 1; day <= 35; day++) {
      const dayStr = String(day).padStart(2, '0');
      const filename = `glucotrack_backup_202609${dayStr}_000000.db`;
      fs.writeFileSync(path.join(TEST_BACKUP_DIR, filename), 'dummy backup content');
    }

    assert.equal(
      fs.readdirSync(TEST_BACKUP_DIR).filter((f) => f.startsWith('glucotrack_backup_')).length,
      35
    );

    // Выполняем backup.sh (создаст 36-й бэкап и выполнит ротацию до 30)
    const res = runBashScript(path.resolve('backup.sh'));
    assert.equal(res.status, 0);

    const remaining = fs
      .readdirSync(TEST_BACKUP_DIR)
      .filter((f) => f.startsWith('glucotrack_backup_') && f.endsWith('.db'))
      .sort();

    assert.equal(remaining.length, 30, 'После ротации должно остаться ровно 30 резервных копий');

    // Самые старые файлы (20260901 - 20260906) должны быть удалены
    assert.equal(remaining.includes('glucotrack_backup_20260901_000000.db'), false);
    assert.equal(remaining.includes('glucotrack_backup_20260906_000000.db'), false);

    // Более новые файлы должны сохраниться
    assert.ok(remaining.includes('glucotrack_backup_20260907_000000.db'));
    assert.ok(remaining.includes('glucotrack_backup_20260935_000000.db'));
  } finally {
    cleanupTestEnvironment();
  }
});

test('SEC-07: Сохранность предыдущих копий и исходной БД при любой ошибке процесса бэкапа', { skip: !HAS_BASH }, () => {
  setupTestEnvironment();
  try {
    // 1. Создаем существующий исправный бэкап
    const existingBackupName = 'glucotrack_backup_20261101_000000.db';
    const existingContent = 'valid-previous-backup-data';
    fs.writeFileSync(path.join(TEST_BACKUP_DIR, existingBackupName), existingContent);

    // 2. Исходная БД
    const db = new DatabaseSync(TEST_DB_FILE);
    db.exec('CREATE TABLE keep (val TEXT); INSERT INTO keep VALUES (\'vital-data\');');
    db.close();

    // 3. Вызываем сбой (например, требуем шифрование без ключа REQUIRE_ENCRYPTION=true)
    const failRes = runBashScript(path.resolve('backup.sh'), {
      REQUIRE_ENCRYPTION: 'true',
    });
    assert.notEqual(failRes.status, 0, 'Бэкап должен упасть из-за отсутствия ключа при REQUIRE_ENCRYPTION');

    // 4. Проверяем: предыдущий исправный бэкап НЕ поврежден и НЕ удален
    assert.ok(fs.existsSync(path.join(TEST_BACKUP_DIR, existingBackupName)));
    assert.equal(fs.readFileSync(path.join(TEST_BACKUP_DIR, existingBackupName), 'utf-8'), existingContent);

    // 5. Исходная база данных цела
    const checkDb = new DatabaseSync(TEST_DB_FILE, { readOnly: true });
    assert.equal(checkDb.prepare('SELECT val FROM keep').get().val, 'vital-data');
    checkDb.close();

    // 6. Никаких временных файлов .tmp_ не должно остаться
    const tmpFiles = fs.readdirSync(TEST_BACKUP_DIR).filter((f) => f.includes('.tmp_'));
    assert.equal(tmpFiles.length, 0, 'Временные файлы должны быть полностью убраны обработчиком trap cleanup');
  } finally {
    cleanupTestEnvironment();
  }
});

test('SEC-07: Защита от одновременного запуска нескольких экземпляров (flock lock)', { skip: !HAS_BASH }, () => {
  setupTestEnvironment();
  try {
    const db = new DatabaseSync(TEST_DB_FILE);
    db.exec('CREATE TABLE lock_test (id INT);');
    db.close();

    // Имитируем блокировку: создаем файл блокировки и берем эксклюзивный lock через bash-процесс
    const lockScript = `
      exec 200>"${TEST_BACKUP_DIR.replace(/\\/g, '/')}/.backup.lock"
      if command -v flock >/dev/null 2>&1; then
        flock -n 200
      else
        mkdir "${TEST_BACKUP_DIR.replace(/\\/g, '/')}/.backup.lock.dir"
      fi
      sleep 5
    `;

    const holderProcess = cp.spawn(BASH_PATH, ['-c', lockScript], {
      detached: false,
      stdio: 'ignore',
    });

    // Даем процессу 200 мс на захват блокировки
    const start = Date.now();
    while (Date.now() - start < 300) {}

    try {
      // Пытаемся запустить backup.sh параллельно
      const secondRun = runBashScript(path.resolve('backup.sh'));
      assert.notEqual(secondRun.status, 0, 'Второй экземпляр должен завершиться с ошибкой из-за занятой блокировки');
      assert.match(
        secondRun.stderr + secondRun.stdout,
        /Другой экземпляр backup.sh уже выполняется/i,
        'Сообщение должно предупреждать о запущенном экземпляре'
      );
    } finally {
      holderProcess.kill();
    }
  } finally {
    cleanupTestEnvironment();
  }
});
