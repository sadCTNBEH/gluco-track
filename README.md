# 🩺 GlucoTrack — Дневник Диабета & Самоконтроля

<p align="center">
  <img src="public/apple-touch-icon.png" alt="GlucoTrack Icon" width="96" height="96" style="border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
</p>

<p align="center">
  <strong>Современное веб-приложение для ежедневного самоконтроля сахарного диабета</strong><br />
  Учет гликемии, расчет Хлебных Единиц (ХЕ), дозировки инсулинов, аналитика TIR, лабораторные маркеры (eHbA1c и ACR), экспорт отчетов для врача в PDF, импорт/экспорт Excel (.xlsx) и безопасная авторизация.
</p>

<p align="center">
  <a href="#-дневник-диабета--самоконтроля-glucotrack">🇷🇺 Документация на русском</a> •
  <a href="#-glucotrack--diabetes-self-monitoring-diary">🇬🇧 Documentation in English</a>
</p>

---

## 🇷🇺 Дневник Диабета & Самоконтроля (GlucoTrack)

### ✨ Ключевые возможности

1. **🎨 Медицинский дизайн (Apple Health & Polished UI)**:
   - Минималистичный интерфейс в стиле Apple Health и качественных потребительских health-сервисов.
   - Полноценные светлая и тёмная темы оформления.
   - Моноширинные цифры (`tabular-nums`) для легкого считывания замеров и доз.
   - Плотная и наглядная визуализация без лишнего визуального шума.

2. **📊 Компактная телеметрия здоровья (TIR и сводка)**:
   - 4 информативные карточки: средняя глюкоза за период, расчетный eHbA1c, время в целевом диапазоне (TIR: 100%), суточный расход инсулинов.
   - Экспресс-индикация отклонений и клинические диапазоны.

3. **🎯 Настраиваемый целевой диапазон сахара**:
   - Возможность задать индивидуальный порог гипогликемии (по умолчанию `≤ 3.9 ммоль/л`).
   - Настройка верхней границы нормы (по умолчанию `≤ 9.9 ммоль/л`).
   - Все графики, расчет TIR и цветовые метки динамически адаптируются под персональные настройки.

4. **🧪 Клинические маркеры (eHbA1c и ACR)**:
   - Поля для ввода лабораторного значения `eHbA1c (%)` и `ACR` (соотношение альбумин/креатинин в утренней порции мочи, мг/ммоль).
   - Аккуратное отображение в отчете для врача и сводке показателей.

5. **💉 Кастомизация названий инсулинов**:
   - Указание названий препаратов для болюсного (короткого) и базального (продленного) инсулинов (по умолчанию *РинФаст* и *Тресиба*).
   - Препараты отображаются в таблицах, модальных окнах, карточках, графиках и отчете для врача.

6. **⏱️ Точный учет среднесуточного инсулина по полным дням**:
   - Автоматический расчет суточного расхода болюса и базала только по дням, где полноценно отмечены все три основных приема пищи (утро, день и вечер).
   - Исключает искажения от пропущенных приемов пищи и единичных замеров.

7. **📱 PWA и ярлык для iPhone (Home Screen)**:
   - Готовые иконки для устройств Apple (`Apple Touch Icon` 180×180 px), фавиконки в форматах SVG, PNG (16×16, 32×32, 192×192, 512×512) и ICO.
   - Настроенный манифест PWA (`manifest.json`) и поддержка полноэкранного режима веб-приложения на iOS.

8. **📑 Двунаправленный обмен данными (Excel .xlsx и JSON)**:
   - Экспорт всех записей в аккуратную форматированную таблицу Excel (.xlsx) с цветной градацией сахара.
   - Умный импорт из Excel с предпросмотром, распознаванием колонок и поддержкой объединенных строк.
   - Полный бэкап и восстановление настроек и истории замеров в формате JSON.

9. **🩺 Отчет для лечащего врача (PDF / Печать)**:
   - Клинический протокол с титулом, реквизитами, целевым сахаром, маркерами eHbA1c и ACR, средней глюкозой и таблицей измерений.
   - Настраиваемая сортировка: от старых к новым (хронологическая) или от новых к старым (обратная).
   - Синхронное направление времени внутри каждого дня.

10. **🔐 Защищенная многопользовательская авторизация**:
    - Вход и регистрация с хэшированием паролей алгоритмом `scrypt` с криптографической солью.
    - Полная изоляция баз данных пользователей в SQLite.

11. **💾 Автоматический бэкап базы данных в 00:00 МСК**:
    - База данных SQLite сохраняется на сервере вне контейнера (`./data/glucotrack.db`).
    - Скрипт `backup.sh` обновляет резервную копию каждую полночь по московскому времени.

---

### 🚀 Быстрый запуск на сервере через Docker (Порт 4999)

#### Запуск / пересборка контейнера:
```bash
cd /opt/gluco-track
docker compose up -d --build
```

Приложение запустится в изолированном контейнере и будет принимать подключения на `127.0.0.1:4999`.

#### Остановка контейнера:
```bash
docker compose down
```

---

### ⏰ Настройка ежедневного бэкапа в 00:00 по МСК (вне контейнера)

1. Сделайте скрипт исполняемым:
```bash
chmod +x /opt/gluco-track/backup.sh
```

2. Добавьте задачу в cron сервера:
```bash
# Для системного времени сервера в UTC (00:00 МСК = 21:00 UTC):
(crontab -l 2>/dev/null | grep -v "backup.sh"; echo "0 21 * * * /opt/gluco-track/backup.sh") | crontab -

# Или с явным указанием часового пояса Москвы:
(crontab -l 2>/dev/null | grep -v "backup.sh"; echo "CRON_TZ=Europe/Moscow"; echo "0 0 * * * /opt/gluco-track/backup.sh") | crontab -
```

3. Ручная проверка создания бэкапа:
```bash
/opt/gluco-track/backup.sh
```
Резервная копия сохранится в каталоге `/opt/gluco-track/backups/glucotrack_latest_backup.db`.

---

### 🌐 Шаблон конфигурации Nginx (с SSL и HTTP/2)

Файл: `/etc/nginx/sites-available/gluco.example.com`

```nginx
# 1. HTTP — Редирект на HTTPS и верификация Let's Encrypt
server {
    listen 80;
    listen [::]:80;
    server_name gluco.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# 2. HTTPS — Обратное проксирование на порт 4999
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name gluco.example.com;

    http2 on;

    ssl_certificate /etc/letsencrypt/live/gluco.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gluco.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Заголовки безопасности
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip сжатие
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

Активация конфигурации:
```bash
sudo ln -s /etc/nginx/sites-available/gluco.example.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

### 💻 Локальная разработка и тестирование

```bash
# Установка зависимостей
npm install

# Запуск клиента и сервера в режиме разработки
npm run dev

# Запуск набора автоматических тестов
npm test

# Сборка production-бандла
npm run build
```

---

<br />

## 🇬🇧 GlucoTrack — Diabetes Self-Monitoring Diary

### ✨ Key Features

1. **🎨 Medical Grade UI (Apple Health & Polished UI Guidelines)**:
   - Clean, calming, minimal interface inspired by Apple Health and clinical dashboards.
   - Native Light and Dark themes with carefully calibrated surfaces and borders.
   - Monospaced tabular numerals (`tabular-nums`) for rapid reading of blood glucose and insulin dosages.
   - Mobile-first adaptive layout with support for one-handed entry on smartphones.

2. **📊 Compact Health Telemetry (TIR Dashboard)**:
   - 4 summary telemetry cards: average glucose, eHbA1c, Time in Range (TIR: 100%), and daily insulin breakdown.
   - Clear visual status badges for low, target, high, and severe hyperglycemia.

3. **🎯 Customizable Target Glucose Ranges**:
   - User-configurable hypoglycemia threshold (default `≤ 3.9 mmol/L`).
   - Adjustable upper target limit (default `≤ 9.9 mmol/L`).
   - Dynamic recalculation across TIR metrics, charts, tables, and PDF clinical reports.

4. **🧪 Clinical Laboratory Biomarkers (eHbA1c & ACR)**:
   - Dedicated inputs for `eHbA1c (%)` and `ACR` (urine albumin-to-creatinine ratio, mg/mmol).
   - Clear reporting in doctor PDF summaries and telemetry cards.

5. **💉 Personalized Insulin Names**:
   - Custom naming for bolus (rapid-acting mealtime) and basal (long-acting background) insulins (defaults: *RinFast* and *Tresiba*).
   - Automatically reflected across all dialogs, tables, cards, and reports.

6. **⏱️ Accurate Daily Insulin Averages Across Full Days**:
   - Calculates daily bolus and basal averages strictly based on days where morning, day, and evening meals are all recorded.
   - Eliminates distortion from partial days and isolated correction doses.

7. **📱 PWA & iPhone Home Screen Ready**:
   - Crisp Apple Touch Icon (180×180 px), multi-resolution favicons (SVG, PNG 16/32/192/512, ICO).
   - Web App Manifest (`manifest.json`) and iOS standalone full-screen support with safe area insets.

8. **📑 Bidirectional Data Management (Excel .xlsx & JSON)**:
   - Full export to Microsoft Excel (.xlsx) with color-coded glucose ratings and insulin summaries.
   - Intelligent Excel file import with column auto-matching, delimiter detection, and preview table.
   - Complete JSON backup and restore for data portability and offline storage.

9. **🩺 Doctor's Medical PDF Report**:
   - Formatted clinical report ready for print or PDF export with Average Glucose, TIR, eHbA1c, and ACR.
   - Bidirectional date sorting (chronological from oldest to newest, or reverse from newest to oldest) with synchronized time ordering.

10. **🔐 Multi-User Secure Authentication**:
    - Secure registration and login powered by salted `scrypt` hashing.
    - Individual, fully isolated SQLite databases for each patient.

11. **💾 Automated Daily SQLite Backups at 00:00 MSK**:
    - Host-level database persistence (`./data/glucotrack.db`).
    - Ready-to-use `backup.sh` script automated via cron.

---

### 🚀 Docker Server Deployment (Port 4999)

#### Build and run:
```bash
cd /opt/gluco-track
docker compose up -d --build
```
The app runs in a container listening on `127.0.0.1:4999`.

#### Stop:
```bash
docker compose down
```

---

### ⏰ Automated Daily Backup Setup (Cron)

1. Make the backup script executable:
```bash
chmod +x /opt/gluco-track/backup.sh
```

2. Add a cron schedule:
```bash
# If your server runs in UTC (00:00 MSK = 21:00 UTC):
(crontab -l 2>/dev/null | grep -v "backup.sh"; echo "0 21 * * * /opt/gluco-track/backup.sh") | crontab -

# Or with explicit Europe/Moscow timezone:
(crontab -l 2>/dev/null | grep -v "backup.sh"; echo "CRON_TZ=Europe/Moscow"; echo "0 0 * * * /opt/gluco-track/backup.sh") | crontab -
```

3. Test run manually:
```bash
/opt/gluco-track/backup.sh
```
Backup file is created at `/opt/gluco-track/backups/glucotrack_latest_backup.db`.

---

### 🌐 Nginx Reverse Proxy Template

File: `/etc/nginx/sites-available/gluco.example.com`

```nginx
# 1. HTTP — Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name gluco.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# 2. HTTPS — Proxy to local app (port 4999)
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name gluco.example.com;

    http2 on;

    ssl_certificate /etc/letsencrypt/live/gluco.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gluco.example.com/privkey.pem;
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

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/gluco.example.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

### 💻 Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run unit tests
npm test

# Build production bundle
npm run build
```
