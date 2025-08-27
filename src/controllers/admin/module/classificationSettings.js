// controllers/admin/module/classificationSettings.js
import logger from '../../../utils/logger.js';
import ConfigLoader from '../../../utils/configLoader.js';

export default function classificationSettings(scene) {
  // Обработка "Настройка классификаций"
  scene.action('classification_settings', async (ctx) => {
    try {
      await ctx.deleteMessage();
      const config = await ConfigLoader.loadConfig();
      logger.info('Loaded config classifications:', { classifications: config.classifications });
      const classifications = config.classifications || {};

      // Сортировка классификаций по приоритету (0 - самый высокий, 10 - самый низкий)
      const sortedClasses = Object.keys(classifications)
        .map((classKey) => ({ key: classKey, ...classifications[classKey] }))
        .sort((a, b) => {
          const priorityA = a.priority !== undefined ? a.priority : 10;
          const priorityB = b.priority !== undefined ? b.priority : 10;
          logger.debug(`Sorting classifications: ${a.name} (priority: ${priorityA}) vs ${b.name} (priority: ${priorityB})`);
          return priorityA - priorityB;
        });

      const keyboard = [
        ...sortedClasses.map((classItem) => [
          {
            text: `🔹 ${classItem.name} (Приоритет: ${classItem.priority !== undefined ? classItem.priority : 10})`,
            callback_data: `select_classification_${classItem.key}`,
          },
        ]),
        [{ text: 'Добавить классификацию', callback_data: 'add_classification' }],
        [{ text: 'Удалить классификацию', callback_data: 'delete_classification' }],
        [{ text: 'Назад', callback_data: 'back_to_main' }],
      ];

      await ctx.reply('Выберите классификацию или действие (сортировка по приоритету: 0 - первый, 10 - последний):', {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in classification_settings action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при отображении настроек классификаций.');
    }
  });

  // Обработка выбора классификации
  scene.action(/^select_classification_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const classKey = ctx.match[1];
      const config = await ConfigLoader.loadConfig();
      logger.info(`Selecting classification with key: ${classKey}, config:`, { classifications: config.classifications });
      const classification = config.classifications && config.classifications[classKey];

      if (!classification) {
        throw new Error(`Классификация с ключом ${classKey} не найдена`);
      }

      const classPriority = classification.priority !== undefined ? classification.priority : 10;

      const keyboard = [
        [{ text: 'Изменить название', callback_data: `edit_class_name_${classKey}` }],
        [{ text: 'Изменить приоритет', callback_data: `edit_class_priority_${classKey}` }],
        [{ text: 'Удалить классификацию', callback_data: `delete_classification_${classKey}` }],
        [{ text: 'Назад', callback_data: 'classification_settings' }],
      ];

      await ctx.reply(`Классификация: 🔹 ${classification.name} (Приоритет: ${classPriority})`, {
        reply_markup: { inline_keyboard: keyboard },
      });
      ctx.session.selectedClass = classKey;
    } catch (error) {
      logger.error(`Error in select_classification action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при выборе классификации.');
    }
  });

  // Обработка добавления классификации
  scene.action('add_classification', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.reply('Введите название новой классификации (или несколько через ;, например: Имя1;Имя2;Имя3) и приоритет (0-10, опционально, по умолчанию 10), в формате:\n"Название1;Название2,приоритет" или просто "Название":', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: 'classification_settings' }],
          ],
        },
      });
      ctx.session.action = 'add_classification';
    } catch (error) {
      logger.error(`Error in add_classification action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при попытке добавить классификацию.');
    }
  });

  // Обработка изменения названия классификации
  scene.action(/^edit_class_name_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const classKey = ctx.match[1];
      await ctx.reply('Введите новое название классификации и приоритет (0-10, опционально, по умолчанию 10), в формате:\n"Название,приоритет" или просто "Название":', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: `select_classification_${classKey}` }],
          ],
        },
      });
      ctx.session.action = `edit_class_name_${classKey}`;
    } catch (error) {
      logger.error(`Error in edit_class_name action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при попытке изменить название классификации.');
    }
  });

  // Обработка изменения приоритета классификации
  scene.action(/^edit_class_priority_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const classKey = ctx.match[1];
      await ctx.reply('Введите новый приоритет для классификации (число от 0 до 10):', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: `select_classification_${classKey}` }],
          ],
        },
      });
      ctx.session.action = `edit_class_priority_${classKey}`;
    } catch (error) {
      logger.error(`Error in edit_class_priority action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при попытке изменить приоритет классификации.');
    }
  });

  // Обработка удаления классификации (запрос выбора)
  scene.action('delete_classification', async (ctx) => {
    try {
      await ctx.deleteMessage();
      const config = await ConfigLoader.loadConfig();
      const classifications = config.classifications || {};

      const keyboard = Object.keys(classifications).map((classKey) => [
        { text: classifications[classKey].name, callback_data: `confirm_delete_classification_${classKey}` },
      ]).concat([[{ text: 'Назад', callback_data: 'classification_settings' }]]);

      await ctx.reply('Выберите классификацию для удаления:', {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in delete_classification action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при отображении списка классификаций для удаления.');
    }
  });

  // Обработка подтверждения удаления классификации
  scene.action(/^confirm_delete_classification_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const classKey = ctx.match[1];
      const config = await ConfigLoader.loadConfig();
      const classification = config.classifications[classKey];

      if (!classification) {
        throw new Error(`Классификация с ключом ${classKey} не найдена`);
      }

      const keyboard = [
        [{ text: 'Да', callback_data: `delete_classification_${classKey}` }],
        [{ text: 'Отмена', callback_data: 'classification_settings' }],
      ];

      await ctx.reply(`Вы уверены, что хотите удалить классификацию "${classification.name}"?`, {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in confirm_delete_classification action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при запросе подтверждения удаления.');
    }
  });

  // Обработка удаления классификации
  scene.action(/^delete_classification_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const classKey = ctx.match[1];
      await ConfigLoader.deleteClassification(classKey);
      await ctx.reply('Классификация успешно удалена!', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'classification_settings' }],
          ],
        },
      });
    } catch (error) {
      logger.error(`Error in delete_classification action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при удалении классификации.');
    }
  });
}
