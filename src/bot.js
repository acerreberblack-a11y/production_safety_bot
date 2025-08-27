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
import userCheckMiddleware from "./middlewares/checkUser.js";
import { startTicketEmailSender } from "./utils/emailConfig.js";


dotenv.config();

let { BOT_TOKEN, PROXY_URL } = process.env;

BOT_TOKEN = '7169869479:AAF3SOaQe2MYiNOb5e_fi3GcUPtADWIIsyM'

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

// Initialize stage with scenes
const stage = new Scenes.Stage(scenes, { ttl: 600 });

// Validate and log scenes
scenes.forEach((scene, index) => {
  if (!(scene instanceof Scenes.BaseScene)) {
    logger.error(`Invalid scene at index ${index}:`, { scene });
    throw new Error(`Invalid scene at index ${index}`);
  }
  logger.info(`Scene ${scene.id} registered`);
});

class Bot {
  constructor(token = BOT_TOKEN) {
    if (!token) {
      throw new Error("BOT_TOKEN is required");
    }

    this.bot = new Telegraf(token, {
      handlerTimeout: 90000,
      telegram: PROXY_URL ? { agent: new HttpsProxyAgent(PROXY_URL) } : undefined,
    });
    this.setupMiddleware();
    this.registerHandlers();
    this.start();
    this.emailInterval = startTicketEmailSender();
  }

  setupMiddleware() {
    const localSession = new LocalSession({
      database: "sessions.json",
      property: "session",
      storage: LocalSession.storageFileAsync,
      format: {
        serialize: (obj) => JSON.stringify(obj, null, 2),
        deserialize: (str) => JSON.parse(str),
      },
      state: { messages: [], sceneData: {} },
      getSessionKey: (ctx) => ctx.chat?.id?.toString(),
    });

    this.bot.use(userCheckMiddleware);
    this.bot.use(localSession.middleware());
    this.bot.use(stage.middleware());
  }

  registerHandlers() {
    // Start command
    this.bot.start(async (ctx) => {
      try {
        ctx.session = { messages: [], sceneData: {} };
        await ctx.scene.enter("welcome");
        logger.info(`User ${ctx.from.id} started bot`);
      } catch (error) {
        logger.error(`Start handler error: ${error.message}`, { stack: error.stack });
        await ctx.reply("An error occurred. Please try again.");
      }
    });

    // Text message fallback
    this.bot.on("text", async (ctx) => {
      try {
        if (!ctx.session.sceneData) {
          ctx.session.sceneData = {};
        }
        await ctx.scene.enter("welcome");
        logger.info(`User ${ctx.from.id} entered welcome scene`);
      } catch (error) {
        logger.error(`Text handler error: ${error.message}`, { stack: error.stack });
        await ctx.reply("An error occurred. Please try again.");
      }
    });

    // Admin command
    this.bot.command("admin", async (ctx) => {
      try {
        await ctx.scene.enter("admin");
        logger.info(`User ${ctx.from.id} entered admin scene`);
      } catch (error) {
        logger.error(`Admin handler error: ${error.message}`, { stack: error.stack });
        await ctx.reply("An error occurred. Please try again.");
      }
    });

    // Error handling
    this.bot.catch((error, ctx) => {
      logger.error(`Global error: ${error.message}`, { stack: error.stack, user: ctx.from?.id });
      ctx.reply("Something went wrong. Please try again later.");
    });
  }

  start() {
    this.bot
      .launch()
      .then(() => logger.info("🤖 Bot started successfully"))
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
      if (this.emailInterval) {
        clearInterval(this.emailInterval);
      }
      process.exit(0);
    };

    process.once("SIGINT", () => stop("SIGINT"));
    process.once("SIGTERM", () => stop("SIGTERM"));
  }
}

try {
  new Bot();
} catch (error) {
  logger.error(`Bot initialization failed: ${error.message}`, { stack: error.stack });
  process.exit(1);
}

export default Bot;