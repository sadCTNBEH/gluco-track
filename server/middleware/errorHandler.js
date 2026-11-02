/**
 * Централизованный обработчик ошибок Express.
 * Перехватывает синтаксические ошибки JSON, непредвиденные сбои маршрутов
 * и возвращает клиенту безопасный ответ в формате JSON.
 */
export function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  }

  console.error('Unhandled server error:', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ error: err.message || 'Внутренняя ошибка сервера' });
}
