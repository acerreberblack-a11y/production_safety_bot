import logger from '../../../utils/logger.js';
import ConfigLoader from '../../../utils/configLoader.js';

export default function adminSettings(scene) {
  // Display current administrators and options
  scene.action('admin_settings', async (ctx) => {
    try {
      await ctx.deleteMessage();
      const config = await ConfigLoader.loadConfig();
      const admins = config.administrators || [];
      const list = admins.length ? admins.join(', ') : 'Список пуст';
      await ctx.reply(`Текущие администраторы:\n${list}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Добавить администратора', callback_data: 'prompt_add_admin' }],
            [{ text: 'Назад', callback_data: 'back_to_main' }],
          ],
        },
      });
    } catch (error) {
      logger.error(`Error in admin_settings action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при отображении администраторов.');
    }
  });

  // Prompt for new administrator ID
  scene.action('prompt_add_admin', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.reply('Введите Telegram ID пользователя:', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Отмена', callback_data: 'admin_settings' }]],
        },
      });
      ctx.session.action = 'add_admin';
    } catch (error) {
      logger.error(`Error in prompt_add_admin action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при запросе ID.');
    }
  });
}

