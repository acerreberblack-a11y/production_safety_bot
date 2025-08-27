// controllers/classification/index.js
import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import ConfigLoader from '../../utils/configLoader.js';

const classification = new Scenes.BaseScene('classification');

classification.enter(async (ctx) => {
    try {
        const config = await ConfigLoader.loadConfig();
        let classifications = [];

        // Извлекаем классификации с приоритетами
        if (config.classifications) {
            classifications = Object.values(config.classifications)
                .map(classItem => ({
                    name: classItem.name,
                    priority: classItem.priority !== undefined ? classItem.priority : 10
                }))
                .sort((a, b) => a.priority - b.priority); // Сортируем по приоритету
        }

        // Если классификаций нет в конфиге, используем запасной список
        if (classifications.length === 0) {
            classifications = [
                { name: 'Техническая неисправность', priority: 10 },
                { name: 'Нарушение безопасности', priority: 10 },
                { name: 'Другое', priority: 10 }
            ];
            logger.warn('No classifications found in config, using default list');
        }

        // Сохраняем классификации в сессии для дальнейшего использования
        ctx.session.classifications = classifications;

        // Формируем клавиатуру с учетом длины текста
        const shortNames = [];
        const longNames = [];

        classifications.forEach(item => {
            if (item.name.length > 30) {
                longNames.push([item.name]); // Длинные названия в отдельные строки
            } else {
                shortNames.push(item.name);
            }
        });

        const keyboard = [
            ...chunkArray(shortNames, 2), // Короткие названия разбиваем на строки по 2
            ...longNames, // Длинные названия отдельными строками
            ['Назад'],['Отменить заполнение']
        ];

        const classConfig = config.controllers?.classification;
        await ctx.reply(classConfig?.text || 'Выберите классификацию обращения:', {
            reply_markup: {
                keyboard: keyboard,
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });

        ctx.session.waitingForClassification = true;
        logger.info(`User ${ctx.from.id} entered classification scene with classifications: ${classifications.map(item => item.name).join(', ')}`);
    } catch (error) {
        logger.error(`Error in classification scene enter: ${error.message}`, { stack: error.stack });
        await ctx.reply('Извините, произошла ошибка при загрузке классификаций', {
            reply_markup: { remove_keyboard: true }
        });
    }
});

// Обработка выбора классификации
classification.on('text', async (ctx) => {
    const text = ctx.message.text.trim();

     // Отмена заполнения обращения
    if(text === 'Отменить заполнение')
    {
        try {
            delete ctx.session.waitingForBranch;
            delete ctx.session.selectedOrg;
            delete ctx.session.selectedBranch;
            delete ctx.session.selectedClassification;
            delete ctx.session.issueData;
            delete ctx.session.ticketType;
            delete ctx.session.classifications;
            delete ctx.session.waitingForClassification;
            delete ctx.session.waitingForOrg;

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

    if (text === 'Назад') {
        try {
            await ctx.reply('Вы вернулись к выбору филиала.', {
                reply_markup: { remove_keyboard: true }
            });
            await ctx.scene.enter('organization');
            logger.info(`User ${ctx.from.id} returned to organization scene`);
        } catch (error) {
            logger.error(`Error in back action: ${error.message}`, { stack: error.stack });
            await ctx.reply('Извините, произошла ошибка при возвращении', {
                reply_markup: { remove_keyboard: true }
            });
        }
        return;
    }

    try {
        // Используем классификации из сессии
        const classifications = ctx.session.classifications || [];
        const classificationNames = classifications.map(item => item.name);

        if (classificationNames.includes(text)) {
            ctx.session.selectedClassification = text; // Сохраняем выбранную классификацию
            await ctx.reply(`Вы выбрали классификацию: ${text}.`, {
                reply_markup: { remove_keyboard: true }
            });
            await ctx.scene.enter('reportIssue'); // Переход к описанию проблемы
            logger.info(`User ${ctx.from.id} selected classification ${text}, switched to reportIssue`);
        } else {
            await ctx.reply('Пожалуйста, выберите классификацию из предложенного списка.');
        }
    } catch (error) {
        logger.error(`Error in text handler: ${error.message}`, { stack: error.stack });
        await ctx.reply('Извините, произошла ошибка при обработке выбора', {
            reply_markup: { remove_keyboard: true }
        });
    }
});

// Очистка сессии при выходе из сцены
classification.leave((ctx) => {
    delete ctx.session.waitingForClassification;
    delete ctx.session.classifications;
    logger.info(`User ${ctx.from.id} left classification scene`);
});

// Вспомогательная функция для разбиения массива на чанки
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

export default classification;