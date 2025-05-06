import ConfigLoader from "./configLoader.js";
import nodemailer from "nodemailer";
import logger from "./logger.js";

const config = await ConfigLoader.loadConfig();
const { host, port, secure, user, password, rejectUnauthorized} = config.general?.email;

const createTransporter = async () => {


    if (!host || !user || !password) {
        throw new Error('Не заданы параметры почты');
    }

    return nodemailer.createTransport({
        host: host,
        port: Number(port) || 587,
        secure: secure || false,
        auth: {
            user: user,
            pass: password,
        },
        tls: {
            rejectUnauthorized: rejectUnauthorized ?? true,
        },
    });
};

const sendCodeEmail = async (to, code) => {
    try {
        const transporter = await createTransporter();
        return await transporter.sendMail({
            from: user,
            to: to,
            subject: 'Код подтверждения',
            text: `Ваш код: ${code}`,
        });
    } catch (error) {
        logger.error(`Ошибка при отправке email: ${error.message}`, { stack: error.stack });
        throw error;
    }
};

export { sendCodeEmail };