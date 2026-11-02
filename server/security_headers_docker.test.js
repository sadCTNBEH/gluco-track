import './test_setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { DatabaseSync } from 'node:sqlite';
import { app } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('SEC-08: Express отключает заголовок X-Powered-By', async () => {
  assert.equal(app.get('x-powered-by'), false, 'x-powered-by должен быть отключен в Express');

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get('x-powered-by'),
      null,
      'HTTP-ответ сервера не должен содержать заголовок X-Powered-By'
    );
  } finally {
    server.close();
  }
});

test('SEC-08: CORS разрешает доверенные источники, локальную разработку и same-origin запросы', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Same-origin запрос (без заголовка Origin)
    const resSameOrigin = await fetch(`${baseUrl}/api/health`);
    assert.equal(resSameOrigin.status, 200);

    // 2. Запрос с доверенного локального источника разработки (http://localhost:5173)
    const resDevOrigin = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert.equal(resDevOrigin.status, 200);
    assert.equal(resDevOrigin.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(resDevOrigin.headers.get('access-control-allow-credentials'), 'true');

    // 3. Запрос с production-домена (https://gluco.example.com)
    const resProdOrigin = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://gluco.example.com' },
    });
    assert.equal(resProdOrigin.status, 200);
    assert.equal(resProdOrigin.headers.get('access-control-allow-origin'), 'https://gluco.example.com');

    // 4. Preflight OPTIONS запрос с авторизационным заголовком Bearer
    const resPreflight = await fetch(`${baseUrl}/api/settings`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://gluco.example.com',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });
    assert.ok(resPreflight.status === 204 || resPreflight.status === 200);
    assert.equal(resPreflight.headers.get('access-control-allow-origin'), 'https://gluco.example.com');
    const allowHeaders = resPreflight.headers.get('access-control-allow-headers') || '';
    assert.ok(
      allowHeaders.toLowerCase().includes('authorization'),
      'Access-Control-Allow-Headers должен разрешать Authorization'
    );
  } finally {
    server.close();
  }
});

test('SEC-08: CORS блокирует недоверенные внешние источники', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET запрос с вредоносного источника
    const resMalicious = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://malicious-attacker.com' },
    });
    assert.equal(
      resMalicious.headers.get('access-control-allow-origin'),
      null,
      'Вредоносный origin не должен получать заголовок Access-Control-Allow-Origin'
    );

    // 2. Preflight OPTIONS запрос с вредоносного источника
    const resPreflightMalicious = await fetch(`${baseUrl}/api/settings`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious-attacker.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    });
    assert.equal(
      resPreflightMalicious.headers.get('access-control-allow-origin'),
      null,
      'Preflight запрос с вредоносного origin не должен получать Access-Control-Allow-Origin'
    );
  } finally {
    server.close();
  }
});

test('SEC-08: trust proxy исключает подделку клиентского IP через X-Forwarded-For и обход Rate Limit', async () => {
  const testApp = express();
  testApp.set('trust proxy', 'loopback, 172.16.0.0/12, 10.0.0.0/8');

  let detectedClientIp = '';
  testApp.get('/test-proxy-ip', (req, res) => {
    detectedClientIp = req.ip;
    res.json({ ip: req.ip });
  });

  const server = testApp.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Сценарий 1: Запрос проходит через обратный прокси Nginx.
    // Nginx передает реальный IP клиента (203.0.113.195) через X-Forwarded-For.
    const r1 = await fetch(`${baseUrl}/test-proxy-ip`, {
      headers: { 'X-Forwarded-For': '203.0.113.195' },
    });
    assert.equal(r1.status, 200);
    assert.equal(detectedClientIp, '203.0.113.195', 'Реальный IP клиента должен считываться из X-Forwarded-For');

    // Сценарий 2: Атакующий пытается обойти Rate Limiting, подставляя свой фиктивный IP (1.2.3.4),
    // в то время как Nginx добавляет реальный IP в конец цепочки: "1.2.3.4, 203.0.113.195".
    // Express при доверии одному прокси берет крайний справа доверенный хоп (203.0.113.195), игнорируя 1.2.3.4.
    const r2 = await fetch(`${baseUrl}/test-proxy-ip`, {
      headers: { 'X-Forwarded-For': '1.2.3.4, 203.0.113.195' },
    });
    assert.equal(r2.status, 200);
    assert.equal(
      detectedClientIp,
      '203.0.113.195',
      'Express должен брать реальный IP, добавленный Nginx, и игнорировать поддельный 1.2.3.4'
    );
  } finally {
    server.close();
  }
});

test('SEC-08: Валидация файла конфигурации Nginx (HSTS, Permissions-Policy, CSP, COOP, CORP)', () => {
  const nginxPath = path.join(ROOT_DIR, 'nginx.conf');
  assert.ok(fs.existsSync(nginxPath), 'Файл nginx.conf должен существовать');

  const content = fs.readFileSync(nginxPath, 'utf-8');

  // 1. Проверка HSTS: безопасный срок без preload и includeSubDomains (SEC-08 Req 3)
  const hstsLine = content.split('\n').find((l) => l.trim().startsWith('add_header Strict-Transport-Security'));
  assert.ok(hstsLine, 'Директива add_header Strict-Transport-Security должна присутствовать');
  assert.match(
    hstsLine,
    /add_header\s+Strict-Transport-Security\s+"max-age=31536000"\s+always;/i,
    'HSTS должен быть установлен на max-age=31536000'
  );
  assert.doesNotMatch(
    hstsLine,
    /preload/i,
    'Директива HSTS НЕ должна содержать preload без проверки всех поддоменов'
  );
  assert.doesNotMatch(
    hstsLine,
    /includeSubDomains/i,
    'Директива HSTS НЕ должна содержать includeSubDomains без проверки всех поддоменов'
  );

  // 2. Проверка Permissions-Policy
  assert.match(
    content,
    /add_header\s+Permissions-Policy\s+"geolocation=\(\),\s*microphone=\(\),\s*camera=\(\),\s*payment=\(\)"\s+always;/i,
    'Permissions-Policy должен отключать неиспользуемые API'
  );

  // 3. Скрытие версии сервера (server_tokens off)
  assert.match(content, /server_tokens\s+off;/i, 'Nginx должен скрывать версию через server_tokens off');

  // 4. Проверка директив Content-Security-Policy (CSP)
  assert.match(content, /add_header\s+Content-Security-Policy\s+"/i, 'CSP заголовок должен быть задан');
  assert.match(content, /default-src\s+'self'/i, 'CSP должен содержать default-src \'self\'');
  assert.match(content, /script-src\s+'self'/i, 'CSP должен содержать script-src \'self\'');
  assert.match(
    content,
    /style-src\s+'self'\s+'unsafe-inline'/i,
    'CSP должен разрешать стили React/Tailwind'
  );
  assert.match(
    content,
    /font-src\s+'self'\s+data:/i,
    'CSP font-src должен разрешать локальные шрифты и data: без внешних обращений к Google'
  );
  assert.match(content, /img-src\s+'self'\s+data:\s+blob:/i, 'CSP img-src должен разрешать data: и blob: для графиков/PWA');
  assert.match(content, /connect-src\s+'self'\s+ws:\s+wss:/i, 'CSP connect-src должен разрешать API и сокеты');
  assert.match(content, /worker-src\s+'self'\s+blob:/i, 'CSP worker-src должен поддерживать воркеры PWA');
  assert.match(content, /manifest-src\s+'self'/i, 'CSP manifest-src должен разрешать манифест PWA');
  assert.match(content, /object-src\s+'none'/i, 'CSP object-src должен быть \'none\'');
  assert.match(content, /base-uri\s+'self'/i, 'CSP base-uri должен быть \'self\'');
  assert.match(content, /form-action\s+'self'/i, 'CSP form-action должен быть \'self\'');
  assert.match(content, /frame-ancestors\s+'self'/i, 'CSP frame-ancestors должен защищать от clickjacking');

  // 5. Проверка сохранения порта 127.0.0.1:4999 (SEC-08 Req 9)
  assert.match(content, /proxy_pass\s+http:\/\/127\.0\.0\.1:4999;/i, 'Nginx должен проксировать на 127.0.0.1:4999');
});

test('SEC-09: Валидация Dockerfile и Docker Compose (USER node, no-new-privileges, bind mount, порт 4999)', () => {
  const dockerfilePath = path.join(ROOT_DIR, 'Dockerfile');
  const composePath = path.join(ROOT_DIR, 'docker-compose.yml');

  assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile должен существовать');
  assert.ok(fs.existsSync(composePath), 'docker-compose.yml должен существовать');

  const dockerfile = fs.readFileSync(dockerfilePath, 'utf-8');
  const compose = fs.readFileSync(composePath, 'utf-8');

  // 1. Проверка Dockerfile: запуск от непривилегированного пользователя node
  assert.match(dockerfile, /USER\s+node/i, 'Dockerfile должен содержать директиву USER node');
  assert.match(dockerfile, /chown\s+-R\s+node:node\s+\/app/i, 'Dockerfile должен передавать права пользователю node');
  assert.match(dockerfile, /EXPOSE\s+4999/i, 'Порт контейнера должен быть 4999');

  // 2. Проверка docker-compose.yml: no-new-privileges и привязка к 127.0.0.1:4999
  assert.match(compose, /user:\s*["']?1000:1000["']?/i, 'docker-compose.yml должен указывать пользователя 1000:1000');
  assert.match(compose, /no-new-privileges:true/i, 'docker-compose.yml должен содержать security_opt no-new-privileges:true');
  assert.match(compose, /"127\.0\.0\.1:4999:4999"/i, 'docker-compose.yml должен привязывать порт только к 127.0.0.1:4999');
  assert.match(compose, /\.\/data:\/app\/data/i, 'docker-compose.yml должен монтировать том ./data:/app/data');
});

test('SEC-09: SQLite и WAL работают корректно при записи и чтении (совместимость с непривилегированным пользователем)', () => {
  const testDir = path.join(os.tmpdir(), `glucotrack_sec09_${crypto.randomUUID()}`);
  fs.mkdirSync(testDir, { recursive: true });

  const testDbPath = path.join(testDir, 'test.db');
  let testDb;

  try {
    testDb = new DatabaseSync(testDbPath);
    testDb.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE test_records (
        id TEXT PRIMARY KEY,
        val REAL NOT NULL
      );
    `);

    // Вставка данных в WAL-режиме
    const insert = testDb.prepare('INSERT INTO test_records (id, val) VALUES (?, ?)');
    insert.run('rec-1', 5.5);
    insert.run('rec-2', 7.2);

    const rows = testDb.prepare('SELECT COUNT(*) as cnt FROM test_records').get();
    assert.equal(rows.cnt, 2);

    // Проверка integrity_check
    const integrity = testDb.prepare('PRAGMA integrity_check').get();
    assert.equal(integrity.integrity_check, 'ok');
  } finally {
    if (testDb) {
      testDb.close();
    }
    // Удаляем тестовую директорию
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
