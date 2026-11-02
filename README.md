# 🩺 Дневник Диабета & Самоконтроля (РинФаст и Тресиба)

Веб-приложение для ежедневного самоконтроля сахарного диабета, учета уровня глюкозы, углеводов, Хлебных Единиц (ХЕ), калорий, доз инсулинов **РинФаст** и **Тресиба**, интерактивных графиков динамики за месяц, экспорта отчетов в PDF для лечащего врача, **импорта из Excel (.xlsx)** и **авторизации с защитой данных**.

---

## ✨ Новые возможности

1. **🔐 Регистрация и Вход (Авторизация)**:
   - Доступ к данным защищен логином и паролем.
   - Пароли хэшируются алгоритмом `scrypt` с солью.
   - У каждого пользователя своя изолированная база данных записей и настроек.
   - Сессии хранятся в защищенной базе SQLite.

2. **📊 Импорт из Excel (.xlsx)**:
   - Загрузка замеров напрямую из файлов Excel.
   - Умное распознавание колонок: Дата, Время, Сахар/Глюкоза, ХЕ, Углеводы, РинФаст, Тресиба, Калории, Заметки.
   - Предпросмотр перед сохранением и выбор режима (добавить к имеющимся или заменить).

3. **💾 Ежедневный автоматический бэкап базы данных вне контейнера в 00:00 МСК**:
   - База данных SQLite сохраняется на хосте в каталоге `./data/glucotrack.db`.
   - Готовый скрипт `backup.sh` обновляет файл `backups/glucotrack_latest_backup.db` каждую полночь по МСК.

---

## 🚀 Быстрый запуск на сервере через Docker (Порт 4999)

### Запуск / Пересборка контейнера:
```bash
cd /opt/gluco-track
docker compose up -d --build
```

Приложение запустится в контейнере и будет слушать `127.0.0.1:4999`.

### Остановка:
```bash
docker compose down
```

---

## ⏰ Настройка ежедневного бэкапа в 00:00 по МСК (вне контейнера)

1. Сделайте скрипт исполняемым:
```bash
chmod +x /opt/gluco-track/backup.sh
```

2. Добавьте задачу в cron хоста:
```bash
# Если системное время сервера в UTC (00:00 МСК = 21:00 UTC):
(crontab -l 2>/dev/null | grep -v "backup.sh"; echo "0 21 * * * /opt/gluco-track/backup.sh") | crontab -

# Или с явным указанием часового пояса Москвы:
(crontab -l 2>/dev/null | grep -v "backup.sh"; echo "CRON_TZ=Europe/Moscow"; echo "0 0 * * * /opt/gluco-track/backup.sh") | crontab -
```

3. Проверить ручной запуск бэкапа:
```bash
/opt/gluco-track/backup.sh
```
Файл бэкапа будет сохранен в `/opt/gluco-track/backups/glucotrack_latest_backup.db`.

---

## 🌐 Конфигурация Nginx на сервере (`gluco.zduben.ru`)

Файл: `/etc/nginx/sites-available/gluco.zduben.ru`

```nginx
# 1. HTTP — Редирект на HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name gluco.zduben.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# 2. HTTPS — Проксирование на приложение (порт 4999)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name gluco.zduben.ru;

    http2 on;

    ssl_certificate /etc/letsencrypt/live/gluco.zduben.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gluco.zduben.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:4999;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Применение:
```bash
sudo nginx -t && sudo systemctl reload nginx
```
