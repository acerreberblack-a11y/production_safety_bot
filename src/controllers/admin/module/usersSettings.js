import logger from '../../../utils/logger.js';
import {
    searchUsers,
    getUserDetails,
    updateUserRole,
    blockUser,
    deleteUser,
    selectAllRoleUsers,
    getTicketsByUserId,
    getTicketDetails,
} from '../../../../db/users.js';
import archiver from 'archiver';
import path from 'path';
import { PassThrough } from 'stream';

export default function user_settings(scene) {
    scene.action('user_settings', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Введите ID, firstName, lastName или username для поиска пользователей:', {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Отмена', callback_data: 'back_to_main' }]]
                }
            });
            ctx.session.waitingForUserInput = true;
            ctx.session.action = `find_user_for_db`;
        } catch (error) {
            logger.error(`Error in user_settings: ${error.message}`, { stack: error.stack });
            await ctx.reply('Произошла ошибка при открытии сцены управления пользователями.');
        }
    });

    scene.action(/^user_(\d+)$/, async (ctx) => {
        try {
            if (!ctx.match || !ctx.match[1]) {
                await ctx.reply('Ошибка: некорректный идентификатор пользователя.');
                return;
            }

            const userId = ctx.match[1];
            const user = await getUserDetails(userId);

            if (!user) {
                await ctx.reply('Ошибка: пользователь не найден.');
                return;
            }

            await ctx.reply(`Информация о пользователе:\n\nID: ${user.id}\nИмя: ${user.firstName || ''} ${user.lastName || ''}\nUsername: ${user.username || ''}\nРоль: ${user.role_id}\nСтатус: ${user.is_blocked ? 'Заблокирован' : 'Активен'}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Обращения', callback_data: `user_requests_${user.id}` }],
                        [{ text: 'Изменить роль', callback_data: `change_role_${user.id}` }],
                        [{ text: 'Заблокировать', callback_data: `block_user_${user.id}` }],
                        [{ text: 'Удалить', callback_data: `delete_user_${user.id}` }],
                        [{ text: 'Назад', callback_data: 'scene_user_management' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in user selection: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при получении данных пользователя.');
        }
    });

    scene.action(/^user_requests_(\d+)$/, async (ctx) => {
        try {
            await ctx.deleteMessage();
            const userId = ctx.match[1];
            const tickets = await getTicketsByUserId(userId);

            if (!tickets.length) {
                await ctx.reply('У пользователя нет обращений.', {
                    reply_markup: {
                        inline_keyboard: [[{ text: 'Назад', callback_data: `user_${userId}` }]]
                    }
                });
                return;
            }

            const keyboard = tickets.map(t => [{ text: `Обращение ${t.id}`, callback_data: `ticket_${t.id}` }]);
            keyboard.push([{ text: 'Поиск по ID', callback_data: `search_ticket_input_${userId}` }]);
            keyboard.push([{ text: 'Назад', callback_data: `user_${userId}` }]);

            await ctx.reply('Выберите обращение:', {
                reply_markup: { inline_keyboard: keyboard }
            });
        } catch (error) {
            logger.error(`Error fetching user requests: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при получении обращений пользователя.');
        }
    });
    scene.action(/^search_ticket_input_(\d+)$/, async (ctx) => {
        try {
            await ctx.deleteMessage();
            const userId = ctx.match[1];
            await ctx.reply('Введите ID обращения:', {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Назад', callback_data: `user_requests_${userId}` }]]
                }
            });
            ctx.session.waitingForUserInput = true;
            ctx.session.action = `search_ticket_${userId}`;
        } catch (error) {
            logger.error(`Error in search_ticket_input: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при подготовке поиска обращения.');
        }
    });
    scene.action(/^ticket_(\d+)$/, async (ctx) => {
        try {
            await ctx.deleteMessage();
            const ticketId = ctx.match[1];
            const details = await getTicketDetails(ticketId);
            if (!details) {
                await ctx.reply('Обращение не найдено.');
                return;
            }
            const { ticket, files } = details;

            const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleString('ru-RU') : 'Не указано';
            await ctx.reply(
                `Обращение #${ticket.id}\nОрганизация: ${ticket.organization || 'Не указано'}\nФилиал: ${ticket.branch || 'Не указано'}\nКлассификация: ${ticket.classification}\nДата отправки: ${createdAt}\n\n${ticket.message}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Скачать архив', callback_data: `download_ticket_${ticket.id}` }],
                            [{ text: 'Назад', callback_data: `user_requests_${ticket.user_id}` }]
                        ]
                    }
                }
            );

            if (files && files.length) {
                for (const file of files) {
                    const filename = path.basename(file.path);
                    await ctx.replyWithDocument({ source: Buffer.from(file.data), filename }, { caption: file.title || '' });
                }
            }
        } catch (error) {
            logger.error(`Error fetching ticket details: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при получении данных обращения.');
        }
    });

    scene.action(/^download_ticket_(\d+)$/, async (ctx) => {
        try {
            const ticketId = ctx.match[1];
            const details = await getTicketDetails(ticketId);
            if (!details) {
                await ctx.answerCbQuery('Обращение не найдено');
                return;
            }
            const { ticket, files } = details;

            const archive = archiver('zip', { zlib: { level: 9 } });
            const stream = new PassThrough();
            const chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            archive.pipe(stream);
            const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleString('ru-RU') : 'Не указано';
            let info = `Организация: ${ticket.organization || 'Не указано'}\nФилиал: ${ticket.branch || 'Не указано'}\nКлассификация: ${ticket.classification}\nДата отправки: ${createdAt}\n\nТекст обращения:\n${ticket.message}\n\nВложения:\n`;
            if (files && files.length) {
                info += files.map((f, i) => `${i + 1}. ${path.basename(f.path)} - ${f.title || ''}`).join('\n');
            } else {
                info += 'Нет вложений';
            }

            archive.append(info, { name: 'request.txt' });

            if (files && files.length) {
                for (const file of files) {
                    const filename = path.basename(file.path);
                    archive.append(file.data, { name: filename });
                }
            }

            await archive.finalize();
            const buffer = Buffer.concat(chunks);
            await ctx.replyWithDocument({ source: buffer, filename: `ticket_${ticket.id}.zip` });
        } catch (error) {
            logger.error(`Error creating ticket archive: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при создании архива.');
        }
    });

    scene.action(/^change_role_(\d+)$/, async (ctx) => {
        return await ctx.answerCbQuery('Функция пока в разработке');
    });

    scene.on('text', async (ctx) => {
        if (ctx.session.action && ctx.session.action.startsWith('update_role_')) {
            try {
                const userId = ctx.session.action.split('_')[2];
                const newRole = ctx.message.text.trim();

                if (!newRole) {
                    await ctx.reply('Ошибка: введите корректное значение роли.');
                    return;
                }

                await updateUserRole(userId, newRole);
                await ctx.reply(`Роль пользователя успешно изменена на ${newRole}.`);
                delete ctx.session.action;
            } catch (error) {
                logger.error(`Error in updating user role: ${error.message}`, { stack: error.stack });
                await ctx.reply('Ошибка при обновлении роли.');
            }
        }
    });

    scene.action(/^block_user_(\d+)$/, async (ctx) => {
        try {
            const userId = ctx.match[1];
            const user = await blockUser(userId);
            await ctx.answerCbQuery();
            await ctx.reply(`Пользователь ${user.is_blocked ? 'заблокирован' : 'разблокирован'}.`);
        } catch (error) {
            logger.error(`Error blocking user: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при изменении статуса пользователя.');
        }
    });

    scene.action(/^delete_user_(\d+)$/, async (ctx) => {
        try {
            const userId = ctx.match[1];
            const result = await deleteUser(userId);
            await ctx.answerCbQuery();
            if (result.success) {
                await ctx.reply('Пользователь удалён.');
            } else {
                await ctx.reply('Пользователь не найден.');
            }
        } catch (error) {
            logger.error(`Error deleting user: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при удалении пользователя.');
        }
    });
}

