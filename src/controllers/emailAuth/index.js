import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import { findUserByTelegramId, updateUser } from '../../../db/users.js';
import { sendCodeEmail } from '../../utils/emailConfig.js';
import ConfigLoader from '../../utils/configLoader.js';

const emailAuth = new Scenes.BaseScene('emailAuth');

const generateAuthCode = () => Math.floor(100000 + Math.random() * 900000).toString();
/** @type {Map<number, number>} */
const lastCodeSent = new Map();

// Разрешён только домен rushydro.ru
const isRushydroEmail = (email) => /^[a-zA-Z0-9._%+-]+@rushydro\.ru$/i.test(String(email).trim());

emailAuth.enter(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const user = await findUserByTelegramId(telegramId);
    if (!user) throw new Error('User not found');

    ctx.session.user = user;

    const fromProfile = ctx.session.emailFlow === 'profile';

    // Если уже есть email и не из профиля — пропускаем ТОЛЬКО если домен допустим
    if (user.email && !fromProfile) {
      if (isRushydroEmail(user.email)) {
        await ctx.reply(`Авторизация уже выполнена.\nВаш email: ${user.email}.`, { parse_mode: 'HTML' });
        ctx.session.ticketType = user.email;
        await ctx.scene.enter('organization');
        return;
      }
      // Просим корпоративный адрес
      ctx.session.email = null;
      ctx.session.authCode = null;
      await ctx.reply(
        `Ваш текущий email (${user.email}) не из домена @rushydro.ru.\nПожалуйста, введите рабочую почту вида name@rushydro.ru.`,
        {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: 'Отменить заполнение', callback_data: 'cancel_auth' }]] },
        },
      );
      return;
    }

    // Обычный заход в сцену
    ctx.session.email = null;
    ctx.session.authCode = null;
    const config = await ConfigLoader.loadConfig();
    const authConfig = config.controllers?.emailAuth;
    const baseText = fromProfile
      ? (authConfig?.textProfile || 'Для подтверждения аккаунта введите ваш email.')
      : (authConfig?.text || 'Для продолжения работы введите ваш email. Я использую его для идентификации вашего аккаунта.');

    const text = `${baseText}\n\n<b>Внимание:</b> принимаются только адреса в домене <b>@rushydro.ru</b>.`;

    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: 'Отменить заполнение', callback_data: 'cancel_auth' }]] },
    });
  } catch (error) {
    logger.error(`Error in emailAuth enter: ${error.message}`);
    await ctx.reply('Ошибка. Попробуйте снова.');
    await ctx.scene.enter('ticketType');
  }
});

emailAuth.on('text', async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const enteredText = (ctx.message.text || '').trim();

    if (!ctx.session.email) {
      // Валидация домена @rushydro.ru
      if (!isRushydroEmail(enteredText)) {
        await ctx.reply(
          'Неверный формат или домен email.\nРазрешены только адреса вида <b>name@rushydro.ru</b>.',
          { parse_mode: 'HTML' },
        );
        return;
      }

      ctx.session.email = enteredText.toLowerCase();
      ctx.session.authCode = generateAuthCode();

      if (Date.now() - (lastCodeSent.get(telegramId) || 0) < 120000) {
        await ctx.reply('Запросите код через 2 минуты.');
        return;
      }

      await sendCodeEmail(ctx.session.email, ctx.session.authCode);

      lastCodeSent.set(telegramId, Date.now());
      await ctx.reply(
        `Код отправлен на ${ctx.session.email}.\nПожалуйста, введите код для подтверждения:`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Отправить повторно', callback_data: 'resend_code' }, { text: 'Отменить заполнение', callback_data: 'cancel_auth' }],
            ],
          },
        },
      );
    } else {
      // Проверка кода
      if (enteredText === ctx.session.authCode) {
        // Доп. проверка домена перед сохранением
        if (!isRushydroEmail(ctx.session.email)) {
          await ctx.reply(
            'Разрешены только адреса в домене @rushydro.ru. Введите корректный email.',
            { parse_mode: 'HTML' },
          );
          delete ctx.session.email;
          delete ctx.session.authCode;
          return;
        }

        await updateUser(telegramId, { email: ctx.session.email });
        ctx.session.user = { ...ctx.session.user, email: ctx.session.email };

        await ctx.reply('Готово! Авторизация прошла успешно.', { parse_mode: 'HTML' });

        if (ctx.session.emailFlow === 'profile') {
          delete ctx.session.emailFlow;
          delete ctx.session.authCode;
          delete ctx.session.email;
          await ctx.scene.enter('welcome');
        } else {
          await ctx.scene.enter('organization');
          ctx.session.ticketType = ctx.session.user.email;
          delete ctx.session.authCode;
          delete ctx.session.email;
        }
      } else {
        await ctx.reply('Неверный код.', {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Отправить повторно', callback_data: 'resend_code' }, { text: 'Отменить заполнение', callback_data: 'cancel_auth' }],
            ],
          },
        });
      }
    }
  } catch (error) {
    logger.error(`Error in emailAuth text handler: ${error.message}`);
    await ctx.reply('Ошибка при отправке кода авторизации. Попробуйте снова.', { parse_mode: 'HTML' });
  }
});

emailAuth.action('resend_code', async (ctx) => {
  try {
    const telegramId = ctx.from.id;

    if (!ctx.session.email || !isRushydroEmail(ctx.session.email)) {
      await ctx.answerCbQuery('Укажите корпоративный email @rushydro.ru сначала.');
      await ctx.reply('Пожалуйста, введите рабочую почту вида <b>name@rushydro.ru</b>.', { parse_mode: 'HTML' });
      return;
    }

    if (Date.now() - (lastCodeSent.get(telegramId) || 0) < 120000) {
      await ctx.answerCbQuery('Запросите код через 2 минуты.');
      return;
    }

    ctx.session.authCode = generateAuthCode();
    await sendCodeEmail(ctx.session.email, ctx.session.authCode);

    lastCodeSent.set(telegramId, Date.now());
    await ctx.reply(`Код повторно отправлен на ${ctx.session.email}.`, { parse_mode: 'HTML' });
    await ctx.answerCbQuery('Код отправлен повторно');
  } catch (error) {
    logger.error(`Error in resend_code action: ${error.message}`);
    await ctx.reply('Ошибка при повторной отправке кода.');
  }
});

emailAuth.action('cancel_auth', async (ctx) => {
  try {
    delete ctx.session.email;
    delete ctx.session.authCode;
    delete ctx.session.ticketType;
    delete ctx.session.emailFlow;
    await ctx.reply('Заполнение обращения было отменено.', {
      reply_markup: { remove_keyboard: true },
    });
    await ctx.scene.enter('welcome');
  } catch (error) {
    logger.error(`Error in cancel_auth action: ${error.message}`);
    await ctx.reply('Ошибка при отмене авторизации.');
  }
});

export default emailAuth;
