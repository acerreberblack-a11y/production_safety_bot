import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import ConfigLoader from "../../utils/configLoader.js";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ticketType = new Scenes.BaseScene('ticketType');

ticketType.enter(async (ctx) => {
    try {
        // Инициализация сессии, если она пуста, но без полной очистки
        if (!ctx.session || Object.keys(ctx.session).length === 0) {
            ctx.session = {
                __scenes: ctx.session?.__scenes || { current: 'ticketType', state: {} },
                lastBotMessage: null // Инициализация поля для последнего сообщения
            };
        } else {
            // Обновляем только поле сцены, сохраняя остальные данные
            ctx.session.__scenes = ctx.session.__scenes || {};
            ctx.session.__scenes.current = 'ticketType';
            ctx.session.__scenes.state = ctx.session.__scenes.state || {};
        }

        const config = await ConfigLoader.loadConfig();
        const ticketConfig = config.controllers?.ticketType;

        if (!ticketConfig || !ticketConfig.text) {
            throw new Error('ticketType configuration or text is missing');
        }

        const messageOptions = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Анонимная', callback_data: 'anonymous' },
                        { text: 'Не анонимная', callback_data: 'non_anonymous' }
                    ],
                    [
                        { text: 'Отменить заполнение', callback_data: 'cancel' }
                    ]
                ]
            }
        };

        let message;
        const lastMessage = ctx.session.lastBotMessage;

        // Если нет последнего сообщения или оно невалидно, отправляем новое
        if (!lastMessage || !lastMessage.messageId || !lastMessage.chatId) {
            message = await ctx.reply(ticketConfig.text, messageOptions);
        } else {
            // Пытаемся обновить существующее сообщение
            try {
                if (lastMessage.type === 'photo') {
                    await ctx.telegram.editMessageCaption(
                        lastMessage.chatId,
                        lastMessage.messageId,
                        null,
                        ticketConfig.text,
                        messageOptions
                    );
                    message = { message_id: lastMessage.messageId, chat: { id: lastMessage.chatId } };
                } else {
                    await ctx.telegram.editMessageText(
                        lastMessage.chatId,
                        lastMessage.messageId,
                        null,
                        ticketConfig.text,
                        messageOptions
                    );
                    message = { message_id: lastMessage.messageId, chat: { id: lastMessage.chatId } };
                }
            } catch (editError) {
                logger.error(`Failed to edit message: ${editError.message}`);
                message = await ctx.reply(ticketConfig.text, messageOptions); // Отправляем новое, если редактирование не удалось
            }
        }

        // Обновляем сессию с информацией о последнем сообщении
        ctx.session.lastBotMessage = {
            messageId: message.message_id,
            chatId: message.chat.id,
            text: ticketConfig.text,
            date: new Date().toISOString(),
            type: ticketConfig.image?.enabled ? 'photo' : 'text'
        };

        logger.info(`User ${ctx.from.id} entered ticketType scene`);
    } catch (error) {
        logger.error(`Error in ticketType scene: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка при загрузке правил');
    }
});

ticketType.action('anonymous', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        // Удаляем клавиатуру у последнего сообщения
        const lastMessage = ctx.session.lastBotMessage;
        if (lastMessage && lastMessage.messageId && lastMessage.chatId) {
            await ctx.telegram.editMessageReplyMarkup(
                lastMessage.chatId,
                lastMessage.messageId,
                null,
                { reply_markup: {} } // Пустая клавиатура
            );
        }
        delete ctx.session.lastBotMessage;
        ctx.session.ticketType = null;
        await ctx.scene.enter('organization');
        logger.info(`User ${ctx.from.id} selected anonymous ticket`);
    } catch (error) {
        logger.error(`Error in anonymous action: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка');
    }
});

ticketType.action('non_anonymous', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        // Удаляем клавиатуру у последнего сообщения
        const lastMessage = ctx.session.lastBotMessage;
        if (lastMessage && lastMessage.messageId && lastMessage.chatId) {
            await ctx.telegram.editMessageReplyMarkup(
                lastMessage.chatId,
                lastMessage.messageId,
                null,
                { reply_markup: {} } // Пустая клавиатура
            );
        }
        delete ctx.session.lastBotMessage;
        await ctx.scene.enter('emailAuth');
        logger.info(`User ${ctx.from.id} selected non-anonymous ticket`);
    } catch (error) {
        logger.error(`Error in non_anonymous action: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка');
    }
});

ticketType.action('cancel', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        // Удаляем клавиатуру у последнего сообщения
        const lastMessage = ctx.session.lastBotMessage;
        if (lastMessage && lastMessage.messageId && lastMessage.chatId) {
            await ctx.telegram.editMessageReplyMarkup(
                lastMessage.chatId,
                lastMessage.messageId,
                null,
                { reply_markup: {} } // Пустая клавиатура
            );
        }
        delete ctx.session.ticketType;
        await ctx.reply('Заполнение обращения было отменено.');
        await ctx.scene.enter('welcome');
        logger.info(`User ${ctx.from.id} cancelled ticket creation`);
    } catch (error) {
        logger.error(`Error in cancel action: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка');
    }
});

export default ticketType;
