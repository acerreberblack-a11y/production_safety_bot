// controllers/admin/index.js
import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import ConfigLoader from '../../utils/configLoader.js';
import sceneSettings from './module/sceneSettings.js';
import orgSettings from './module/orgSettings.js';
import classificationSettings from './module/classificationSettings.js';
import emailSettings from './module/emailSettings.js';
import user_settings from './module/usersSettings.js';
import {searchUsers} from "../../../db/users.js";

const admin = new Scenes.BaseScene('admin');

// Главное меню администратора
admin.enter(async (ctx) => {
    try {
        await ctx.reply('Добро пожаловать в панель администратора!', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '1. Настройка сцен', callback_data: 'scene_settings' }],
                    [{ text: '2. Настройка организаций и фил-ов', callback_data: 'org_settings' }],
                    [{ text: '3. Настройка классификаций', callback_data: 'classification_settings' }],
                    [{ text: '4. Настройка email', callback_data: 'email_settings' }],
                    [{ text: '5. Управление пользователями', callback_data: 'user_settings' }],
                    [{ text: 'Выход', callback_data: 'scene_admin_exit' }]
                ]
            }
        });
        logger.info(`User ${ctx.from.id} entered admin scene`);
    } catch (error) {
        logger.error(`Error in admin scene enter: ${error.message}`, { stack: error.stack });
        await ctx.reply('Извините, произошла ошибка при входе в панель администратора.');
    }
});

// Обработка возврата в главное меню
admin.action('back_to_main', async (ctx) => {
    try {
        await ctx.deleteMessage();
        await ctx.scene.reenter();
        logger.info(`User ${ctx.from.id} returned to main menu from admin scene`);
    } catch (error) {
        logger.error(`Error in back_to_main action: ${error.message}`, { stack: error.stack });
        await ctx.reply('Извините, произошла ошибка при возвращении в главное меню.');
    }
});

// Обработка выхода из сцены
admin.action('scene_admin_exit', async (ctx) => {
    try {
        await ctx.deleteMessage();
        await ctx.scene.enter('welcome');
        logger.info(`User ${ctx.from.id} exited admin scene`);
    } catch (error) {
        logger.error(`Error in scene_admin_exit action: ${error.message}`, { stack: error.stack });
        await ctx.reply('Извините, произошла ошибка при выходе из панели администратора.');
    }
});

// Обработка ввода текста
admin.on('text', async (ctx) => {
    if (!ctx.session.action && !ctx.session.editScene) return;

    try {
        const text = ctx.message.text.trim();
        logger.info(`Processing text input: ${text}, action: ${ctx.session.action}, editScene: ${ctx.session.editScene}`);
        if (ctx.session.action) {
            const action = ctx.session.action;
            if (action === 'add_organization') {
                const [name, priorityStr] = text.split(',').map(part => part.trim());
                const priority = priorityStr !== undefined ? ConfigLoader.validatePriority(priorityStr) : 10;
                const orgKey = `org_${Date.now()}`;
                await ConfigLoader.addOrganization(orgKey, name, [], priority);
                logger.info(`Added organization with key ${orgKey} and name ${name} with priority ${priority}`);
                await ctx.reply(`Организация ${name} добавлена с приоритетом ${priority}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'org_settings' }]
                        ]
                    }
                });
            } else if (action.startsWith('edit_org_name_')) {
                const parts = action.split('_');
                const orgKey = parts.slice(3).join('_');
                logger.info(`Extracted orgKey: ${orgKey} from action: ${action}`);
                if (!orgKey.startsWith('org_')) {
                    throw new Error(`Некорректный ключ организации: ${orgKey}`);
                }
                const [newName, priorityStr] = text.split(',').map(part => part.trim());
                const priority = priorityStr !== undefined ? ConfigLoader.validatePriority(priorityStr) : null;
                await ConfigLoader.updateOrganizationName(orgKey, newName, priority);
                logger.info(`Updated organization name for key ${orgKey} to ${newName} with priority ${priority || 'default'}`);
                await ctx.reply(`Название организации обновлено на ${newName} с приоритетом ${priority || 'default'}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: `select_organization_${orgKey}` }]
                        ]
                    }
                });
            } else if (action.startsWith('edit_org_priority_')) {
                const parts = action.split('_');
                const orgKey = parts.slice(3).join('_');
                logger.info(`Extracted orgKey for edit_org_priority: ${orgKey} from action: ${action}`);
                const priority = ConfigLoader.validatePriority(text);
                await ConfigLoader.updateOrganizationPriority(orgKey, priority);
                logger.info(`Updated priority for organization ${orgKey} to ${priority}`);
                await ctx.reply(`Приоритет организации обновлён на ${priority}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: `select_organization_${orgKey}` }]
                        ]
                    }
                });
            } else if (action.startsWith('edit_branch_priority_')) {
                const parts = action.split('_');
                const orgKey = parts[3];
                const branchIndex = parseInt(parts[4]);
                logger.info(`Extracted orgKey: ${orgKey}, branchIndex: ${branchIndex} for edit_branch_priority`);
                const priority = ConfigLoader.validatePriority(text);
                await ConfigLoader.updateBranchPriority(orgKey, branchIndex, priority);
                logger.info(`Updated priority for branch at index ${branchIndex} in organization ${orgKey} to ${priority}`);
                await ctx.reply(`Приоритет филиала обновлён на ${priority}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: `select_organization_${orgKey}` }]
                        ]
                    }
                });
            } else if (action.startsWith('add_branch_')) {
                const parts = action.split('_');
                const orgKey = parts.slice(2).join('_');
                logger.info(`Extracted orgKey for add_branch: ${orgKey} from action: ${action}`);
                if (!orgKey.startsWith('org_')) {
                    throw new Error(`Некорректный ключ организации: ${orgKey}`);
                }
                let branchInput = text;
                let priority = 10;
                const priorityMatch = text.match(/,(\d+)/);
                if (priorityMatch) {
                    priority = ConfigLoader.validatePriority(priorityMatch[1]);
                    branchInput = text.replace(`,${priorityMatch[1]}`, '').trim();
                }
                const branchNames = branchInput.includes(';') ? branchInput.split(';').map(name => name.trim()).filter(name => name.length > 0) : [branchInput.trim()];
                logger.info(`Adding branches: ${branchNames.join(', ')} to organization ${orgKey} with priority ${priority}`);

                for (const branchName of branchNames) {
                    await ConfigLoader.addBranch(orgKey, branchName, priority);
                    logger.info(`Added branch ${branchName} to organization ${orgKey} with priority ${priority}`);
                }

                await ctx.reply(`Филиалы ${branchNames.join(', ')} добавлены с приоритетом ${priority}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: `select_organization_${orgKey}` }]
                        ]
                    }
                });
            } else if (action === 'add_classification') {
                let classInput = text;
                let priority = 10;
                const priorityMatch = text.match(/,(\d+)/);
                if (priorityMatch) {
                    priority = ConfigLoader.validatePriority(priorityMatch[1]);
                    classInput = text.replace(`,${priorityMatch[1]}`, '').trim();
                }
                const classNames = classInput.includes(';') ? classInput.split(';').map(name => name.trim()).filter(name => name.length > 0) : [classInput.trim()];
                logger.info(`Adding classifications: ${classNames.join(', ')} with priority ${priority}`);

                for (const className of classNames) {
                    const classKey = `class_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    await ConfigLoader.addClassification(classKey, className, priority);
                    logger.info(`Added classification ${className} with key ${classKey} and priority ${priority}`);
                }

                await ctx.reply(`Классификации ${classNames.join(', ')} добавлены с приоритетом ${priority}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'classification_settings' }]
                        ]
                    }
                });
            } else if (action.startsWith('edit_class_name_')) {
                const parts = action.split('_');
                const classKey = parts.slice(3).join('_');
                logger.info(`Extracted classKey: ${classKey} from action: ${action}`);
                if (!classKey.startsWith('class_')) {
                    throw new Error(`Некорректный ключ классификации: ${classKey}`);
                }
                const [newName, priorityStr] = text.split(',').map(part => part.trim());
                logger.debug(`New name: ${newName}, Priority string: ${priorityStr}`);
                const priority = priorityStr !== undefined && priorityStr !== '' ? ConfigLoader.validatePriority(priorityStr) : null;
                logger.debug(`Validated priority: ${priority}`);
                await ConfigLoader.updateClassificationName(classKey, newName, priority);
                logger.info(`Updated classification name for key ${classKey} to ${newName} with priority ${priority || 'default'}`);
                await ctx.reply(`Название классификации обновлено на ${newName} с приоритетом ${priority || 'default'}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: `select_classification_${classKey}` }]
                        ]
                    }
                });
            } else if (action.startsWith('edit_class_priority_')) {
                const parts = action.split('_');
                const classKey = parts.slice(3).join('_');
                logger.info(`Extracted classKey for edit_class_priority: ${classKey} from action: ${action}`);
                const priority = ConfigLoader.validatePriority(text);
                await ConfigLoader.updateClassificationPriority(classKey, priority);
                logger.info(`Updated priority for classification ${classKey} to ${priority}`);
                await ctx.reply(`Приоритет классификации обновлён на ${priority}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: `select_classification_${classKey}` }]
                        ]
                    }
                });
            } else if (action === 'edit_email_host') {
                await ConfigLoader.updateEmailSettings({ host: text });
                logger.info(`Updated email host to ${text}`);
                await ctx.reply(`Хост email обновлен на ${text}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'email_settings' }]
                        ]
                    }
                });
            } else if (action === 'edit_email_port') {
                const port = Number(text);
                await ConfigLoader.updateEmailSettings({ port });
                logger.info(`Updated email port to ${port}`);
                await ctx.reply(`Порт email обновлен на ${port}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'email_settings' }]
                        ]
                    }
                });
            } else if (action === 'edit_email_user') {
                await ConfigLoader.updateEmailSettings({ user: text });
                logger.info(`Updated email user to ${text}`);
                await ctx.reply(`Пользователь email обновлен на ${text}!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'email_settings' }]
                        ]
                    }
                });
            } else if (action === 'edit_email_password') {
                await ConfigLoader.updateEmailSettings({ password: text });
                logger.info(`Updated email password`);
                await ctx.reply(`Пароль email обновлен!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Назад', callback_data: 'email_settings' }]
                        ]
                    }
                });
            } else if (action === 'find_user_for_db')
            {
                if (!ctx.session.waitingForUserInput) return;

                try {
                    const query = ctx.message.text.trim();
                    if (!query) {
                        await ctx.reply('Введите корректные данные для поиска.');
                        return;
                    }

                    const users = await searchUsers(query);
                    if (users.length === 0) {
                        await ctx.reply('Пользователи не найдены. Попробуйте снова.');
                        return;
                    }

                    const keyboard = users.map(user => [{
                        text: `${user.id} | ${user.username}`,
                        callback_data: `user_${user.id}`
                    }]);
                    keyboard.push([{ text: 'Назад', callback_data: 'scene_user_management' }]);

                    await ctx.reply('Выберите пользователя:', {
                        reply_markup: { inline_keyboard: keyboard }
                    });

                    // Сбрасываем флаг ожидания ввода после успешного поиска
                    ctx.session.waitingForUserInput = false;
                } catch (error) {
                    logger.error(`Error in user search: ${error.message}`, { stack: error.stack });
                    await ctx.reply('Ошибка при поиске пользователей. Попробуйте снова.');
                }
            }
            delete ctx.session.action;
        } else if (ctx.session.editScene) {
            const sceneKey = ctx.session.editScene;
            await ConfigLoader.updateSceneText(sceneKey, text);
            delete ctx.session.editScene;

            await ctx.reply('Текст успешно обновлен!', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Вернуться к сцене', callback_data: `scene_${sceneKey}` }]
                    ]
                }
            });
            logger.info(`User ${ctx.from.id} updated text for ${sceneKey}`);
        }
    } catch (error) {
        logger.error(`Error processing text input: ${error.message}`, { stack: error.stack });
        await ctx.reply(`Извините, произошла ошибка: ${error.message}`);
    }
});

// Регистрация модулей
try {
    sceneSettings(admin);
    orgSettings(admin);
    classificationSettings(admin);
    emailSettings(admin);
    user_settings(admin);
} catch (error) {
    logger.error(`Error initializing admin modules: ${error.message}`, { stack: error.stack });
}

export default admin;