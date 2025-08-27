import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import ConfigLoader from '../../utils/configLoader.js';
import { findUserByTelegramId, getTicketsByUserId } from '../../../db/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const welcome = new Scenes.BaseScene('welcome');

welcome.enter(async (ctx) => {
    const chatId = ctx.from.id;

    try {
        // Инициализация сессии, если она пуста, но без полной очистки
        if (!ctx.session || Object.keys(ctx.session).length === 0) {
            ctx.session = {
                __scenes: ctx.session?.__scenes || { current: 'welcome', state: {} },
                lastBotMessage: null,
                user: null
            };
            logger.debug('Session initialized in welcome scene');
        } else {
            // Обновляем только поле сцены, сохраняя остальные данные
            ctx.session.__scenes = ctx.session.__scenes || {};
            ctx.session.__scenes.current = 'welcome';
            ctx.session.__scenes.state = ctx.session.__scenes.state || {};
            // Получаем данные пользователя из базы и обновляем сессию
            ctx.session.user = await findUserByTelegramId(chatId);
            logger.debug(`Session updated in welcome scene, user fetched for chatId: ${chatId}`);
        }

        // Логируем данные пользователя для отладки
        logger.debug('User data in welcome scene:', ctx.session.user);

        const config = await ConfigLoader.loadConfig();
        const welcomeConfig = config.controllers?.welcome;

        if (!welcomeConfig || !welcomeConfig.text) {
            throw new Error('Welcome configuration or text is missing');
        }

        // Формируем клавиатуру по умолчанию
        let keyboard = [
            [
                { text: 'Создать обращение', callback_data: 'create_ticket' },
                { text: 'Мои обращения', callback_data: 'my_tickets' }
            ]
        ];

        // Если пользователь — администратор (role_id = 3), добавляем кнопку "Управление"
        if (ctx.session.user?.role_id === 2) { // Предполагается, что поле называется role_id
            keyboard = [
                [
                    { text: 'Создать обращение', callback_data: 'create_ticket' },
                    { text: 'Мои обращения', callback_data: 'my_tickets' }
                ],
                [
                    { text: 'Управление', callback_data: 'manager_admin' }
                ]
            ];
            logger.debug('Admin keyboard applied for user:', ctx.session.user.id_telegram);
        }

        const messageOptions = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: keyboard

            }
        };

        let message;
        if (welcomeConfig.image?.enabled) {
            try {
                const imagePath = path.resolve(__dirname, '../../../', welcomeConfig.image.path);
                message = await ctx.replyWithPhoto(
                    { source: imagePath },
                    {
                        caption: welcomeConfig.text,
                        ...messageOptions
                    }
                );
            } catch (photoError) {
                logger.error(`Failed to load welcome image: ${photoError.message}`);
                message = await ctx.reply(welcomeConfig.text, messageOptions);
            }
        } else {
            message = await ctx.reply(welcomeConfig.text, messageOptions);
        }

        // Обновляем сессию с информацией о последнем сообщении
        ctx.session.lastBotMessage = {
            messageId: message.message_id,
            chatId: message.chat.id,
            date: new Date().toISOString(),
            type: welcomeConfig.image?.enabled ? 'photo' : 'text'
        };

        logger.info(`User ${ctx.from.id} received welcome message`);
    } catch (error) {
        logger.error(`Error in welcome scene: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка при загрузке приветствия');
    }
});

welcome.action('create_ticket', async (ctx) => {
    try {
        const lastMessage = ctx.session.lastBotMessage;
        if (!lastMessage) {
            throw new Error('No last message found in session');
        }

        const messageOptions = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [] // Убираем кнопки после переключения
            }
        };

        // Обновляем сообщение в зависимости от типа, оставляя текст без изменений
        if (lastMessage.type === 'photo') {
            await ctx.telegram.editMessageCaption(
                lastMessage.chatId,
                lastMessage.messageId,
                null,
                lastMessage.text,
                messageOptions
            );
        } else {
            await ctx.telegram.editMessageText(
                lastMessage.chatId,
                lastMessage.messageId,
                null,
                lastMessage.text,
                messageOptions
            );
        }

        await ctx.scene.enter('description');
        logger.info(`User ${ctx.from.id} switched to description scene`);
    } catch (error) {
        logger.error(`Error in create_ticket action: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка при создании обращения');
    }
});

welcome.action('my_tickets', async (ctx) => {
    try {
        const userId = ctx.session.user?.id;
        if (!userId) {
            throw new Error('User not found in session');
        }

        const tickets = await getTicketsByUserId(userId);

        await ctx.answerCbQuery();

        const replyOptions = {
            reply_markup: {
                inline_keyboard: [[{ text: 'Назад', callback_data: 'back_to_welcome' }]]
            }
        };

        if (!tickets.length) {
            return await ctx.reply('У вас пока нет обращений', replyOptions);
        }

        let message = 'Ваши обращения:\n';
        for (const ticket of tickets) {
            const date = new Date(ticket.created_at).toLocaleString('ru-RU');
            message += `\n#${ticket.id} | ${date}\n${ticket.message}\n`;
        }

        if (message.length <= 4096) {
            await ctx.reply(message.trim(), replyOptions);
        } else {
            const chunks = message.match(/[\s\S]{1,4000}/g) || [message];
            for (let i = 0; i < chunks.length; i++) {
                const options = i === chunks.length - 1 ? replyOptions : undefined;
                await ctx.reply(chunks[i].trim(), options);
            }
        }

        logger.info(`User ${ctx.from.id} requested ticket list`);
    } catch (error) {
        logger.error(`Error in my_tickets action: ${error.message}`);
        await ctx.answerCbQuery('Не удалось получить обращения', { show_alert: true });
    }
});

welcome.action('back_to_welcome', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        await ctx.deleteMessage().catch(() => {});
        await ctx.scene.reenter();
        logger.info(`User ${ctx.from.id} returned to welcome scene`);
    } catch (error) {
        logger.error(`Error in back_to_welcome action: ${error.message}`);
    }
});

welcome.action('manager_admin', async (ctx) => {
    try {
        const lastMessage = ctx.session.lastBotMessage;
        if (!lastMessage) {
            throw new Error('No last message found in session');
        }

        const messageOptions = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [] // Убираем кнопки после переключения
            }
        };

        // Обновляем сообщение в зависимости от типа, оставляя текст без изменений
        if (lastMessage.type === 'photo') {
            await ctx.telegram.editMessageCaption(
                lastMessage.chatId,
                lastMessage.messageId,
                null,
                lastMessage.text,
                messageOptions
            );
        } else {
            await ctx.telegram.editMessageText(
                lastMessage.chatId,
                lastMessage.messageId,
                null,
                lastMessage.text,
                messageOptions
            );
        }

        await ctx.answerCbQuery();
        await ctx.scene.enter('admin');
        logger.info(`User ${ctx.from.id} switched to admin scene`);
    } catch (error) {
        logger.error(`Error in manager_admin action: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка при переходе в управление');
    }
});

export default welcome;
