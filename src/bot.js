import dotenv from "dotenv";
import { Telegraf, Scenes } from "telegraf";
import LocalSession from "telegraf-session-local";
import { HttpsProxyAgent } from "https-proxy-agent";
import logger from "./utils/logger.js";

import welcome from "./controllers/welcome/index.js";
import description from "./controllers/description/index.js";
import ticketType from "./controllers/ticketType/index.js";
import emailAuth from "./controllers/emailAuth/index.js";
import organization from "./controllers/organization/index.js";
import classification from "./controllers/classification/index.js";
import reportIssue from "./controllers/reportIssue/index.js";
import admin from "./controllers/admin/index.js";

import userCheckMiddleware from './middlewares/checkUser.js'

dotenv.config();

const stage = new Scenes.Stage([
    welcome,
    description,
    ticketType,
    emailAuth,
    organization,
    classification,
    reportIssue,
    admin
], {
    ttl: 600
});

// Логирование сцен
[welcome, description, ticketType, emailAuth, organization, classification, reportIssue, admin].forEach((scene, index) => {
    if (!(scene instanceof Scenes.BaseScene)) {
        logger.error(`Scene at index ${index} is not a valid BaseScene:`, { scene });
        throw new Error(`Invalid scene at index ${index}: ${scene}`);
    } else {
        logger.info(`Scene ${scene.id} registered successfully`);
    }
});

class Bot {
    constructor(token) {
        if (!token) {
            throw new Error("BOT_TOKEN is not provided.");
        }

        this.bot = new Telegraf(token, { handlerTimeout: 90000 });
        this.setupMiddleware();
        this.startHandlers();
        this.start();
    }

    setupMiddleware() {
        // Настройка LocalSession
        const localSession = new LocalSession({
            database: 'example_db.json',
            property: 'session',
            storage: LocalSession.storageFileAsync,
            format: {
                serialize: (obj) => JSON.stringify(obj, null, 2),
                deserialize: (str) => JSON.parse(str)
            },
            state: { messages: [] },
            getSessionKey: (ctx) => {
                return ctx.chat?.id ? `${ctx.chat.id}:${ctx.chat.id}` : undefined;
            }
        });

        this.bot.use(userCheckMiddleware);
        this.bot.use(localSession.middleware());
        this.bot.use(stage.middleware());
    }

    startHandlers() {
        // Обработчик команды /start
        this.bot.start(async (ctx) => {
            try {
                // Полная очистка сессии
                ctx.session = {};
                ctx.session.messages = [];

                await ctx.scene.enter('welcome');
                logger.info(`User ${ctx.from.id} entered welcome scene via /start`);
            } catch (error) {
                logger.error(`Error in /start handler: ${error.message}`, { stack: error.stack });
            }
        });

        //Команда /start
        this.bot.on('text', async (ctx) => {
            try {
                await ctx.scene.enter('welcome');
                logger.info(`User ${ctx.from.id} entered welcome scene`);
            }
            catch (error) {
                logger.error(`Error in /start handler: ${error.message}`, { stack: error.stack });
            }
        });

        // Команда для администратора
        this.bot.command('admin', async (ctx) => {
            try {
                await ctx.scene.enter('admin');
                logger.info(`User ${ctx.from.id} entered admin scene`);
            } catch (error) {
                logger.error(`Error in /admin handler: ${error.message}`, { stack: error.stack });
            }
        });
    }

    start() {
        this.bot.launch()
            .then(() => {
                logger.info("🤖 Bot successfully started!");
            })
            .catch((error) => {
                logger.error(`Bot launch error: ${error.message}`, { stack: error.stack });
                process.exit(1);
            });

        this.handleShutdown();
    }

    handleShutdown() {
        process.once("SIGINT", () => {
            this.bot.stop("SIGINT");
            logger.warn("Bot stopped (SIGINT)");
            process.exit(0);
        });

        process.once("SIGTERM", () => {
            this.bot.stop("SIGTERM");
            logger.warn("Bot stopped (SIGTERM)");
            process.exit(0);
        });
    }
}

try {
    const botInstance = new Bot(process.env.TELEGRAM_BOT_TOKEN);
} catch (error) {
    logger.error("Ошибка инициализации бота: %s", error, { stack: error.stack });
    process.exit(1);
}

export default Bot;