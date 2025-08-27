import logger from '../utils/logger.js';

// Simple rate limiting middleware to prevent message spam
// limit: number of messages
// interval: time window in milliseconds
export default function spamProtection({ limit = 5, interval = 10000 } = {}) {
  const userTimestamps = new Map();

  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    const timestamps = userTimestamps.get(userId) || [];
    const recent = timestamps.filter((t) => now - t < interval);
    recent.push(now);
    userTimestamps.set(userId, recent);

    if (recent.length > limit) {
      logger.warn(`User ${userId} is sending messages too frequently`);
      await ctx.reply('Пожалуйста, не отправляйте сообщения так часто.');
      return;
    }

    await next();
  };
}
