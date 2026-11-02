# Этап 1: Сборка приложения
FROM node:22-alpine AS builder

WORKDIR /app

# Копируем описание зависимостей и устанавливаем их
COPY package.json ./
RUN npm install

# Копируем исходный код и собираем продакшен-бандл
COPY . .
RUN npm run build

# Этап 2: Раздача статики через Nginx на порту 4999
FROM nginx:alpine

# Копируем собранный проект
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфигурацию Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 4999
EXPOSE 4999

# Запуск Nginx
CMD ["nginx", "-g", "daemon off;"]
