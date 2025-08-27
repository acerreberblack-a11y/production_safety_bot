import dotenv from 'dotenv';
import { Telegraf, Scenes } from 'telegraf';
import LocalSession from 'telegraf-session-local';
import { HttpsProxyAgent } from 'https-proxy-agent';
import logger from './utils/logger.js';

import welcome from './controllers/welcome/index.js';
import description from './controllers/description/index.js';
import ticketType from './controllers/ticketType/index.js';
import emailAuth from './controllers/emailAuth/index.js';
import organization from './controllers/organization/index.js';
import classification from './controllers/classification/index.js';
import reportIssue from './controllers/reportIssue/index.js';
import admin from './controllers/admin/index.js';
import userCheckMiddleware from './middlewares/checkUser.js';
import spamProtection from './middlewares/spamProtection.js';
import { startReportEmailSender } from './utils/emailConfig.js';
import ConfigLoader from './utils/configLoader.js';

// Загружаем переменные окружения
dotenv.config();

const { BOT_TOKEN, PROXY_URL } = process.env;


// Список доступных сцен
const scenes = [welcome, description, ticketType, emailAuth, organization, classification, reportIssue, admin];

// Инициализация stage с указанными сценами
const stage = new Scenes.Stage(scenes, { ttl: 600 });

// Проверяем корректность сцен и логируем регистрацию
scenes.forEach((scene, index) => {
  if (!(scene instanceof Scenes.BaseScene)) {
    logger.error(`Invalid scene at index ${index}:`, { scene });
    throw new Error(`Invalid scene at index ${index}`);
  }
  logger.info(`Scene ${scene.id} registered`);
});

// Основной класс Telegram-бота
class Bot {
  constructor(token = BOT_TOKEN) {
    if (!token) {
      throw new Error('BOT_TOKEN is required');
    }

    this.bot = new Telegraf(token, {
      handlerTimeout: 90000,
      telegram: PROXY_URL ? { agent: new HttpsProxyAgent(PROXY_URL) } : undefined
    });
    this.setupMiddleware();
    this.registerHandlers();
    this.start();
    this.emailInterval = startReportEmailSender();
  }

  setupMiddleware() {
    // Настройка локального хранилища сессий
    const localSession = new LocalSession({
      database: 'sessions_10.json',
      property: 'session',
      storage: LocalSession.storageFileAsync,
      format: {
        serialize: (obj) => JSON.stringify(obj, null, 2),
        deserialize: (str) => JSON.parse(str)
      },
      state: { messages: [], sceneData: {} },
      getSessionKey: (ctx) => ctx.chat?.id?.toString()
    });

    // Подключаем защиты от спама, проверки пользователя, сессию и сцены
    this.bot.use(spamProtection());
    this.bot.use(userCheckMiddleware);
    this.bot.use(localSession.middleware());
    this.bot.use(stage.middleware());

    // Команда возврата в главное меню
    this.bot.command('menu', async (ctx) => {
      try {
        await ctx.scene.leave();
        ctx.session = { messages: [], sceneData: {} };
        await ctx.scene.enter('welcome');
        logger.info(`User ${ctx.from.id} returned to welcome menu`);
      } catch (error) {
        logger.error(`Menu handler error: ${error.message}`, { stack: error.stack });
        await ctx.reply('An error occurred. Please try again.');
      }
    });
  }

  registerHandlers() {
    // Обработка команды /start
    this.bot.start(async (ctx) => {
      try {
        ctx.session = { messages: [], sceneData: {} };
        await ctx.scene.enter('welcome');
        logger.info(`User ${ctx.from.id} started bot`);
      } catch (error) {
        logger.error(`Start handler error: ${error.message}`, { stack: error.stack });
        await ctx.reply('An error occurred. Please try again.');
      }
    });

    // Обработка обычных текстовых сообщений
    this.bot.on('text', async (ctx) => {
      try {
        if (!ctx.session.sceneData) {
          ctx.session.sceneData = {};
        }
        await ctx.scene.enter('welcome');
        logger.info(`User ${ctx.from.id} entered welcome scene`);
      } catch (error) {
        logger.error(`Text handler error: ${error.message}`, { stack: error.stack });
        await ctx.reply('An error occurred. Please try again.');
      }
    });

    // Переход в административный режим
    this.bot.command('admin', async (ctx) => {
      try {
        const config = await ConfigLoader.loadConfig();
        const admins = (config.administrators || []).map(String);
        if (!admins.includes(String(ctx.from.id))) {
          await ctx.reply('У вас нет доступа к этому разделу.');
          return;
        }
        await ctx.scene.enter('admin');
        logger.info(`User ${ctx.from.id} entered admin scene`);
      } catch (error) {
        logger.error(`Admin handler error: ${error.message}`, { stack: error.stack });
        await ctx.reply('An error occurred. Please try again.');
      }
    });

    // Глобальная обработка ошибок
    this.bot.catch((error, ctx) => {
      logger.error(`Global error: ${error.message}`, { stack: error.stack, user: ctx.from?.id });
      ctx.reply('Something went wrong. Please try again later.');
    });
  }

  // Запуск бота и обработка завершения работы
  start() {
    this.bot
      .launch()
      .then(() => logger.info('🤖 Bot started successfully'))
      .catch((error) => {
        logger.error(`Bot launch failed: ${error.message}`, { stack: error.stack });
        process.exit(1);
      });

    this.handleShutdown();
  }

  // Завершаем работу бота по сигналам ОС
  handleShutdown() {
    const stop = (signal) => {
      logger.warn(`Bot stopped (${signal})`);
      this.bot.stop(signal);
      if (this.emailInterval) {
        clearInterval(this.emailInterval);
      }
      process.exit(0);
    };

    process.once('SIGINT', () => stop('SIGINT'));
    process.once('SIGTERM', () => stop('SIGTERM'));
  }
}

try {
  new Bot();
} catch (error) {
  logger.error(`Bot initialization failed: ${error.message}`, { stack: error.stack });
  process.exit(1);
}

export default Bot;
