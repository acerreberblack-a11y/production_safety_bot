// utils/configLoader.js
import fs from 'fs/promises';
import { fileURLToPath } from 'url'; // Импорт для преобразования URL в путь
import { dirname, join } from 'path'; // Импорт утилит для работы с путями
import logger from './logger.js';

class ConfigLoader {
  // Определяем путь к конфигурационному файлу

  static configPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'config', 'config.json');

  static async loadConfig() {
    try {
      const data = await fs.readFile(ConfigLoader.configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.error(`Config file not found at ${ConfigLoader.configPath}: ${error.message}`, { stack: error.stack });
        throw new Error(`Файл конфигурации ${ConfigLoader.configPath} не найден`);
      }
      logger.error(`Error loading config: ${error.message}`, { stack: error.stack });
      throw new Error('Не удалось загрузить конфигурацию');
    }
  }

  static async saveConfig(config) {
    try {
      await fs.writeFile(ConfigLoader.configPath, JSON.stringify(config, null, 2));
      logger.info('Config saved successfully');
      // Добавим проверку сохранённого файла для отладки
      const savedData = await fs.readFile(ConfigLoader.configPath, 'utf8');
      logger.debug('Saved config content:', { content: savedData });
    } catch (error) {
      logger.error(`Error saving config: ${error.message}`, { stack: error.stack });
      throw new Error('Не удалось сохранить конфигурацию');
    }
  }

  static validatePriority(priority) {
    const parsedPriority = parseInt(priority, 10);
    if (isNaN(parsedPriority) || parsedPriority < 0 || parsedPriority > 10) {
      throw new Error('Приоритет должен быть числом от 0 до 10');
    }
    return parsedPriority;
  }

  // Методы для работы с classifications
  static async addClassification(classKey, name, priority = 10) {
    if (!name || typeof name !== 'string') {
      throw new Error('Название классификации должно быть непустой строкой');
    }

    const config = await ConfigLoader.loadConfig();
    config.classifications = config.classifications || {};
    const validatedPriority = ConfigLoader.validatePriority(priority);

    config.classifications[classKey] = { name, priority: validatedPriority };
    await ConfigLoader.saveConfig(config);
    logger.info(`Added classification with key ${classKey}, name ${name}, priority ${priority}`);
  }

  static async updateEmailSettings(updates) {
    try {
      const config = await this.loadConfig();

      // Инициализация секции email, если она отсутствует
      if (!config.general) config.general = {};
      if (!config.general.email) {
        config.general.email = {
          host: '',
          port: 587,
          user: '',
          password: '',
          secure: false,
          rejectUnauthorized: false,
        };
      }

      // Обновление только указанных полей
      const emailConfig = config.general.email;
      if (updates.host !== undefined) emailConfig.host = updates.host;
      if (updates.port !== undefined) {
        const port = Number(updates.port);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new Error('Порт должен быть числом от 1 до 65535');
        }
        emailConfig.port = port;
      }
      if (updates.user !== undefined) emailConfig.user = updates.user;
      if (updates.password !== undefined) emailConfig.password = updates.password;
      if (updates.secure !== undefined) emailConfig.secure = Boolean(updates.secure);
      if (updates.rejectUnauthorized !== undefined) emailConfig.rejectUnauthorized = Boolean(updates.rejectUnauthorized);
      if (updates.support_email !== undefined) emailConfig.support_email = updates.support_email;
      if (updates.ticket_subject !== undefined) emailConfig.ticket_subject = updates.ticket_subject;
      if (updates.ticket_template !== undefined) emailConfig.ticket_template = updates.ticket_template;

      await this.saveConfig(config);
      logger.info('Email settings updated', { updates });
      return emailConfig;
    } catch (error) {
      logger.error(`Error updating email settings: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  static async updateClassificationName(classKey, newName, newPriority = null) {
    const config = await ConfigLoader.loadConfig();
    logger.debug('Before update - Config classifications:', { classifications: config.classifications });
    if (!config.classifications || !config.classifications[classKey]) {
      throw new Error(`Классификация с ключом ${classKey} не найдена`);
    }

    if (!newName || typeof newName !== 'string') {
      throw new Error('Новое название классификации должно быть непустой строкой');
    }

    config.classifications[classKey].name = newName;
    if (newPriority !== null) {
      config.classifications[classKey].priority = ConfigLoader.validatePriority(newPriority);
    }
    await ConfigLoader.saveConfig(config);
    logger.info(`Updated classification ${classKey} to name ${newName} with priority ${newPriority || config.classifications[classKey].priority}`);
    logger.debug('After update - Config classifications:', { classifications: config.classifications });
  }

  static async updateClassificationPriority(classKey, priority) {
    const config = await ConfigLoader.loadConfig();
    if (!config.classifications || !config.classifications[classKey]) {
      throw new Error(`Классификация с ключом ${classKey} не найдена`);
    }

    config.classifications[classKey].priority = ConfigLoader.validatePriority(priority);
    await ConfigLoader.saveConfig(config);
    logger.info(`Updated priority for classification ${classKey} to ${priority}`);
  }

  static async deleteClassification(classKey) {
    const config = await ConfigLoader.loadConfig();
    if (!config.classifications || !config.classifications[classKey]) {
      throw new Error(`Классификация с ключом ${classKey} не найдена`);
    }

    delete config.classifications[classKey];
    if (Object.keys(config.classifications).length === 0) {
      delete config.classifications;
    }
    await ConfigLoader.saveConfig(config);
    logger.info(`Deleted classification with key ${classKey}`);
  }

  // Методы для организаций
  static async addOrganization(orgKey, name, branches, priority = 10) {
    const config = await ConfigLoader.loadConfig();
    config.organizations = config.organizations || {};
    const validatedPriority = ConfigLoader.validatePriority(priority);

    config.organizations[orgKey] = {
      name, branches: branches || [], hidden: false, priority: validatedPriority,
    };
    await ConfigLoader.saveConfig(config);
    logger.info(`Added organization with key ${orgKey}, name ${name}, priority ${priority}`);
  }

  static async updateOrganizationName(orgKey, newName, newPriority = null) {
    const config = await ConfigLoader.loadConfig();
    if (!config.organizations || !config.organizations[orgKey]) {
      throw new Error(`Организация с ключом ${orgKey} не найдена`);
    }

    config.organizations[orgKey].name = newName;
    if (newPriority !== null) {
      config.organizations[orgKey].priority = ConfigLoader.validatePriority(newPriority);
    }
    await ConfigLoader.saveConfig(config);
    logger.info(`Updated organization ${orgKey} to name ${newName} with priority ${newPriority || 'unchanged'}`);
  }

  static async updateOrganizationPriority(orgKey, priority) {
    const config = await ConfigLoader.loadConfig();
    if (!config.organizations || !config.organizations[orgKey]) {
      throw new Error(`Организация с ключом ${orgKey} не найдена`);
    }

    config.organizations[orgKey].priority = ConfigLoader.validatePriority(priority);
    await ConfigLoader.saveConfig(config);
    logger.info(`Updated priority for organization ${orgKey} to ${priority}`);
  }

  static async addBranch(orgKey, branchName, priority = 10) {
    if (!branchName || typeof branchName !== 'string') {
      throw new Error('Branch name must be a non-empty string');
    }

    const config = await ConfigLoader.loadConfig();
    logger.info(`Attempting to add branch ${branchName} to organization ${orgKey} with priority ${priority}, available organizations: ${JSON.stringify(Object.keys(config.organizations))}`);
    if (config.organizations && config.organizations[orgKey]) {
      const validatedPriority = ConfigLoader.validatePriority(priority);
      config.organizations[orgKey].branches = config.organizations[orgKey].branches || [];
      const branchExists = config.organizations[orgKey].branches.some((b) => {
        if (typeof b === 'string') return b === branchName;
        return b.name === branchName;
      });
      if (!branchExists) {
        config.organizations[orgKey].branches.push({ name: branchName, priority: validatedPriority });
        await ConfigLoader.saveConfig(config);
        logger.info(`Successfully added branch ${branchName} to organization ${orgKey} with priority ${validatedPriority}`);
      } else {
        logger.warn(`Branch ${branchName} already exists in organization ${orgKey}`);
      }
    } else {
      throw new Error(`Организация с ключом ${orgKey} не найдена`);
    }
  }

  static async updateBranchPriority(orgKey, branchIndex, priority) {
    const config = await ConfigLoader.loadConfig();
    if (!config.organizations || !config.organizations[orgKey]) {
      throw new Error(`Организация с ключом ${orgKey} не найдена`);
    }

    const branches = config.organizations[orgKey].branches || [];
    if (!branches[branchIndex]) {
      throw new Error(`Филиал с индексом ${branchIndex} не найден`);
    }

    const normalizedBranch = typeof branches[branchIndex] === 'string'
      ? { name: branches[branchIndex], priority: 10 }
      : branches[branchIndex];

    normalizedBranch.priority = ConfigLoader.validatePriority(priority);
    config.organizations[orgKey].branches[branchIndex] = normalizedBranch;
    await ConfigLoader.saveConfig(config);
    logger.info(`Updated priority for branch at index ${branchIndex} in organization ${orgKey} to ${priority}`);
  }

  static async deleteBranch(orgKey, branchIndex) {
    const config = await ConfigLoader.loadConfig();
    if (!config.organizations || !config.organizations[orgKey]) {
      throw new Error(`Организация с ключом ${orgKey} не найдена`);
    }

    const branches = config.organizations[orgKey].branches || [];
    if (!branches[branchIndex]) {
      throw new Error(`Филиал с индексом ${branchIndex} не найден`);
    }

    config.organizations[orgKey].branches.splice(branchIndex, 1);
    await ConfigLoader.saveConfig(config);
    logger.info(`Deleted branch at index ${branchIndex} from organization ${orgKey}`);
  }

  static async deleteOrganization(orgKey) {
    const config = await ConfigLoader.loadConfig();
    if (!config.organizations || !config.organizations[orgKey]) {
      throw new Error(`Организация с ключом ${orgKey} не найдена`);
    }

    delete config.organizations[orgKey];
    if (Object.keys(config.organizations).length === 0) {
      delete config.organizations;
    }
    await ConfigLoader.saveConfig(config);
    logger.info(`Deleted organization with key ${orgKey}`);
  }

  static async hideOrganization(orgKey) {
    const config = await ConfigLoader.loadConfig();
    if (!config.organizations || !config.organizations[orgKey]) {
      throw new Error(`Организация с ключом ${orgKey} не найдена`);
    }

    config.organizations[orgKey].hidden = true;
    await ConfigLoader.saveConfig(config);
    logger.info(`Hid organization with key ${orgKey}`);
  }

  // === Administrators ===
  static async addAdministrator(telegramId) {
    const config = await ConfigLoader.loadConfig();
    config.administrators = config.administrators || [];
    const id = Number(telegramId);
    if (!config.administrators.includes(id)) {
      config.administrators.push(id);
      await ConfigLoader.saveConfig(config);
      logger.info(`Added administrator ${id}`);
      return true;
    }
    logger.warn(`Administrator ${id} already exists`);
    return false;
  }

  static async removeAdministrator(telegramId) {
    const config = await ConfigLoader.loadConfig();
    config.administrators = config.administrators || [];
    const id = Number(telegramId);
    const index = config.administrators.indexOf(id);
    if (index !== -1) {
      config.administrators.splice(index, 1);
      await ConfigLoader.saveConfig(config);
      logger.info(`Removed administrator ${id}`);
      return true;
    }
    logger.warn(`Administrator ${id} not found`);
    return false;
  }

  static async updateSceneText(sceneKey, text) {
    const config = await ConfigLoader.loadConfig();
    if (!config.controllers[sceneKey]) {
      throw new Error(`Сцена с ключом ${sceneKey} не найдена`);
    }

    config.controllers[sceneKey].text = text;
    await ConfigLoader.saveConfig(config);
    logger.info(`Updated text for scene ${sceneKey}`);
  }
}

export default ConfigLoader;
