// controllers/admin/module/emailSettings.js
import logger from '../../../utils/logger.js';
import ConfigLoader from '../../../utils/configLoader.js';

import { sendCodeEmail } from '../../../utils/emailConfig.js'

export default function emailSettings(scene) {
    // Обработка "Настройка email"
    scene.action('email_settings', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            logger.info('Loaded email config:', { email: config.general.email });
            const { host, port, user,  password, secure, rejectUnauthorized} = config.general.email || {};

            const keyboard = [
                [
                    {
                        text: `📧 Хост: ${host || 'не задан'}`,
                        callback_data: 'edit_email_host'
                    }
                ],
                [
                    {
                        text: `🔌 Порт: ${port || 25}`,
                        callback_data: 'edit_email_port'
                    }
                ],
                [
                    {
                        text: `👤 Пользователь: ${user || 'не задан'}`,
                        callback_data: 'edit_email_user'
                    }
                ],
                [
                    {
                        text: `🔒 Пароль: ${password ? '******' : 'не задан'}`,
                        callback_data: 'edit_email_password'
                    }
                ],
                [
                    {
                        text: `🔐 Secure: ${secure ? 'Да' : 'Нет'}`,
                        callback_data: 'toggle_email_secure'
                    }
                ],
                [
                    {
                        text: `⚠️ Reject Unauthorized: ${rejectUnauthorized ? 'Да' : 'Нет'}`,
                        callback_data: 'toggle_email_reject'
                    }
                ],
                [
                    {
                        text: 'Тест отправки',
                        callback_data: 'test_email_settings'
                    }
                ],
                [
                    {
                        text: 'Назад',
                        callback_data: 'back_to_main'
                    }
                ]
            ];

            await ctx.reply('Настройки email:', {
                reply_markup: { inline_keyboard: keyboard }
            });
        } catch (error) {
            logger.error(`Error in email_settings action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек email.');
        }
    });

    // Обработка изменения хоста
    scene.action('edit_email_host', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Введите новый хост для email (например, smtp.gmail.com):', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Отмена', callback_data: 'email_settings' }]
                    ]
                }
            });
            ctx.session.action = 'edit_email_host';
        } catch (error) {
            logger.error(`Error in edit_email_host action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при попытке изменить хост.');
        }
    });

    // Обработка изменения порта
    scene.action('edit_email_port', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Введите новый порт для email (например, 587 или 465):', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Отмена', callback_data: 'email_settings' }]
                    ]
                }
            });
            ctx.session.action = 'edit_email_port';
        } catch (error) {
            logger.error(`Error in edit_email_port action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при попытке изменить порт.');
        }
    });

    // Обработка изменения пользователя
    scene.action('edit_email_user', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Введите нового пользователя для email (например, user@domain.com):', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Отмена', callback_data: 'email_settings' }]
                    ]
                }
            });
            ctx.session.action = 'edit_email_user';
        } catch (error) {
            logger.error(`Error in edit_email_user action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при попытке изменить пользователя.');
        }
    });

    // Обработка изменения пароля
    scene.action('edit_email_password', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Введите новый пароль для email:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Отмена', callback_data: 'email_settings' }]
                    ]
                }
            });
            ctx.session.action = 'edit_email_password';
        } catch (error) {
            logger.error(`Error in edit_email_password action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при попытке изменить пароль.');
        }
    });

    // Обработка переключения secure
    scene.action('toggle_email_secure', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            config.general.email.secure = !config.general.email.secure;
            await ConfigLoader.saveConfig(config);

            logger.info('Toggled email secure setting', { secure: config.general.email.secure });
            await ctx.reply(`Secure соединение ${config.general.email.secure ? 'включено' : 'выключено'}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад', callback_data: 'email_settings' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in toggle_email_secure action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при переключении secure.');
        }
    });

    // Обработка переключения rejectUnauthorized
    scene.action('toggle_email_reject', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            config.general.email.rejectUnauthorized = !config.general.email.rejectUnauthorized;
            await ConfigLoader.saveConfig(config);

            logger.info('Toggled email rejectUnauthorized setting', { rejectUnauthorized: config.general.email.rejectUnauthorized });
            await ctx.reply(`Reject Unauthorized ${config.general.email.rejectUnauthorized ? 'включено' : 'выключено'}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад', callback_data: 'email_settings' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in toggle_email_reject action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при переключении rejectUnauthorized.');
        }
    });

    // Обработка теста отправки
    scene.action('test_email_settings', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            const { host, user, password } = config.general?.email;

            if (!host || !user || !password) {
                throw new Error('Не все обязательные параметры email настроены');
            }

            logger.info(`Testing email settings: host:${host}, user: ${user}, pass: ${password}`);

            try {

                await ctx.reply('Выполняю тестирование почтового ящика. Ожидайте...', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'email_settings' }]
                        ]
                    }
                });

                await sendCodeEmail(user, 'Это тестовое сообщение, просьба не отвечать на него!');
                await ctx.reply('Тест настроек email успешно выполнен!', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'email_settings' }]
                        ]
                    }
                });
            } catch (e) {
                logger.error(`Ошибка при отправке тестового email: ${e.message}`, { stack: e.stack });
                await ctx.reply('Тест настроек email завершился неудачей!\nПроверьте параметры почты.', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'email_settings' }]
                        ]
                    }
                });
            }
        } catch (error) {
            logger.error(`Ошибка в test_email_settings: ${error.message}`, { stack: error.stack });
            await ctx.reply(`Ошибка при тестировании email: ${error.message}`);
        }
    });


    // Обработка текстового ввода для всех действий
    scene.on('text', async (ctx) => {
        const action = ctx.session.action;
        if (!action || !action.startsWith('edit_email_')) return;

        try {
            const config = await ConfigLoader.loadConfig();
            const text = ctx.message.text.trim();

            switch (action) {
                case 'edit_email_host':
                    config.general.email.host = text;
                    await ConfigLoader.saveConfig(config);
                    await ctx.reply('Хост успешно обновлен!', {
                        reply_markup: {
                            inline_keyboard: [[{ text: 'Назад', callback_data: 'email_settings' }]]
                        }
                    });
                    break;

                case 'edit_email_port':
                    const port = Number(text);
                    if (isNaN(port) || port < 1 || port > 65535) {
                        throw new Error('Порт должен быть числом от 1 до 65535');
                    }
                    config.general.email.port = port;
                    await ConfigLoader.saveConfig(config);
                    await ctx.reply('Порт успешно обновлен!', {
                        reply_markup: {
                            inline_keyboard: [[{ text: 'Назад', callback_data: 'email_settings' }]]
                        }
                    });
                    break;

                case 'edit_email_user':
                    config.general.email.user = text;
                    await ConfigLoader.saveConfig(config);
                    await ctx.reply('Пользователь успешно обновлен!', {
                        reply_markup: {
                            inline_keyboard: [[{ text: 'Назад', callback_data: 'email_settings' }]]
                        }
                    });
                    break;

                case 'edit_email_password':
                    config.general.email.password = text;
                    await ConfigLoader.saveConfig(config);
                    await ctx.reply('Пароль успешно обновлен!', {
                        reply_markup: {
                            inline_keyboard: [[{ text: 'Назад', callback_data: 'email_settings' }]]
                        }
                    });
                    break;

                default:
                    return;
            }

            logger.info(`Updated email setting: ${action}`, { value: text });
            delete ctx.session.action;

        } catch (error) {
            logger.error(`Error processing email setting ${action}: ${error.message}`, { stack: error.stack });
            await ctx.reply(`Ошибка: ${error.message}`, {
                reply_markup: {
                    inline_keyboard: [[{ text: 'Назад', callback_data: 'email_settings' }]]
                }
            });
        }
    });
}