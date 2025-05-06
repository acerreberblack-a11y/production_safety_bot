import { findUserByTelegramId, createUser, updateUser } from '../../db/users.js';

// Middleware для проверки и управления пользователями
export default async (ctx, next) => {
    try {
        const telegramId = ctx.from?.id;
        if (!telegramId) {
            ctx.reply('Не удалось определить ваш Telegram ID. Пожалуйста, свяжитесь с администратором.');
            return;
        }

        // Инициализируем сессию, если она отсутствует
        if (!ctx.session) {
            ctx.session = {};
        }

        // Проверяем, есть ли данные пользователя в сессии
        if (ctx.session.user && ctx.session.user.id_telegram === telegramId) {
            console.log(`User data already in session for Telegram ID: ${telegramId}`);
            ctx.session.user.dataLastActivity = new Date();
        } else {
            // Извлекаем данные из контекста Telegram
            const userData = {
                id_telegram: telegramId,
                username: ctx.from?.username || null,
                firstName: ctx.from?.first_name || null,
                lastName: ctx.from?.last_name || null,
                linkChat: ctx.chat?.username ? `https://t.me/${ctx.chat.username}` : null,
                email: null // Можно добавить логику получения email, если есть
            };

            // Проверяем наличие пользователя в базе
            let user = await findUserByTelegramId(telegramId);

            if (!user) {
                // Если пользователя нет, создаём нового
                user = await createUser(userData.id_telegram, userData.username, userData.firstName, userData.lastName, userData.linkChat, userData.email);
                console.log(`New user created with Telegram ID: ${telegramId}`);
            } else {
                // Если пользователь есть, обновляем данные
                user = await updateUser(telegramId, {
                    username: userData.username,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    linkChat: userData.linkChat,
                    dataLastActivity: new Date()
                });
                console.log(`User with Telegram ID ${telegramId} updated`);
            }

            // Проверяем, заблокирован ли пользователь
            if (user.isBanned) {
                await ctx.reply('Ваш аккаунт заблокирован. Обратитесь к администратору.');
                return;
            }
        }
        await next();
    } catch (error) {
        console.error('Error in userCheck middleware:', error.message);
        await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
    }
};