import logger from '../../../utils/logger.js';
import { searchUsers, getUserDetails, updateUserRole, blockUser, deleteUser, selectAllRoleUsers } from '../../../../db/users.js';

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

            await ctx.reply(`Информация о пользователе:\n\nID: ${user.id}\nИмя: ${user.firstName} ${user.lastName}\nUsername: ${user.username}\nРоль: ${user.role}\nСтатус: ${user.status}`, {
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

    scene.action(/^user_requests_(\d+)$/),  async (ctx) => {
        return await ctx.answerCbQuery('Функция пока в разработке');
    }

    scene.action(/^change_role_(\d+)$/, async (ctx) => {
        try {
            return await ctx.answerCbQuery('Функция пока в разработке');
            const userId = ctx.match[1];
            const user = await getUserDetails(userId);

            if (!user) {
                await ctx.reply('Ошибка: пользователь не найден.');
                return;
            }

            const roles = await selectAllRoleUsers();

            const keyboard = [...roles.map(roleItem => [
                {
                    text: roleItem.title,
                    callback_data: `change_role_${roleItem.id}`
                }
            ]),
            [{ text: 'Назад', callback_data: 'back_to_main' }]
            ];

            await ctx.reply('Введите новую роль для пользователя:', keyboard);
            ctx.session.action = `update_role_${userId}`;
        } catch (error) {
            logger.error(`Error in changing role: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при изменении роли пользователя.');
        }
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
            return await ctx.answerCbQuery('Функция пока в разработке');
            const userId = ctx.match[1];
            const user = await getUserDetails(userId);

            if (!user) {
                await ctx.reply('Ошибка: пользователь не найден.');
                return;
            }

            await blockUser(userId);
            await ctx.reply('Пользователь заблокирован.');
        } catch (error) {
            logger.error(`Error in blocking user: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при блокировке пользователя.');
        }
    });

    scene.action(/^delete_user_(\d+)$/, async (ctx) => {
        try {
            return await ctx.answerCbQuery('Функция пока в разработке');
            const userId = ctx.match[1];
            const user = await getUserDetails(userId);

            if (!user) {
                await ctx.reply('Ошибка: пользователь не найден.');
                return;
            }

            await deleteUser(userId);
            await ctx.reply('Пользователь удален.');
        } catch (error) {
            logger.error(`Error in deleting user: ${error.message}`, { stack: error.stack });
            await ctx.reply('Ошибка при удалении пользователя.');
        }
    });
}
