/* eslint-disable import/extensions */
import '../env.js';

import { Telegraf, Scenes, session } from 'telegraf';
import { Redis as RedisStore } from '@telegraf/session/redis';
import { HttpsProxyAgent } from 'https-proxy-agent';

import logger from './utils/logger.js';
import handleError from './utils/errorHandler.js';

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
import forceHtml from './middlewares/forceHtml.js';

import { startReportEmailSender } from './utils/emailConfig.js';
import ConfigLoader from './utils/configLoader.js';

const {
  BOT_TOKEN,
  PROXY_URL,
  REDIS_URL,
  REDIS_HOST = '127.0.0.1',
  REDIS_PORT = '6379',
  REDIS_PASSWORD,
  REDIS_TLS, // "1" -> rediss://
} = process.env;

// Список доступных сцен
const scenes = [
  welcome,
  description,
  ticketType,
  emailAuth,
  organization,
  classification,
  reportIssue,
  admin,
];

// Инициализация stage
const stage = new Scenes.Stage(scenes, { ttl: 600 });

// Проверяем корректность сцен и логируем регистрацию
scenes.forEach((scene, index) => {
  if (!(scene instanceof Scenes.BaseScene)) {
    logger.error(`Invalid scene at index ${index}:`, { scene });
    throw new Error(`Invalid scene at index ${index}`);
  }
  logger.info(`Scene ${scene.id} registered`);
});

const defaultSession = () => ({ messages: [], sceneData: {} });
const getSessionKey = (ctx) => {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  return userId && chatId ? `${chatId}:${userId}` : undefined;
};
const buildRedisUrl = () => {
  if (REDIS_URL) return REDIS_URL;
  const proto = REDIS_TLS === '1' ? 'rediss' : 'redis';
  const auth = REDIS_PASSWORD ? `:${encodeURIComponent(REDIS_PASSWORD)}@` : '';
  return `${proto}://${auth}${REDIS_HOST}:${REDIS_PORT}`;
};

// Основной класс Telegram-бота
export class Bot {
  constructor(token = BOT_TOKEN) {
    if (!token) throw new Error('BOT_TOKEN is required');

    const telegrafOptions = { handlerTimeout: 90_000 };
    if (PROXY_URL) telegrafOptions.telegram = { agent: new HttpsProxyAgent(PROXY_URL) };

    this.bot = new Telegraf(token, telegrafOptions);
    this.emailInterval = null;

    // инициализируем store один раз и сохраняем ссылку
    this.sessionStore = RedisStore({
      url: buildRedisUrl(),
      prefix: 'tg:sess:',
    });

    this.setupMiddleware();
    this.registerHandlers();
    this.start();
    this.emailInterval = startReportEmailSender();
  }

  setupMiddleware() {
    // 0) принудительное использование HTML
    this.bot.use(forceHtml());

    // 1) сессии
    this.bot.use(
      session({
        store: this.sessionStore,
        getSessionKey,
        defaultSession,
      }),
    );

    // 2) сцены
    this.bot.use(stage.middleware());

    // 3) РАННИЙ обработчик /start — до остальных middlewares/handlers
    this.bot.use(async (ctx, next) => {
      const text = ctx.update?.message?.text;
      const isStart = ctx.updateType === 'message'
        && typeof text === 'string'
        && /^\/start(?:@\w+)?(?:\s|$)/.test(text);

      if (!isStart) return next();

      try {
        // ВЫЙТИ из текущей сцены на старой сессии
        await ctx.scene.leave().catch(() => {});

        // ЖЁСТКО удалить запись сессии в Redis
        const key = getSessionKey(ctx);
        if (key) {
          await this.sessionStore.delete(key);
        }

        // Создать ЧИСТУЮ сессию (нельзя оставлять null перед enter)
        // eslint-disable-next-line no-param-reassign
        ctx.session = defaultSession();

        // Зайти в welcome
        await ctx.scene.enter('welcome');

        const { id: userId } = ctx.from || {};
        logger.info(`User ${userId} started bot (session purged & reinitialized)`);
      } catch (error) {
        await handleError(ctx, error);
      }
      return undefined; // не пропускаем дальше
    });

    // 4) остальной пайплайн
    this.bot.use(spamProtection());
    this.bot.use(userCheckMiddleware);

    // /menu — вернуться в главное, тоже чистим запись в Redis
    this.bot.command('menu', async (ctx) => {
      try {
        await ctx.scene.leave();

        const key = getSessionKey(ctx);
        if (key) {
          await this.sessionStore.delete(key);
        }
        // eslint-disable-next-line no-param-reassign
        ctx.session = defaultSession();

        await ctx.scene.enter('welcome');

        const { id: userId } = ctx.from || {};
        logger.info(`User ${userId} returned to welcome (session purged & reinitialized)`);
      } catch (error) {
        await handleError(ctx, error);
      }
    });
  }

  registerHandlers() {
    // Явный .start не нужен — /start ловится ранним middleware.

    // Обычные текстовые сообщения
    this.bot.on('text', async (ctx) => {
      try {
        if (!ctx.session) {
          // eslint-disable-next-line no-param-reassign
          ctx.session = defaultSession();
        } else if (!ctx.session.sceneData) {
          // eslint-disable-next-line no-param-reassign
          ctx.session.sceneData = {};
        }

        await ctx.scene.enter('welcome');

        const { id: userId } = ctx.from || {};
        logger.info(`User ${userId} entered welcome scene`);
      } catch (error) {
        await handleError(ctx, error);
      }
    });

    // Админ-команда
    this.bot.command('admin', async (ctx) => {
      try {
        const config = await ConfigLoader.loadConfig();
        const admins = (config.administrators || []).map(String);

        const { id: userId } = ctx.from || {};
        if (!admins.includes(String(userId))) {
          await ctx.reply('У вас нет доступа к этому разделу.');
          return;
        }

        await ctx.scene.enter('admin');
        logger.info(`User ${userId} entered admin scene`);
      } catch (error) {
        await handleError(ctx, error);
      }
    });

    // Глобальная обработка ошибок
    this.bot.catch(async (error, ctx) => {
      await handleError(ctx, error, 'Something went wrong. Please try again later.');
    });
  }

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

  handleShutdown() {
    const stop = (signal) => {
      logger.warn(`Bot stopped (${signal})`);
      this.bot.stop(signal);
      if (this.emailInterval) clearInterval(this.emailInterval);
      process.exit(0);
    };

    process.once('SIGINT', () => stop('SIGINT'));
    process.once('SIGTERM', () => stop('SIGTERM'));
  }
}

let bot;
try {
  bot = new Bot();
} catch (error) {
  logger.error(`Bot initialization failed: ${error.message}`, { stack: error.stack });
  process.exit(1);
}

export { bot };
export default Bot;
