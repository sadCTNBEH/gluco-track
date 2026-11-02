import { rateLimit } from 'express-rate-limit';

/**
 * Лимитер на регистрацию: не более 10 регистраций за час с одного IP (SEC-02 / SEC-06)
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Слишком много запросов на регистрацию с этого адреса. Пожалуйста, повторите позже.' },
});

/**
 * Общий лимитер на вход по IP: не более 30 попыток за 15 минут
 */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Слишком много попыток входа с вашего IP-адреса. Пожалуйста, повторите попытку через 15 минут.' },
});

/**
 * Лимитер на аккаунт + IP: не более 10 неудачных попыток за 15 минут для конкретного пользователя с данного IP.
 * Включение IP в ключ исключает DoS-атаку (блокировку чужого аккаунта злоумышленником с другого IP).
 */
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => {
    const cleanUser = (req.body?.username || '').trim().toLowerCase();
    return `${req.ip}_${cleanUser}`;
  },
  validate: { keyGeneratorIpFallback: false },
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Слишком много неудачных попыток входа для этого логина с вашего адреса. Повторите попытку через 15 минут.' },
});
