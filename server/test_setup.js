import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';

// Принудительно устанавливаем тестовое окружение
process.env.NODE_ENV = 'test';

// Создаем изолированный временный каталог для текущего процесса теста в os.tmpdir()
const uniqueId = crypto.randomUUID();
const tempTestDir = path.join(os.tmpdir(), `glucotrack_test_${uniqueId}`);
fs.mkdirSync(tempTestDir, { recursive: true });

// Переопределяем DATA_DIR строго до импорта server/db.js
process.env.DATA_DIR = tempTestDir;

/**
 * Гарантированная очистка временного каталога базы данных
 */
export async function cleanupTestDatabase() {
  try {
    const dbModule = await import('./db.js');
    if (dbModule?.closeDb) {
      dbModule.closeDb();
    }
  } catch {}

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (fs.existsSync(tempTestDir)) {
        fs.rmSync(tempTestDir, { recursive: true, force: true });
      }
      break;
    } catch {
      // Кратковременная пауза для освобождения файловых блокировок Windows
      const start = Date.now();
      while (Date.now() - start < 50) {}
    }
  }
}

// Очистка после завершения всех тестов в данном файле
test.after(async () => {
  await cleanupTestDatabase();
});

// Дополнительный перехватчик при аварийном завершении процесса
process.on('exit', () => {
  try {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  } catch {}
});
