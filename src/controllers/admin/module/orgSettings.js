// controllers/admin/module/orgSettings.js
import logger from '../../../utils/logger.js';
import ConfigLoader from '../../../utils/configLoader.js';

export default function orgSettings(scene) {
  // Обработка "Настройка организация и фил-ов"
  scene.action('org_settings', async (ctx) => {
    try {
      await ctx.deleteMessage();
      const config = await ConfigLoader.loadConfig();
      logger.info('Loaded config organizations:', { organizations: config.organizations });
      const organizations = config.organizations || {};

      // Сортировка организаций по приоритету (0 - самый высокий, 10 - самый низкий)
      const sortedOrgs = Object.keys(organizations)
        .map((orgKey) => ({ key: orgKey, ...organizations[orgKey] }))
        .sort((a, b) => {
          const priorityA = a.priority !== undefined ? a.priority : 10;
          const priorityB = b.priority !== undefined ? b.priority : 10;
          logger.debug(`Sorting: ${a.name} (priority: ${priorityA}) vs ${b.name} (priority: ${priorityB})`);
          return priorityA - priorityB;
        });

      const keyboard = [
        ...sortedOrgs.map((org) => [
          {
            text: `🔹 ${org.name} (Приоритет: ${org.priority !== undefined ? org.priority : 10})`,
            callback_data: `select_organization_${org.key}`,
          },
        ]),
        [{ text: 'Добавить организацию', callback_data: 'add_organization' }],
        [{ text: 'Удалить организацию', callback_data: 'delete_organization' }],
        [{ text: 'Назад', callback_data: 'back_to_main' }],
      ];

      await ctx.reply('Выберите организацию или действие (сортировка по приоритету: 0 - первый, 10 - последний):', {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in org_settings action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при отображении настроек организаций.');
    }
  });

  // Обработка выбора организации
  scene.action(/^select_organization_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const orgKey = ctx.match[1];
      const config = await ConfigLoader.loadConfig();
      logger.info(`Selecting organization with key: ${orgKey}, config:`, { organizations: config.organizations });
      const organization = config.organizations && config.organizations[orgKey];

      if (!organization) {
        throw new Error(`Организация с ключом ${orgKey} не найдена`);
      }

      // Логируем исходные данные филиалов для отладки
      logger.debug(`Raw branches for ${orgKey}:`, { branches: organization.branches });

      // Преобразуем строки в объекты и фильтруем некорректные элементы
      const normalizedBranches = (organization.branches || []).map((branch) => {
        if (typeof branch === 'string') {
          return { name: branch, priority: 10 };
        }
        return branch;
      }).filter((branch) => branch && typeof branch === 'object' && branch.name && typeof branch.name === 'string');

      // Сортируем филиалы по приоритету
      const sortedBranches = [...normalizedBranches].sort((a, b) => {
        const priorityA = a.priority !== undefined ? a.priority : 10;
        const priorityB = b.priority !== undefined ? b.priority : 10;
        logger.debug(`Sorting branches: ${a.name} (priority: ${priorityA}) vs ${b.name} (priority: ${priorityB})`);
        return priorityA - priorityB;
      });

      const keyboard = [
        [{ text: 'Изменить название организации', callback_data: `edit_org_name_${orgKey}` }],
        [{ text: 'Изменить приоритет организации', callback_data: `edit_org_priority_${orgKey}` }],
        [{ text: 'Добавить филиал', callback_data: `add_branch_${orgKey}` }],
        [{ text: 'Изменить приоритет филиала', callback_data: `edit_branch_priority_prompt_${orgKey}` }],
        [{ text: 'Удалить филиал', callback_data: `delete_branch_prompt_${orgKey}` }],
        [{ text: 'Удалить организацию', callback_data: `delete_organization_${orgKey}` }],
        [{ text: 'Скрыть организацию', callback_data: `hide_organization_${orgKey}` }],
        [{ text: 'Назад', callback_data: 'org_settings' }],
      ];

      // Отображение приоритета с учётом значения 0
      const orgPriority = organization.priority !== undefined ? organization.priority : 10;
      const branchesText = sortedBranches.length
        ? sortedBranches.map((b) => {
          const branchPriority = b.priority !== undefined ? b.priority : 10;
          return `${b.name} (Приоритет: ${branchPriority})`;
        }).join(', ')
        : 'Нет филиалов';

      await ctx.reply(`Организация: 🔹 ${organization.name} (Приоритет: ${orgPriority})\nФилиалы: ${branchesText}`, {
        reply_markup: { inline_keyboard: keyboard },
      });
      ctx.session.selectedOrg = orgKey;
    } catch (error) {
      logger.error(`Error in select_organization action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при выборе организации.');
    }
  });

  // Обработка добавления организации
  scene.action('add_organization', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.reply('Введите название новой организации и приоритет (0-10, опционально, по умолчанию 10), в формате:\n"Название,приоритет" или просто "Название":', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: 'org_settings' }],
          ],
        },
      });
      ctx.session.action = 'add_organization';
    } catch (error) {
      logger.error(`Error in add_organization action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при попытке добавить организацию.');
    }
  });

  // Обработка удаления организации (запрос выбора)
  scene.action('delete_organization', async (ctx) => {
    try {
      await ctx.deleteMessage();
      const config = await ConfigLoader.loadConfig();
      const organizations = config.organizations || {};

      const keyboard = Object.keys(organizations).map((orgKey) => [
        { text: organizations[orgKey].name, callback_data: `confirm_delete_organization_${orgKey}` },
      ]).concat([[{ text: 'Назад', callback_data: 'org_settings' }]]);

      await ctx.reply('Выберите организацию для удаления:', {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in delete_organization action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при отображении списка организаций для удаления.');
    }
  });

  // Обработка подтверждения удаления организации
  scene.action(/^confirm_delete_organization_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const orgKey = ctx.match[1];
      const config = await ConfigLoader.loadConfig();
      const organization = config.organizations[orgKey];

      if (!organization) {
        throw new Error(`Организация с ключом ${orgKey} не найдена`);
      }

      const keyboard = [
        [{ text: 'Да', callback_data: `delete_organization_${orgKey}` }],
        [{ text: 'Отмена', callback_data: 'org_settings' }],
      ];

      await ctx.reply(`Вы уверены, что хотите удалить организацию "${organization.name}"?`, {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in confirm_delete_organization action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при запросе подтверждения удаления.');
    }
  });

  // Обработка удаления организации
  scene.action(/^delete_organization_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const orgKey = ctx.match[1];
      await ConfigLoader.deleteOrganization(orgKey);
      await ctx.reply('Организация успешно удалена!', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'org_settings' }],
          ],
        },
      });
    } catch (error) {
      logger.error(`Error in delete_organization action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при удалении организации.');
    }
  });

  // Обработка изменения названия организации
  scene.action(/^edit_org_name_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const orgKey = ctx.match[1];
      await ctx.reply('Введите новое название организации и приоритет (0-10, опционально, по умолчанию 10), в формате:\n"Название,приоритет" или просто "Название":', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: `select_organization_${orgKey}` }],
          ],
        },
      });
      ctx.session.action = `edit_org_name_${orgKey}`;
    } catch (error) {
      logger.error(`Error in edit_org_name action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при попытке изменить название организации.');
    }
  });

  // Обработка добавления филиала
  scene.action(/^add_branch_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const orgKey = ctx.match[1];
      logger.info(`Starting add_branch action for orgKey: ${orgKey}`);
      await ctx.reply('Введите название нового филиала (или несколько через ;, например: Имя1;Имя2;Имя3) и приоритет (0-10, опционально, по умолчанию 10), в формате:\n"Название1;Название2,приоритет" или просто "Название":', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: `select_organization_${orgKey}` }],
          ],
        },
      });
      ctx.session.action = `add_branch_${orgKey}`;
    } catch (error) {
      logger.error(`Error in add_branch action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при попытке добавить филиал.');
    }
  });

  // Действие для редактирования приоритета организации
  scene.action(/^edit_org_priority_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const orgKey = ctx.match[1];
      await ctx.reply('Введите новый приоритет для организации (число от 0 до 10):', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: `select_organization_${orgKey}` }],
          ],
        },
      });
      ctx.session.action = `edit_org_priority_${orgKey}`;
    } catch (error) {
      logger.error(`Error in edit_org_priority action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при попытке изменить приоритет организации.');
    }
  });

  // Действие для выбора филиала для редактирования приоритета
  scene.action(/^edit_branch_priority_prompt_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const orgKey = ctx.match[1];
      const config = await ConfigLoader.loadConfig();
      const branches = config.organizations[orgKey].branches || [];

      // Нормализуем данные филиалов
      const normalizedBranches = branches.map((branch) => {
        if (typeof branch === 'string') {
          return { name: branch, priority: 10 };
        }
        return branch;
      }).filter((branch) => branch && typeof branch === 'object' && branch.name && typeof branch.name === 'string');

      const keyboard = normalizedBranches.map((branch, index) => [
        { text: `${branch.name} (Приоритет: ${branch.priority !== undefined ? branch.priority : 10}, ID: ${index})`, callback_data: `edit_branch_priority_${orgKey}_${index}` },
      ]).concat([[{ text: 'Назад', callback_data: `select_organization_${orgKey}` }]]);

      await ctx.reply('Выберите филиал для изменения приоритета по ID:', {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in edit_branch_priority_prompt action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при отображении списка филиалов.');
    }
  });

  // Действие для редактирования приоритета филиала
  scene.action(/^edit_branch_priority_(.+)_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const [orgKey, branchIndex] = ctx.match.slice(1);
      await ctx.reply('Введите новый приоритет для филиала (число от 0 до 10):', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отмена', callback_data: `select_organization_${orgKey}` }],
          ],
        },
      });
      ctx.session.action = `edit_branch_priority_${orgKey}_${branchIndex}`;
    } catch (error) {
      logger.error(`Error in edit_branch_priority action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при попытке изменить приоритет филиала.');
    }
  });

  // Обработка удаления филиала (запрос выбора)
  scene.action(/^delete_branch_prompt_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const orgKey = ctx.match[1];
      const config = await ConfigLoader.loadConfig();
      const branches = config.organizations[orgKey].branches || [];

      // Нормализуем данные филиалов
      const normalizedBranches = branches.map((branch) => {
        if (typeof branch === 'string') {
          return { name: branch, priority: 10 };
        }
        return branch;
      }).filter((branch) => branch && typeof branch === 'object' && branch.name && typeof branch.name === 'string');

      const keyboard = normalizedBranches.map((branch, index) => [
        { text: `${branch.name} (ID: ${index})`, callback_data: `confirm_delete_branch_${orgKey}_${index}` },
      ]).concat([[{ text: 'Назад', callback_data: `select_organization_${orgKey}` }]]);

      await ctx.reply('Выберите филиал для удаления по ID:', {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in delete_branch_prompt action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при отображении списка филиалов для удаления.');
    }
  });

  // Обработка подтверждения удаления филиала
  scene.action(/^confirm_delete_branch_(.+)_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const [orgKey, branchIndex] = ctx.match.slice(1);
      const config = await ConfigLoader.loadConfig();
      const branches = config.organizations[orgKey].branches || [];
      const normalizedBranches = branches.map((branch) => {
        if (typeof branch === 'string') {
          return { name: branch, priority: 10 };
        }
        return branch;
      }).filter((branch) => branch && typeof branch === 'object' && branch.name && typeof branch.name === 'string');
      const branchToDelete = normalizedBranches[parseInt(branchIndex)];

      if (!branchToDelete) {
        throw new Error(`Филиал с индексом ${branchIndex} не найден`);
      }

      const keyboard = [
        [{ text: 'Да', callback_data: `delete_branch_${orgKey}_${branchIndex}` }],
        [{ text: 'Отмена', callback_data: `select_organization_${orgKey}` }],
      ];

      await ctx.reply(`Вы уверены, что хотите удалить филиал "${branchToDelete.name}"?`, {
        reply_markup: { inline_keyboard: keyboard },
      });
    } catch (error) {
      logger.error(`Error in confirm_delete_branch action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при запросе подтверждения удаления.');
    }
  });

  // Обработка удаления филиала
  scene.action(/^delete_branch_(.+)_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const [orgKey, branchIndex] = ctx.match.slice(1);
      await ConfigLoader.deleteBranch(orgKey, parseInt(branchIndex));
      await ctx.reply('Филиал успешно удален!', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: `select_organization_${orgKey}` }],
          ],
        },
      });
    } catch (error) {
      logger.error(`Error in delete_branch action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при удалении филиала.');
    }
  });

  // Обработка скрытия организации
  scene.action(/^hide_organization_(.+)$/, async (ctx) => {
    try {
      await ctx.deleteMessage();
      const orgKey = ctx.match[1];
      await ConfigLoader.hideOrganization(orgKey);
      await ctx.reply('Организация скрыта!', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Назад', callback_data: 'org_settings' }],
          ],
        },
      });
    } catch (error) {
      logger.error(`Error in hide_organization action: ${error.message}`, { stack: error.stack });
      await ctx.reply('Извините, произошла ошибка при скрытии организации.');
    }
  });
}
