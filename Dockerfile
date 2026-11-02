# Этап 1: Сборка фронтенда
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Этап 2: Финальный образ для запуска приложения на порту 4999
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4999
ENV DATA_DIR=/app/data

# Установка только production-зависимостей и SQLite CLI (SEC-07)
RUN apk add --no-cache sqlite
COPY package*.json ./
RUN npm ci --omit=dev

# Копируем серверную часть и собранный бандл фронтенда с назначением прав непривилегированному пользователю node (SEC-09)
COPY --chown=node:node server/ ./server/
COPY --from=builder --chown=node:node /app/dist ./dist

# Директория для SQLite базы данных и назначение прав непривилегированному пользователю node (SEC-09)
RUN mkdir -p /app/data && chown -R node:node /app

# Переход на встроенного непривилегированного пользователя node (UID/GID 1000) (SEC-09)
USER node

EXPOSE 4999

CMD ["node", "server/index.js"]
