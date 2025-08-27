import logger from '../../../utils/logger.js';
import {
  searchUsers,
  getUserDetails,
  updateUserRole,
  blockUser,
  deleteUser,
  getTicketsByUserId,
  getTicketDetails,
} from '../../../../db/users.js';
import archiver from 'archiver';
import path from 'path';
import { PassThrough } from 'stream';

export default function user_settings(scene) {
  // === helpers ===
  const kb = (rows) => ({ reply_markup: { inline_keyboard: rows } });

  /** универсальный ответ с «Назад» */
  const replyWithBack = (ctx, text, backCbData, extraRows = []) =>
    ctx.reply(text, kb([...extraRows, [{ text: 'Назад', callback_data: backCbData }]]));

  /** читаем editScene из сессии (поддерживаем оба варианта хранения) */
  const getEditScene = (ctx) =>
    (ctx.session?.sceneData?.editScene ?? ctx.session?.editScene);

  /** показать карточку обращения */
  const showTicketView = async (ctx, ticket, files) => {
    const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleString('ru-RU') : 'Не указано';
    await ctx.reply(
      `Обращение #${ticket.id}\nОрганизация: ${ticket.organization || 'Не указано'}\nФилиал: ${ticket.branch || 'Не указано'}\nКлассификация: ${ticket.classification}\nДата отправки: ${createdAt}\n\n${ticket.message}`,
      kb([
        [{ text: 'Скачать архив', callback_data: `download_ticket_${ticket.id}` }],
        [{ text: 'Назад', callback_data: `user_requests_${ticket.user_id}` }],
      ]),
    );

    if (files && files.length) {
      for (const file of files) {
        const filename = path.basename(file.path || `file_${file.id || ''}`);
        await ctx.replyWithDocument({ source: Buffer.from(file.data), filename }, { caption: file.title || '' });
      }
    }
  };

  // === actions ===
  scene.action('user_settings', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.reply(
        'Введите ID, firstName, lastName или username для поиска пользователей:',
        kb([[{ text: 'Отмена', callback_data: 'back_to_main' }]]),
      );
      // выставляем ожидание ввода
      // eslint-disable-next-line no-param-reassign
      ctx.session.waitingForUserInput = true;
      // eslint-disable-next-line no-param-reassign
      ctx.session.action = 'find_user_for_db';
    } catch (error) {
      logger.error(`Error in user_settings: ${error.message}`, { stack: error.stack });
      await replyWithBack(ctx, 'Произошла ошибка при открытии сцены управления пользователями.', 'back_to_main');
    }
  });

  scene.action(/^user_(\d+)$/, async (ctx) => {
    try {
      if (!ctx.match || !ctx.match[1]) {
        await replyWithBack(ctx, 'Ошибка: некорректный идентификатор пользователя.', 'scene_user_management');
        return;
      }

      const userId = ctx.match[1];
      const user = await getUserDetails(userId);

      if (!user) {
        await replyWithBack(ctx, 'Ошибка: пользователь не найден.', 'scene_user_management');
        return;
      }

      await ctx.reply(
        `Информация о пользователе:\n\nID: ${user.id}\nИмя: ${user.firstName || ''} ${user.lastName || ''}\nUsername: ${user.username || ''}\nРоль: ${user.role_id}\nСтатус: ${user.is_blocked ? 'Заблокирован' : 'Активен'}`,
        kb([
          [{ text: 'Обращения', callback_data: `user_requests_${user.id}` }],
          [{ text: 'Изменить роль', callback_data: `change_role_${user.id}` }],
          [{ text: 'Заблокировать', callback_data: `block_user_${user.id}` }],
          [{ text: 'Удалить', callback_data: `delete_user_${user.id}` }],
          [{ text: 'Назад', callback_data: 'scene_user_management' }],
        ]),
      );
    } catch (error) {
      logger.error(`Error in user selection: ${error.message}`, { stack: error.stack });
      await replyWithBack(ctx, 'Ошибка при получении данных пользователя.', 'scene_user_management');
    }
  });

  scene.action(/^user_requests_(\d+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const userId = ctx.match[1];
      const tickets = await getTicketsByUserId(userId);

      if (!tickets.length) {
        await replyWithBack(ctx, 'У пользователя нет обращений.', `user_${userId}`);
        return;
      }

      // «Обращение - {id}»
      const keyboard = tickets.map((t) => [{ text: `Обращение - ${t.id}`, callback_data: `ticket_${t.id}` }]);
      keyboard.push([{ text: 'Поиск по ID', callback_data: `search_ticket_input_${userId}` }]);
      keyboard.push([{ text: 'Назад', callback_data: `user_${userId}` }]);

      await ctx.reply('Выберите обращение:', kb(keyboard));
    } catch (error) {
      logger.error(`Error fetching user requests: ${error.message}`, { stack: error.stack });
      await replyWithBack(ctx, 'Ошибка при получении обращений пользователя.', 'scene_user_management');
    }
  });

  scene.action(/^search_ticket_input_(\d+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const userId = ctx.match[1];
      await ctx.reply(
        'Введите ID обращения (только цифры):',
        kb([[{ text: 'Назад', callback_data: `user_requests_${userId}` }]]),
      );
      // eslint-disable-next-line no-param-reassign
      ctx.session.waitingForUserInput = true;
      // eslint-disable-next-line no-param-reassign
      ctx.session.action = `search_ticket_${userId}`;
    } catch (error) {
      logger.error(`Error in search_ticket_input: ${error.message}`, { stack: error.stack });
      await replyWithBack(ctx, 'Ошибка при подготовке поиска обращения.', 'scene_user_management');
    }
  });

  scene.action(/^ticket_(\d+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const ticketId = ctx.match[1];
      const details = await getTicketDetails(ticketId);
      if (!details) {
        await replyWithBack(ctx, 'Обращение не найдено.', 'scene_user_management');
        return;
      }
      const { ticket, files } = details;
      await showTicketView(ctx, ticket, files);
    } catch (error) {
      logger.error(`Error fetching ticket details: ${error.message}`, { stack: error.stack });
      await replyWithBack(ctx, 'Ошибка при получении данных обращения.', 'scene_user_management');
    }
  });

  scene.action(/^download_ticket_(\d+)$/, async (ctx) => {
    try {
      const ticketId = ctx.match[1];
      const details = await getTicketDetails(ticketId);
      if (!details) {
        await ctx.answerCbQuery('Обращение не найдено');
        await replyWithBack(ctx, 'Обращение не найдено.', 'scene_user_management');
        return;
      }
      const { ticket, files } = details;

      const archive = archiver('zip', { zlib: { level: 9 } });
      const stream = new PassThrough();
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      archive.pipe(stream);

      const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleString('ru-RU') : 'Не указано';
      let info =
        `Организация: ${ticket.organization || 'Не указано'}\n` +
        `Филиал: ${ticket.branch || 'Не указано'}\n` +
        `Классификация: ${ticket.classification}\n` +
        `Дата отправки: ${createdAt}\n\n` +
        `Текст обращения:\n${ticket.message}\n\n` +
        'Вложения:\n';
      if (files && files.length) {
        info += files.map((f, i) => `${i + 1}. ${path.basename(f.path || `file_${f.id || ''}`)} - ${f.title || ''}`).join('\n');
      } else {
        info += 'Нет вложений';
      }

      archive.append(info, { name: 'request.txt' });

      if (files && files.length) {
        for (const file of files) {
          const filename = path.basename(file.path || `file_${file.id || ''}`);
          archive.append(file.data, { name: filename });
        }
      }

      await archive.finalize();
      const buffer = Buffer.concat(chunks);
      await ctx.replyWithDocument({ source: buffer, filename: `ticket_${ticket.id}.zip` });
    } catch (error) {
      logger.error(`Error creating ticket archive: ${error.message}`, { stack: error.stack });
      await replyWithBack(ctx, 'Ошибка при создании архива.', 'scene_user_management');
    }
  });

  scene.action(/^change_role_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Функция пока в разработке');
  });

  // === text input (role + search by id) ===
  scene.on('text', async (ctx) => {
    // 0) если это slash-команда — не трогаем, пусть её обработают глобальные хендлеры (/start, /menu, ...)
    const rawText = (ctx.message?.text || '').trim();
    if (rawText.startsWith('/')) {
      // сброс «ожиданий ввода», чтобы не висело состояние
      // eslint-disable-next-line no-param-reassign
      ctx.session.waitingForUserInput = false;
      delete ctx.session.action;
      return;
    }

    // 1) если editScene отсутствует — уходим в начальную сцену
    const editScene = getEditScene(ctx);
    if (typeof editScene === 'undefined') {
      logger.info('editScene is undefined inside user_settings, redirecting to welcome', {
        user: ctx.from?.id,
      });

      // сбрасываем ожидания и выходим из текущей сцены
      // eslint-disable-next-line no-param-reassign
      ctx.session.waitingForUserInput = false;
      delete ctx.session.action;

      await ctx.scene.leave().catch(() => {});
      await ctx.scene.enter('welcome');
      return;
    }

    // 2) update role
    if (ctx.session.action && ctx.session.action.startsWith('update_role_')) {
      try {
        const userId = ctx.session.action.split('_')[2];
        const newRole = rawText;
        if (!newRole) {
          await replyWithBack(ctx, 'Ошибка: введите корректное значение роли.', `user_${userId}`);
          return;
        }
        await updateUserRole(userId, newRole);
        await ctx.reply(
          `Роль пользователя успешно изменена на ${newRole}.`,
          kb([[{ text: 'Назад', callback_data: `user_${userId}` }]]),
        );
        delete ctx.session.action;
      } catch (error) {
        logger.error(`Error in updating user role: ${error.message}`, { stack: error.stack });
        await replyWithBack(ctx, 'Ошибка при обновлении роли.', 'scene_user_management');
      }
      return;
    }

    // 3) search ticket by id (digits only)
    if (ctx.session.action && ctx.session.action.startsWith('search_ticket_')) {
      const userId = ctx.session.action.split('_')[2];
      try {
        const digits = rawText.replace(/\D/g, ''); // только цифры

        if (!digits) {
          await replyWithBack(
            ctx,
            'Ошибка: ID должен содержать только цифры.',
            `user_requests_${userId}`,
            [[{ text: 'Повторить ввод', callback_data: `search_ticket_input_${userId}` }]],
          );
          return;
        }

        const ticketId = Number(digits);
        const details = await getTicketDetails(ticketId);

        if (!details || String(details.ticket.user_id) !== String(userId)) {
          await replyWithBack(
            ctx,
            'Обращение не найдено у этого пользователя.',
            `user_requests_${userId}`,
            [[{ text: 'Повторить ввод', callback_data: `search_ticket_input_${userId}` }]],
          );
          return;
        }

        const { ticket, files } = details;
        await showTicketView(ctx, ticket, files);

        // сбрасываем ожидание ввода после удачного поиска
        // eslint-disable-next-line no-param-reassign
        ctx.session.waitingForUserInput = false;
        delete ctx.session.action;
      } catch (error) {
        logger.error(`Error searching ticket by id: ${error.message}`, { stack: error.stack });
        await replyWithBack(
          ctx,
          'Ошибка при поиске обращения.',
          `user_requests_${userId}`,
          [[{ text: 'Повторить ввод', callback_data: `search_ticket_input_${userId}` }]],
        );
      }
    }
  });

  scene.action(/^block_user_(\d+)$/, async (ctx) => {
    try {
      const userId = ctx.match[1];
      const user = await blockUser(userId);
      await ctx.answerCbQuery();
      await ctx.reply(
        `Пользователь ${user.is_blocked ? 'заблокирован' : 'разблокирован'}.`,
        kb([[{ text: 'Назад', callback_data: `user_${userId}` }]]),
      );
    } catch (error) {
      logger.error(`Error blocking user: ${error.message}`, { stack: error.stack });
      await replyWithBack(ctx, 'Ошибка при изменении статуса пользователя.', 'scene_user_management');
    }
  });

  scene.action(/^delete_user_(\d+)$/, async (ctx) => {
    try {
      const userId = ctx.match[1];
      const result = await deleteUser(userId);
      await ctx.answerCbQuery();
      if (result.success) {
        await replyWithBack(ctx, 'Пользователь удалён.', 'scene_user_management');
      } else {
        await replyWithBack(ctx, 'Пользователь не найден.', 'scene_user_management');
      }
    } catch (error) {
      logger.error(`Error deleting user: ${error.message}`, { stack: error.stack });
      await replyWithBack(ctx, 'Ошибка при удалении пользователя.', 'scene_user_management');
    }
  });
}
