// controllers/organization/index.js
import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import ConfigLoader from '../../utils/configLoader.js';

const organization = new Scenes.BaseScene('organization');

organization.enter(async (ctx) => {
    try {
        const config = await ConfigLoader.loadConfig();
        const organizations = config.organizations;

        if (!organizations) {
            throw new Error('Organizations configuration is missing');
        }

        // Фильтруем организации, исключая скрытые (hidden: true), и сортируем по приоритету
        const visibleOrganizations = Object.keys(organizations)
            .filter(orgKey => !organizations[orgKey].hidden)
            .map(orgKey => ({
                key: orgKey,
                name: organizations[orgKey].name,
                priority: organizations[orgKey].priority
            }))
            .sort((a, b) => {
                const priorityA = a.priority !== undefined ? a.priority : 10;
                const priorityB = b.priority !== undefined ? b.priority : 10;
                logger.debug(`Sorting organizations: ${a.name} (priority: ${priorityA}) vs ${b.name} (priority: ${priorityB})`);
                return priorityA - priorityB;
            })
            .map(org => ({
                text: org.name
            }));

        if (visibleOrganizations.length === 0) {
            throw new Error('Нет доступных организаций для выбора');
        }

        const keyboard = [
            ...chunkArray(visibleOrganizations.map(btn => btn.text), 2), // Разбиваем на строки по 2 кнопки
            ['Назад'], ['Отменить заполнение']
        ];

        const orgConfig = config.controllers?.organization;
        await ctx.reply(orgConfig?.text || 'Выберите организацию:', {
            reply_markup: {
                keyboard: keyboard,
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
        ctx.session.waitingForOrg = true; // Флаг ожидания выбора организации
        logger.info(`User ${ctx.from.id} entered organization scene`);
    } catch (error) {
        logger.error(`Error in organization scene: ${error.message}`, { stack: error.stack });
        await ctx.reply(error.message || 'Извините, произошла ошибка', {
            reply_markup: { remove_keyboard: true }
        });
    }
});

// Обработка выбора организации или филиала
organization.on('text', async (ctx) => {
    const text = ctx.message.text;

    // Отмена заполнения обращения
    if( text === 'Отменить заполнение')
    {
        try {
            delete ctx.session.waitingForBranch;
            delete ctx.session.waitingForOrg;
            delete ctx.session.selectedOrg;
            delete ctx.session.selectedBranch;
            delete ctx.session.selectedClassification;
            delete ctx.session.issueData;
            delete ctx.session.ticketType;

            await ctx.reply(`Заполнение обращения было отменено.`, {
                    reply_markup: { remove_keyboard: true }
                });

            await ctx.scene.enter('welcome');

        } catch (error) {
            logger.error(`Error in cancel action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка', {
                reply_markup: { remove_keyboard: true }
            });
        }
        return;
    }

    // Возврат к выбору типа заявки
    if (text === 'Назад') {
        try {
            if (ctx.session.waitingForBranch) {
                // Если мы на этапе выбора филиала, возвращаемся к выбору организации
                delete ctx.session.waitingForBranch;
                delete ctx.session.selectedOrg;
                await ctx.scene.reenter();
                logger.info(`User ${ctx.from.id} returned to organization selection`);
            } else {
                // Если мы на этапе выбора организации, возвращаемся к выбору типа
                delete ctx.session.waitingForOrg;
                await ctx.reply('Вы вернулись к выбору типа заявки.', {
                    reply_markup: { remove_keyboard: true }
                });
                await ctx.scene.enter('ticketType');
                logger.info(`User ${ctx.from.id} returned to ticketType scene`);
            }
        } catch (error) {
            logger.error(`Error in back action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка', {
                reply_markup: { remove_keyboard: true }
            });
        }
        return;
    }

    try {
        const config = await ConfigLoader.loadConfig();
        const organizations = config.organizations;

        if (ctx.session.waitingForOrg) {
            // Ищем организацию по названию, исключая скрытые
            const selectedOrgKey = Object.keys(organizations).find(
                orgKey => !organizations[orgKey].hidden && organizations[orgKey].name === text
            );

            if (!selectedOrgKey) {
                await ctx.reply('Пожалуйста, выберите организацию из списка.');
                return;
            }

            const organization = organizations[selectedOrgKey];
            if (!organization) {
                throw new Error('Organization not found');
            }

            // Преобразуем строки в объекты и фильтруем некорректные элементы
            const normalizedBranches = (organization.branches || []).map(branch => {
                if (typeof branch === 'string') {
                    return { name: branch, priority: 10 }; // По умолчанию приоритет 10 для старых записей
                }
                return branch;
            }).filter(branch => branch && typeof branch === 'object' && branch.name && typeof branch.name === 'string');

            // Если филиалов нет, переходим сразу в сцену classification с филиалом "default"
            if (normalizedBranches.length === 0) {
                ctx.session.selectedOrg = selectedOrgKey;
                ctx.session.selectedBranch = 'default'; // Устанавливаем филиал как "default"
                await ctx.reply(`Вы выбрали ${organization.name}. Филиалы отсутствуют, используется значение по умолчанию.`, {
                    reply_markup: { remove_keyboard: true }
                });
                await ctx.scene.enter('classification');
                logger.info(`User ${ctx.from.id} selected organization ${organization.name} with no branches, default branch set, switched to classification`);
                return;
            }

            // Сортируем филиалы по приоритету
            const sortedBranches = [...normalizedBranches].sort((a, b) => {
                const priorityA = a.priority !== undefined ? a.priority : 10;
                const priorityB = b.priority !== undefined ? b.priority : 10;
                logger.debug(`Sorting branches: ${a.name} (priority: ${priorityA}) vs ${b.name} (priority: ${priorityB})`);
                return priorityA - priorityB;
            });

            // Формируем список филиалов для клавиатуры
            const branchButtons = sortedBranches
                .filter(branch => branch.name && typeof branch.name === 'string')
                .map(branch => branch.name);

            logger.debug(`Branch buttons before chunking: ${JSON.stringify(branchButtons)}`);
            const keyboard = [
                ...chunkArray(branchButtons, 2), // Разбиваем на строки по 2 кнопки
                ['Назад'],['Отменить заполнение']
            ];
            logger.debug(`Keyboard after chunking: ${JSON.stringify(keyboard)}`);

            ctx.session.selectedOrganization = organization.name;

            await ctx.reply(`Вы выбрали ${organization.name}. Теперь выберите филиал:`, {
                reply_markup: {
                    keyboard: keyboard,
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });

            ctx.session.selectedOrg = selectedOrgKey;
            ctx.session.waitingForOrg = false;
            ctx.session.waitingForBranch = true;
            logger.info(`User ${ctx.from.id} selected organization ${organization.name}`);
        } else if (ctx.session.waitingForBranch) {
            const orgKey = ctx.session.selectedOrg;
            const organization = organizations[orgKey];

            // Нормализуем филиалы для поиска
            const normalizedBranches = (organization.branches || []).map(branch => {
                if (typeof branch === 'string') {
                    return { name: branch, priority: 10 };
                }
                return branch;
            }).filter(branch => branch && typeof branch === 'object' && branch.name && typeof branch.name === 'string');

            // Ищем филиал по имени
            const selectedBranch = normalizedBranches.find(branch => branch.name === text);

            if (!selectedBranch) {
                await ctx.reply('Пожалуйста, выберите филиал из списка.');
                return;
            }

            ctx.session.selectedBranch = selectedBranch.name; // Сохраняем выбранный филиал
            await ctx.reply(`Вы выбрали ${selectedBranch.name} в ${organization.name}.`, {
                reply_markup: { remove_keyboard: true }
            });
            return await ctx.scene.enter('classification'); // Переход в сцену классификации
            logger.info(`User ${ctx.from.id} selected ${selectedBranch.name} in ${organization.name}, switched to classification`);
        }
    } catch (error) {
        logger.error(`Error in text handler: ${error.message}`, { stack: error.stack });
        await ctx.reply('Извините, произошла ошибка', {
            reply_markup: { remove_keyboard: true }
        });
    }
});

// Очистка сессии при выходе из сцены
organization.leave((ctx) => {
    delete ctx.session.waitingForOrg;
    delete ctx.session.waitingForBranch;
    delete ctx.session.selectedOrg;

    logger.info(`User ${ctx.from.id} left organization scene`);
});

// Вспомогательная функция для разбиения массива на чанки
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

export default organization;