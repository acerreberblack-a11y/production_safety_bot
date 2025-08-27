import logger from './logger.js';

export default async function handleError(ctx, error, message = 'An error occurred. Returning to main menu.') {
  logger.error(`Handler error: ${error.message}`, { stack: error.stack });
  try {
    await ctx.scene.enter('welcome');
  } catch (err) {
    logger.error(`Failed to enter welcome scene: ${err.message}`, { stack: err.stack });
  }
  // eslint-disable-next-line no-void
  void ctx.reply(message);
}
