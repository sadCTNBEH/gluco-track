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

# Установка только production-зависимостей
COPY package*.json ./
RUN npm ci --omit=dev

# Копируем серверную часть и собранный бандл фронтенда
COPY server/ ./server/
COPY --from=builder /app/dist ./dist

# Директория для SQLite базы данных
RUN mkdir -p /app/data

EXPOSE 4999

CMD ["node", "server/index.js"]
