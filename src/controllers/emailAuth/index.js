import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import { findUserByTelegramId, updateUser } from '../../../db/users.js';
import { sendCodeEmail } from '../../utils/emailConfig.js'

const emailAuth = new Scenes.BaseScene('emailAuth');

const generateAuthCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const lastCodeSent = new Map();

emailAuth.enter(async (ctx) => {
    try {
        const telegramId = ctx.from.id;
        const user = await findUserByTelegramId(telegramId);
        if (!user) throw new Error('User not found');

        if (user.email) {
            await ctx.reply(`Авторизация уже выполнена.\nВаш email: ${user.email}.`, { parse_mode: 'HTML', });
            ctx.session.ticketType = user.email;
            await ctx.scene.enter('organization');
            return;
        }

        ctx.session.email = null;
        ctx.session.authCode = null;
        await ctx.reply('Для продолжения работы введите ваш email. Я использую его для идентификации вашего аккаунта.', {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: 'Отмена', callback_data: 'cancel_auth' }]] },
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
        const enteredText = ctx.message.text;

        if (!ctx.session.email) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredText)) {
                await ctx.reply('Неверный формат email. Пожалуйста, введите корректный адрес электронной почты.', { parse_mode: 'HTML' });
                return;
            }

            ctx.session.email = enteredText;
            ctx.session.authCode = generateAuthCode();

            if (Date.now() - (lastCodeSent.get(telegramId) || 0) < 120000) {
                await ctx.reply('Запросите код через 2 минуты.');
                return;
            }

            await sendCodeEmail(ctx.session.email, ctx.session.authCode);

            lastCodeSent.set(telegramId, Date.now());
            await ctx.reply(`Код отправлен на ${ctx.session.email}.\nПожалуйста, введите код для подтверждения.:`, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: 'Отправить повторно', callback_data: 'resend_code' }, { text: 'Отмена', callback_data: 'cancel_auth' }]] },
            });
        } else {
            if (enteredText === ctx.session.authCode) {
                await updateUser(telegramId, { email: ctx.session.email });
                await ctx.reply('Готово! Авторизация прошла успешно.', { parse_mode: 'HTML' });
                await ctx.scene.enter('organization');
                ctx.session.ticketType = ctx.session.email
                delete ctx.session.authCode;
                delete ctx.session.email;
            } else {
                await ctx.reply('Неверный код.', {
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [[{ text: 'Отправить повторно', callback_data: 'resend_code' }, { text: 'Отмена', callback_data: 'cancel_auth' }]] },
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
        await ctx.reply('Авторизация отменена.');
        await ctx.scene.enter('ticketType');
    } catch (error) {
        logger.error(`Error in cancel_auth action: ${error.message}`);
        await ctx.reply('Ошибка при отмене авторизации.');
    }
});

export default emailAuth;