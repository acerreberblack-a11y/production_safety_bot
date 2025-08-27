import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import ConfigLoader from '../../utils/configLoader.js';

const description = new Scenes.BaseScene('description');

description.enter(async (ctx) => {
  try {
    // Инициализация сессии, если она пуста, но без полной очистки
    if (!ctx.session || Object.keys(ctx.session).length === 0) {
      ctx.session = {
        __scenes: ctx.session?.__scenes || { current: 'description', state: {} },
        lastBotMessage: null, // Инициализация поля для последнего сообщения
      };
    } else {
      // Обновляем только поле сцены, сохраняя остальные данные
      ctx.session.__scenes = ctx.session.__scenes || {};
      ctx.session.__scenes.current = 'description';
      ctx.session.__scenes.state = ctx.session.__scenes.state || {};
    }

    const config = await ConfigLoader.loadConfig();
    const descriptionConfig = config.controllers?.description;

    if (!descriptionConfig || !descriptionConfig.text) {
      throw new Error('Description configuration or text is missing');
    }

    const messageOptions = {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚀 Начать', callback_data: 'start_ticket' },
            { text: 'Отменить заполнение', callback_data: 'cancel' },
          ],
        ],
      },
    };

    let message;
    const lastMessage = ctx.session.lastBotMessage;

    // Если нет последнего сообщения или оно невалидно, отправляем новое
    if (!lastMessage || !lastMessage.messageId || !lastMessage.chatId) {
      message = await ctx.reply(descriptionConfig.text, messageOptions);
    } else {
      // Пытаемся обновить существующее сообщение
      try {
        if (lastMessage.type === 'photo') {
          await ctx.telegram.editMessageCaption(
            lastMessage.chatId,
            lastMessage.messageId,
            null,
            descriptionConfig.text,
            messageOptions,
          );
          message = { message_id: lastMessage.messageId, chat: { id: lastMessage.chatId } };
        } else {
          await ctx.telegram.editMessageText(
            lastMessage.chatId,
            lastMessage.messageId,
            null,
            descriptionConfig.text,
            messageOptions,
          );
          message = { message_id: lastMessage.messageId, chat: { id: lastMessage.chatId } };
        }
      } catch (editError) {
        logger.error(`Failed to edit message: ${editError.message}`);
        message = await ctx.reply(descriptionConfig.text, messageOptions); // Отправляем новое, если редактирование не удалось
      }
    }

    // Обновляем сессию с информацией о последнем сообщении
    ctx.session.lastBotMessage = {
      messageId: message.message_id,
      chatId: message.chat.id,
      text: descriptionConfig.text,
      date: new Date().toISOString(),
      type: descriptionConfig.image?.enabled ? 'photo' : 'text',
    };

    logger.info(`User ${ctx.from.id} entered description scene`);
  } catch (error) {
    logger.error(`Error in description scene: ${error.message}`);
    await ctx.reply('Извините, произошла ошибка при загрузке правил');
  }
});

description.action('start_ticket', async (ctx) => {
  try {
    const lastMessage = ctx.session.lastBotMessage;
    if (!lastMessage) {
      throw new Error('No last message found in session');
    }

    const messageOptions = {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [], // Убираем кнопки после переключения
      },
    };

    // Обновляем сообщение в зависимости от типа, оставляя текст без изменений
    if (lastMessage.type === 'photo') {
      await ctx.telegram.editMessageCaption(
        lastMessage.chatId,
        lastMessage.messageId,
        null,
        lastMessage.text,
        messageOptions,
      );
    } else {
      await ctx.telegram.editMessageText(
        lastMessage.chatId,
        lastMessage.messageId,
        null,
        lastMessage.text,
        messageOptions,
      );
    }

    await ctx.scene.enter('ticketType');
    logger.info(`User ${ctx.from.id} switched to ticketType scene`);
  } catch (error) {
    logger.error(`Error in start_ticket action: ${error.message}`);
    await ctx.reply('Извините, произошла ошибка при начале создания заявки');
  }
});

description.action('cancel', async (ctx) => {
  try {
    const lastMessage = ctx.session.lastBotMessage;
    if (!lastMessage) {
      throw new Error('No last message found in session');
    }

    const messageOptions = {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [], // Убираем кнопки после переключения
      },
    };

    // Обновляем сообщение в зависимости от типа, оставляя текст без изменений
    if (lastMessage.type === 'photo') {
      await ctx.telegram.editMessageCaption(
        lastMessage.chatId,
        lastMessage.messageId,
        null,
        lastMessage.text,
        messageOptions,
      );
    } else {
      await ctx.telegram.editMessageText(
        lastMessage.chatId,
        lastMessage.messageId,
        null,
        lastMessage.text,
        messageOptions,
      );
    }

    await ctx.reply('Заполнение обращения было отменено.');
    await ctx.scene.enter('welcome');
    logger.info(`User ${ctx.from.id} cancelled description, returned to welcome scene`);
  } catch (error) {
    logger.error(`Error in cancel action: ${error.message}`);
    await ctx.reply('Извините, произошла ошибка');
  }
});

export default description;
