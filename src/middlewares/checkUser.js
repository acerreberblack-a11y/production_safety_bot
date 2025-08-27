import { findUserByTelegramId, createUser, updateUser } from '../../db/users.js';
import logger from '../utils/logger.js';

// Middleware для проверки существования пользователя и обновления его данных
export default async (ctx, next) => {
  try {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      ctx.reply('Не удалось определить ваш Telegram ID. Пожалуйста, свяжитесь с администратором.');
      return;
    }

    // Инициализация сессии, если её ещё нет
    if (!ctx.session) {
      ctx.session = {};
    }

    // Если данные пользователя уже есть в сессии — обновляем время активности
    if (ctx.session.user && ctx.session.user.id_telegram === telegramId) {
      logger.debug(`User data already in session for Telegram ID: ${telegramId}`);
      ctx.session.user.dataLastActivity = new Date();
    } else {
      // Извлекаем основные данные из контекста Telegram
      const userData = {
        id_telegram: telegramId,
        username: ctx.from?.username || null,
        firstName: ctx.from?.first_name || null,
        lastName: ctx.from?.last_name || null,
        linkChat: ctx.chat?.username ? `https://t.me/${ctx.chat.username}` : null,
        email: null // Здесь может быть логика получения email
      };

      // Ищем пользователя в базе
      let user = await findUserByTelegramId(telegramId);

      if (!user) {
        // Пользователь не найден — создаём новую запись
        user = await createUser(
          userData.id_telegram,
          userData.username,
          userData.firstName,
          userData.lastName,
          userData.linkChat,
          userData.email
        );
        logger.info(`New user created with Telegram ID: ${telegramId}`);
      } else {
        // Пользователь найден — актуализируем данные
        user = await updateUser(telegramId, {
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          linkChat: userData.linkChat,
          dataLastActivity: new Date()
        });
        logger.debug(`User with Telegram ID ${telegramId} updated`);
      }

      // Проверяем, не заблокирован ли пользователь
      if (user.isBanned) {
        await ctx.reply('Ваш аккаунт заблокирован. Обратитесь к администратору.');
        return;
      }
    }

    await next();
  } catch (error) {
    logger.error(`Error in userCheck middleware: ${error.message}`, { stack: error.stack });
    await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
  }
};

