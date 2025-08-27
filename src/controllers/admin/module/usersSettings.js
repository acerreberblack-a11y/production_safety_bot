import logger from '../../../utils/logger.js';
import {
    searchUsers,
    getUserDetails,
    updateUserRole,
    blockUser,
    deleteUser,
    selectAllRoleUsers
} from '../../../../db/users.js';

export default function user_settings(scene) {
    scene.action('user_settings', async (ctx) => {
        try {
            await ctx.reply('Введите ID, firstName, lastName или username для поиска пользователей:', {
                reply_markup: {
                    keyboard: [['Отмена']],
                    resize_keyboard: true
                }
            });
            ctx.session.action = 'find_user_for_db';
        } catch (error) {
            logger.error(`Error in user_settings: ${error.message}`, { stack: error.stack });
            await ctx.reply('Произошла ошибка при открытии сцены управления пользователями.');
        }
    });

    scene.on('text', async (ctx) => {
        const text = ctx.message.text.trim();
        const action = ctx.session.action;

        try {
            if (action === 'find_user_for_db') {
                if (text === 'Отмена') {
                    delete ctx.session.action;
                    await ctx.reply('Вы вернулись в главное меню администратора.', {
                        reply_markup: { remove_keyboard: true }
                    });
                    await ctx.scene.reenter();
                    return;
                }

                const users = await searchUsers(text);
                if (users.length === 0) {
                    await ctx.reply('Пользователи не найдены. Попробуйте снова.');
                    return;
                }

                const keyboard = users.map((user) => [
                    { text: `${user.id} | ${user.username || user.firstName || ''}` }
                ]);
                keyboard.push([{ text: 'Назад' }]);

                await ctx.reply('Выберите пользователя:', {
                    reply_markup: {
                        keyboard,
                        resize_keyboard: true
                    }
                });
                ctx.session.action = 'select_user';
            } else if (action === 'select_user') {
                if (text === 'Назад') {
                    await ctx.reply('Введите ID, firstName, lastName или username для поиска пользователей:', {
                        reply_markup: {
                            keyboard: [['Отмена']],
                            resize_keyboard: true
                        }
                    });
                    ctx.session.action = 'find_user_for_db';
                    return;
                }

                const match = text.match(/^(\d+)/);
                if (!match) {
                    await ctx.reply('Некорректный выбор пользователя. Попробуйте снова.');
                    return;
                }

                const userId = match[1];
                const user = await getUserDetails(userId);
                if (!user) {
                    await ctx.reply('Пользователь не найден.');
                    return;
                }

                ctx.session.selectedUserId = userId;
                ctx.session.action = 'user_menu';

                await ctx.reply(
                    `Информация о пользователе:\n\nID: ${user.id}\nИмя: ${user.firstName} ${user.lastName}\nUsername: ${user.username}\nРоль: ${user.role}\nСтатус: ${user.status}`,
                    {
                        reply_markup: {
                            keyboard: [
                                ['Обращения'],
                                ['Изменить роль'],
                                ['Заблокировать'],
                                ['Удалить'],
                                ['Назад']
                            ],
                            resize_keyboard: true
                        }
                    }
                );
            } else if (action === 'user_menu') {
                if (text === 'Назад') {
                    ctx.session.selectedUserId = null;
                    await ctx.reply('Введите ID, firstName, lastName или username для поиска пользователей:', {
                        reply_markup: {
                            keyboard: [['Отмена']],
                            resize_keyboard: true
                        }
                    });
                    ctx.session.action = 'find_user_for_db';
                } else if (text === 'Обращения') {
                    await ctx.reply('Функция пока в разработке.');
                } else if (text === 'Изменить роль') {
                    const roles = await selectAllRoleUsers();
                    const rolesList = roles.map((r) => `${r.id} - ${r.title}`).join('\n');
                    await ctx.reply(`Доступные роли:\n${rolesList}\n\nВведите ID новой роли:`, {
                        reply_markup: {
                            keyboard: [['Отмена']],
                            resize_keyboard: true
                        }
                    });
                    ctx.session.action = 'update_role';
                } else if (text === 'Заблокировать') {
                    const user = await blockUser(ctx.session.selectedUserId);
                    await ctx.reply(
                        user.is_blocked ? 'Пользователь заблокирован.' : 'Пользователь разблокирован.'
                    );
                } else if (text === 'Удалить') {
                    const result = await deleteUser(ctx.session.selectedUserId);
                    await ctx.reply(
                        result.success ? 'Пользователь удален.' : 'Не удалось удалить пользователя.'
                    );
                } else {
                    await ctx.reply('Неизвестное действие. Выберите опцию из клавиатуры.');
                }
            } else if (action === 'update_role') {
                if (text === 'Отмена') {
                    await ctx.reply('Действие отменено.', {
                        reply_markup: {
                            keyboard: [
                                ['Обращения'],
                                ['Изменить роль'],
                                ['Заблокировать'],
                                ['Удалить'],
                                ['Назад']
                            ],
                            resize_keyboard: true
                        }
                    });
                    ctx.session.action = 'user_menu';
                    return;
                }

                const newRole = Number(text);
                if (isNaN(newRole)) {
                    await ctx.reply('Ошибка: введите корректный ID роли.');
                    return;
                }

                await updateUserRole(ctx.session.selectedUserId, newRole);
                await ctx.reply(`Роль пользователя успешно изменена на ${newRole}.`, {
                    reply_markup: {
                        keyboard: [
                            ['Обращения'],
                            ['Изменить роль'],
                            ['Заблокировать'],
                            ['Удалить'],
                            ['Назад']
                        ],
                        resize_keyboard: true
                    }
                });
                ctx.session.action = 'user_menu';
            }
        } catch (error) {
            logger.error(`Error in user settings: ${error.message}`, { stack: error.stack });
            await ctx.reply('Произошла ошибка. Попробуйте снова.');
        }
    });
}

