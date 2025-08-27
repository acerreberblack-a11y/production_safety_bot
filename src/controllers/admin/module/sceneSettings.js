
import ConfigLoader from '../../../utils/configLoader.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from '../../../utils/logger.js';

// Определяем пути
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assetsDir = path.join(__dirname, '..', '..', '..', 'assets', 'welcome');

export default function sceneSettings(scene) {
    const ensureAssetsDir = async () => {
        try {
            await fs.mkdir(assetsDir, { recursive: true });
        } catch (error) {
            logger.error(`Error creating assets directory: ${error.message}`, { stack: error.stack });
            throw new Error('Не удалось создать директорию для хранения картинок.');
        }
    };

    // Обработка "Настройка сцен" — показываем все сцены
    scene.action('scene_settings', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Выберите сцену для настройки:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Стартовая', callback_data: 'scene_welcome' }],
                        [{ text: 'Описание', callback_data: 'scene_description' }],
                        [{ text: 'Тип обращения', callback_data: 'scene_ticketType' }],
                        [{ text: 'Email авторизация', callback_data: 'scene_emailAuth' }],
                        [{ text: 'Организация', callback_data: 'scene_organization' }],
                        [{ text: 'Классификация', callback_data: 'scene_classification' }],
                        [{ text: 'Описание проблемы', callback_data: 'scene_reportIssue' }],
                        [{ text: 'Admin', callback_data: 'scene_admin' }],
                        [{ text: 'Назад', callback_data: 'back_to_main' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in scene_settings action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек сцен.');
        }
    });

    // Обработка выбора сцены Welcome
    scene.action('scene_welcome', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Выберите действие для сцены Welcome:', {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Изменить текст', callback_data: 'edit_text_welcome' },
                            { text: 'Изменить картинку', callback_data: 'edit_image_welcome' }
                        ],
                        [{ text: 'Назад', callback_data: 'scene_settings' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in scene_welcome action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек сцены Welcome.');
        }
    });

    // Обработка выбора сцены Description
    scene.action('scene_description', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Выберите действие для сцены Description:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Изменить текст', callback_data: 'edit_text_description' }],
                        [{ text: 'Назад', callback_data: 'scene_settings' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in scene_description action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек сцены Description.');
        }
    });

    // Обработка выбора сцены ticketType
    scene.action('scene_ticketType', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Выберите действие для сцены ticketType:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Изменить текст', callback_data: 'edit_text_ticketType' }],
                        [{ text: 'Назад', callback_data: 'scene_settings' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in scene_ticketType action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек сцены ticketType.');
        }
    });

    // Обработка выбора сцены emailAuth
    scene.action('scene_emailAuth', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Выберите действие для сцены emailAuth:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Изменить текст', callback_data: 'edit_text_emailAuth' }],
                        [{ text: 'Назад', callback_data: 'scene_settings' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in scene_emailAuth action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек сцены emailAuth.');
        }
    });

    // Обработка выбора сцены organization
    scene.action('scene_organization', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Выберите действие для сцены organization:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Изменить текст', callback_data: 'edit_text_organization' }],
                        [{ text: 'Назад', callback_data: 'scene_settings' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in scene_organization action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек сцены organization.');
        }
    });

    // Обработка выбора сцены classification
    scene.action('scene_classification', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Выберите действие для сцены classification:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Изменить текст', callback_data: 'edit_text_classification' }],
                        [{ text: 'Назад', callback_data: 'scene_settings' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in scene_classification action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек сцены classification.');
        }
    });

    // Обработка выбора сцены reportIssue
    scene.action('scene_reportIssue', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Выберите действие для сцены reportIssue:', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Изменить текст', callback_data: 'edit_text_reportIssue' }],
                        [{ text: 'Назад', callback_data: 'scene_settings' }]
                    ]
                }
            });
        } catch (error) {
            logger.error(`Error in scene_reportIssue action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек сцены reportIssue.');
        }
    });

    // Обработка выбора сцены Admin
    scene.action('scene_admin', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Для сцены Admin нет текста в конфиге. Это интерфейс администратора.\n\nЕсли хотите добавить текст, напишите его ниже. Если нет, нажмите "Отмена".', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Отмена', callback_data: 'scene_settings' }]
                    ]
                }
            });
            ctx.session.editScene = 'admin';
        } catch (error) {
            logger.error(`Error in scene_admin action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек сцены Admin.');
        }
    });

    // Обработка изменения текста для Welcome
    scene.action('edit_text_welcome', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            const currentText = config.controllers.welcome.text || 'Текст не задан';

            await ctx.replyWithHTML(
                `Текущий текст сцены Welcome:\n\n${currentText}\n\nЕсли хотите изменить текст, напишите его ниже. Если нет, нажмите "Отмена".`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Отмена', callback_data: 'scene_welcome' }]
                        ]
                    }
                }
            );
            ctx.session.editScene = 'welcome';
        } catch (error) {
            logger.error(`Error in edit_text_welcome: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении текста сцены Welcome.');
        }
    });

    // Обработка изменения текста для Description
    scene.action('edit_text_description', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            const currentText = config.controllers.description.text || 'Текст не задан';

            await ctx.replyWithHTML(
                `Текущий текст сцены Description:\n\n${currentText}\n\nЕсли хотите изменить текст, напишите его ниже. Если нет, нажмите "Отмена".`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Отмена', callback_data: 'scene_description' }]
                        ]
                    }
                }
            );
            ctx.session.editScene = 'description';
        } catch (error) {
            logger.error(`Error in edit_text_description: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении текста сцены Description.');
        }
    });

    // Обработка изменения текста для ticketType
    scene.action('edit_text_ticketType', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            const currentText = config.controllers.ticketType.text || 'Текст не задан';

            await ctx.replyWithHTML(
                `Текущий текст сцены ticketType:\n\n${currentText}\n\nЕсли хотите изменить текст, напишите его ниже. Если нет, нажмите "Отмена".`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Отмена', callback_data: 'scene_ticketType' }]
                        ]
                    }
                }
            );
            ctx.session.editScene = 'ticketType';
        } catch (error) {
            logger.error(`Error in edit_text_ticketType: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении текста сцены ticketType.');
        }
    });

    // Обработка изменения текста для emailAuth
    scene.action('edit_text_emailAuth', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            const currentText = config.controllers.emailAuth.text || 'Текст не задан';
            await ctx.replyWithHTML(
                `Текущий текст сцены emailAuth:\n\n${currentText}\n\nЕсли хотите изменить текст, напишите его ниже. Если нет, нажмите "Отмена".`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Отмена', callback_data: 'scene_emailAuth' }]
                        ]
                    }
                }
            );
            ctx.session.editScene = 'emailAuth';
        } catch (error) {
            logger.error(`Error in edit_text_emailAuth: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении текста сцены emailAuth.');
        }
    });

    // Обработка изменения текста для organization
    scene.action('edit_text_organization', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            const currentText = config.controllers.organization.text || 'Текст не задан';
            await ctx.replyWithHTML(
                `Текущий текст сцены organization:\n\n${currentText}\n\nЕсли хотите изменить текст, напишите его ниже. Если нет, нажмите "Отмена".`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Отмена', callback_data: 'scene_organization' }]
                        ]
                    }
                }
            );
            ctx.session.editScene = 'organization';
        } catch (error) {
            logger.error(`Error in edit_text_organization: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении текста сцены organization.');
        }
    });

    // Обработка изменения текста для classification
    scene.action('edit_text_classification', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            const currentText = config.controllers.classification.text || 'Текст не задан';
            await ctx.replyWithHTML(
                `Текущий текст сцены classification:\n\n${currentText}\n\nЕсли хотите изменить текст, напишите его ниже. Если нет, нажмите "Отмена".`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Отмена', callback_data: 'scene_classification' }]
                        ]
                    }
                }
            );
            ctx.session.editScene = 'classification';
        } catch (error) {
            logger.error(`Error in edit_text_classification: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении текста сцены classification.');
        }
    });

    // Обработка изменения текста для reportIssue
    scene.action('edit_text_reportIssue', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            const currentText = config.controllers.reportIssue.text || 'Текст не задан';
            await ctx.replyWithHTML(
                `Текущий текст сцены reportIssue:\n\n${currentText}\n\nЕсли хотите изменить текст, напишите его ниже. Если нет, нажмите "Отмена".`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Отмена', callback_data: 'scene_reportIssue' }]
                        ]
                    }
                }
            );
            ctx.session.editScene = 'reportIssue';
        } catch (error) {
            logger.error(`Error in edit_text_reportIssue: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении текста сцены reportIssue.');
        }
    });

    // Обработка изменения картинки для Welcome
    scene.action('edit_image_welcome', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            const imageConfig = config.controllers.welcome.image || { path: 'Не задан', enabled: false };
            const currentPath = imageConfig.path;
            const enabled = imageConfig.enabled ? 'Включена' : 'Выключена';
            const toggleAction = imageConfig.enabled ? 'disable_image_welcome' : 'enable_image_welcome';
            const toggleText = imageConfig.enabled ? 'Выключить' : 'Включить';

            await ctx.reply(
                `Текущая настройка картинки для Welcome:\nПуть: ${currentPath}\nСтатус: ${enabled}\n\nОтправьте новую картинку, чтобы загрузить её, или используйте кнопки ниже.`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Загрузить новую картинку', callback_data: 'upload_image_welcome' }],
                            [{ text: toggleText, callback_data: toggleAction }],
                            [{ text: 'Назад', callback_data: 'scene_welcome' }]
                        ]
                    }
                }
            );
        } catch (error) {
            logger.error(`Error in edit_image_welcome: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при отображении настроек картинки.');
        }
    });

    // Обработка загрузки новой картинки для Welcome
    scene.action('upload_image_welcome', async (ctx) => {
        try {
            await ctx.deleteMessage();
            await ctx.reply('Пожалуйста, отправьте картинку для сцены Welcome. Если передумали, нажмите "Отмена".', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Отмена', callback_data: 'edit_image_welcome' }]
                    ]
                }
            });
            ctx.session.waitingForImage = 'welcome';
        } catch (error) {
            logger.error(`Error in upload_image_welcome: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при запросе загрузки картинки.');
        }
    });

    // Обработка включения/выключения картинки для Welcome
    scene.action('enable_image_welcome', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            config.controllers.welcome.image.enabled = true;
            await ConfigLoader.saveConfig(config);
            await ctx.reply('Картинка для сцены Welcome включена.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад', callback_data: 'edit_image_welcome' }]
                    ]
                }
            });
            logger.info(`Image for Welcome scene enabled by user ${ctx.from.id}`);
        } catch (error) {
            logger.error(`Error in enable_image_welcome: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при включении картинки.');
        }
    });

    scene.action('disable_image_welcome', async (ctx) => {
        try {
            await ctx.deleteMessage();
            const config = await ConfigLoader.loadConfig();
            config.controllers.welcome.image.enabled = false;
            await ConfigLoader.saveConfig(config);
            await ctx.reply('Картинка для сцены Welcome выключена.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад', callback_data: 'edit_image_welcome' }]
                    ]
                }
            });
            logger.info(`Image for Welcome scene disabled by user ${ctx.from.id}`);
        } catch (error) {
            logger.error(`Error in disable_image_welcome: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при выключении картинки.');
        }
    });

    // Обработка получения картинки
    scene.on('photo', async (ctx) => {
        if (ctx.session.waitingForImage === 'welcome') {
            try {
                // Получаем самую большую версию фото
                const photo = ctx.message.photo[ctx.message.photo.length - 1];
                const fileId = photo.file_id;
                const file = await ctx.telegram.getFile(fileId);
                const fileUrl = await ctx.telegram.getFileLink(fileId);

                // Создаём уникальное имя файла
                const timestamp = Date.now();
                const fileName = `welcome_${timestamp}.jpg`;
                const filePath = path.join(assetsDir, fileName);

                // Создаём директорию, если её нет
                await ensureAssetsDir();

                // Скачиваем и сохраняем файл
                const response = await fetch(fileUrl);
                const buffer = Buffer.from(await response.arrayBuffer());
                await fs.writeFile(filePath, buffer);

                // Обновляем конфигурацию
                const config = await ConfigLoader.loadConfig();
                config.controllers.welcome.image = {
                    enabled: true, // Включаем картинку при загрузке
                    path: filePath
                };
                await ConfigLoader.saveConfig(config);

                await ctx.reply('Картинка успешно загружена и включена для сцены Welcome.', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'edit_image_welcome' }]
                        ]
                    }
                });

                logger.info(`Image uploaded for Welcome scene by user ${ctx.from.id}, saved to ${filePath}`);
                delete ctx.session.waitingForImage;
            } catch (error) {
                logger.error(`Error in photo handler: ${error.message}`, { stack: error.stack });
                await ctx.reply('Извините, произошла ошибка при загрузке картинки.', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'edit_image_welcome' }]
                        ]
                    }
                });
            }
        }
    });
}