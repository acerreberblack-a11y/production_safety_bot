import logger from '../utils/logger.js';

// Simple rate limiting middleware to prevent message spam
// limit: number of messages
// interval: time window in milliseconds
// The limiter now stores timestamps in the user session so that
// throttling applies per user and does not interfere with others.
export default function spamProtection({ limit = 5, interval = 10000 } = {}) {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Ensure session object exists
    if (!ctx.session) {
      ctx.session = {};
    }

    // Initialise spam tracking storage for this user
    if (!ctx.session.spam) {
      ctx.session.spam = { timestamps: [] };
    }

    const now = Date.now();
    ctx.session.spam.timestamps = ctx.session.spam.timestamps.filter(
      (t) => now - t < interval,
    );
    ctx.session.spam.timestamps.push(now);

    if (ctx.session.spam.timestamps.length > limit) {
      logger.warn(`User ${userId} is sending messages too frequently`);
      await ctx.reply('Пожалуйста, не отправляйте сообщения так часто.');
      return;
    }

    await next();
  };
}
