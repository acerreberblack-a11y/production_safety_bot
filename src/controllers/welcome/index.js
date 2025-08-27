import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import ConfigLoader from '../../utils/configLoader.js';
import { findUserByTelegramId, getTicketsByUserId } from '../../../db/users.js';

const TICKETS_PER_PAGE = 10;
const MAX_TICKET_TEXT_LENGTH = 100;

function formatTicketsPage(tickets, page) {
    const start = page * TICKETS_PER_PAGE;
    const pageTickets = tickets.slice(start, start + TICKETS_PER_PAGE);

    if (!pageTickets.length) {
        return 'У вас пока нет обращений';
    }

    let message = 'Ваши обращения:\n';
    for (const ticket of pageTickets) {
        const date = new Date(ticket.created_at).toLocaleString('ru-RU');
        let text = ticket.message || '';
        if (text.length > MAX_TICKET_TEXT_LENGTH) {
            text = text.slice(0, MAX_TICKET_TEXT_LENGTH - 3) + '...';
        }
        message += `\n#${ticket.id} | ${date}\n${text}\n`;
    }

    return message.trim();
}

function buildTicketsKeyboard(page, totalPages) {
    const navButtons = [];
    if (page > 0) {
        navButtons.push({ text: '⬅️ Назад', callback_data: 'tickets_prev' });
    }
    if (page < totalPages - 1) {
        navButtons.push({ text: 'Вперед ➡️', callback_data: 'tickets_next' });
    }

    const keyboard = [];
    if (navButtons.length) {
        keyboard.push(navButtons);
    }
    keyboard.push([{ text: 'В меню', callback_data: 'back_to_welcome' }]);

    return { reply_markup: { inline_keyboard: keyboard } };
}
function formatProfileMessage(user, telegramId) {
    const organization = user?.organization || 'Не указано';
    const branch = user?.branch || 'Не указан';
    const email = user?.email || 'Не указан';
    const status = user?.email ? 'Подтвержден' : 'Не подтвержден';

    return (
        `Ваш профиль:\n` +
        `ID: ${telegramId}\n` +
        `Организация: ${organization}\n` +
        `Филиал: ${branch}\n` +
        `Email: ${email}\n` +
        `Статус: ${status}`
    );
}

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
        const admins = config.administrators || [];

        if (!welcomeConfig || !welcomeConfig.text) {
            throw new Error('Welcome configuration or text is missing');
        }

        // Формируем клавиатуру по умолчанию
        let keyboard = [
            [
                { text: 'Создать обращение', callback_data: 'create_ticket' },
                { text: 'Мои обращения', callback_data: 'my_tickets' }
            ],
            [
                { text: 'Профиль', callback_data: 'profile' }
            ]
        ];

        // Если пользователь является администратором, добавляем кнопку "Управление"
        if (admins.includes(chatId)) {
            keyboard.push([{ text: 'Управление', callback_data: 'manager_admin' }]);
            logger.debug('Admin keyboard applied for user:', chatId);
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
            text: welcomeConfig.text,
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

        ctx.session.ticketPagination = {
            tickets,
            page: 0
        };

        const totalPages = Math.ceil(tickets.length / TICKETS_PER_PAGE) || 1;
        const message = formatTicketsPage(tickets, 0);
        const options = buildTicketsKeyboard(0, totalPages);

        await ctx.reply(message, options);
        logger.info(`User ${ctx.from.id} requested ticket list`);
    } catch (error) {
        logger.error(`Error in my_tickets action: ${error.message}`);
        await ctx.answerCbQuery('Не удалось получить обращения', { show_alert: true });
    }
});

welcome.action('profile', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const user = ctx.session.user;
        const message = formatProfileMessage(user, ctx.from.id);

        const buttons = [];
        if (user?.email) {
            buttons.push([{ text: 'Изменить email', callback_data: 'change_email' }]);
        } else {
            buttons.push([{ text: 'Подтвердить аккаунт', callback_data: 'confirm_account' }]);
        }
        buttons.push([{ text: 'В меню', callback_data: 'back_to_welcome' }]);

        await ctx.reply(message, { reply_markup: { inline_keyboard: buttons } });
        logger.info(`User ${ctx.from.id} viewed profile`);
    } catch (error) {
        logger.error(`Error in profile action: ${error.message}`);
        await ctx.answerCbQuery('Не удалось показать профиль', { show_alert: true });
    }
});

welcome.action(['confirm_account', 'change_email'], async (ctx) => {
    try {
        await ctx.answerCbQuery();
        ctx.session.emailFlow = 'profile';
        await ctx.scene.enter('emailAuth');
    } catch (error) {
        logger.error(`Error starting email confirmation: ${error.message}`);
        await ctx.reply('Не удалось перейти к подтверждению.');
    }
});
welcome.action('tickets_next', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const pagination = ctx.session.ticketPagination;
        if (!pagination) return;
        const totalPages = Math.ceil(pagination.tickets.length / TICKETS_PER_PAGE) || 1;
        if (pagination.page < totalPages - 1) {
            pagination.page++;
        }
        const message = formatTicketsPage(pagination.tickets, pagination.page);
        const options = buildTicketsKeyboard(pagination.page, totalPages);
        await ctx.editMessageText(message, options);
    } catch (error) {
        logger.error(`Error in tickets_next action: ${error.message}`);
    }
});

welcome.action('tickets_prev', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const pagination = ctx.session.ticketPagination;
        if (!pagination) return;
        const totalPages = Math.ceil(pagination.tickets.length / TICKETS_PER_PAGE) || 1;
        if (pagination.page > 0) {
            pagination.page--;
        }
        const message = formatTicketsPage(pagination.tickets, pagination.page);
        const options = buildTicketsKeyboard(pagination.page, totalPages);
        await ctx.editMessageText(message, options);
    } catch (error) {
        logger.error(`Error in tickets_prev action: ${error.message}`);
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
        const config = await ConfigLoader.loadConfig();
        const admins = config.administrators || [];
        if (!admins.includes(ctx.from.id)) {
            await ctx.answerCbQuery('Недостаточно прав', { show_alert: true });
            return;
        }

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
