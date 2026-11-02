import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { entriesRouter } from './routes/entries.routes.js';
import { deduplicateUserEntries } from './services/deduplication.service.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 4999;

// Отключение заголовка X-Powered-By для предотвращения идентификации стека сервера (SEC-08)
app.disable('x-powered-by');

// Настройка доверия к обратному прокси Nginx (SEC-02, SEC-08).
// Доверяем loopback (127.0.0.1, ::1) и локальным подсетям Docker bridge (172.16.0.0/12, 10.0.0.0/8).
// Это исключает подделку клиентского IP через X-Forwarded-For и гарантирует корректную работу Rate Limiting.
const TRUST_PROXY_CONFIG = process.env.TRUST_PROXY || 'loopback, 172.16.0.0/12, 10.0.0.0/8';
app.set('trust proxy', TRUST_PROXY_CONFIG);

// Безопасная конфигурация CORS (SEC-08)
export const defaultAllowedOrigins = [
  'http://localhost:4999',
  'http://localhost:5173',
  'http://127.0.0.1:4999',
  'http://127.0.0.1:5173',
  'https://gluco.example.com',
];

export const configuredOrigins = new Set(defaultAllowedOrigins);
if (process.env.APP_ORIGIN) {
  process.env.APP_ORIGIN.split(',').forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) configuredOrigins.add(trimmed);
  });
}
if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) configuredOrigins.add(trimmed);
  });
}

export const corsOptions = {
  origin: (origin, callback) => {
    // Разрешаем запросы без Origin (same-origin, curl, server-to-server, мобильные клиенты PWA)
    if (!origin) {
      return callback(null, true);
    }
    // Разрешаем доверенные источники (производственный домен и локальные порты разработки)
    if (configuredOrigins.has(origin)) {
      return callback(null, true);
    }
    // В dev-режиме или при тестировании разрешаем любые порты на localhost / 127.0.0.1
    if (process.env.NODE_ENV !== 'production') {
      try {
        const parsed = new URL(origin);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          return callback(null, true);
        }
      } catch {}
    }
    // Недоверенные внешние источники блокируются без заголовка Access-Control-Allow-Origin
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Подключение модульных маршрутов API
app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/entries', entriesRouter);

// Раздача статики фронтенда и SPA fallback
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// Централизованный обработчик ошибок
app.use(errorHandler);

// Реэкспорт для обратной совместимости с существующими тестами
export { deduplicateUserEntries };

// Запуск HTTP-сервера только при непосредственном запуске файла (node server/index.js),
// но не при импорте экземпляра app в тестах.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GlucoTrack server started on http://0.0.0.0:${PORT}`);
  });
}

export { app };
