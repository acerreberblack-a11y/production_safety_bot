import ConfigLoader from "./configLoader.js";
import nodemailer from "nodemailer";
import logger from "./logger.js";
import db from '../../db/db.js';

const config = await ConfigLoader.loadConfig();
const { host, port, secure, user, password, rejectUnauthorized } = config.general?.email || {};

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

const sendTicketEmail = async (to) => {
    try {
        const transporter = await createTransporter();

        // Получаем тикеты с sent_email = false
        const tickets = await db('tickets')
            .select('tickets.*', 'users.email as user_email')
            .join('users', 'tickets.user_id', 'users.id')
            .where({ sent_email: false });

        for (const ticket of tickets) {
            // Получаем файлы тикета
            const files = await db('files').where({ ticket_id: ticket.id });

            // Проверяем суммарный размер вложений
            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            if (totalSize > 25 * 1024 * 1024) {
                console.warn(`Ticket ${ticket.id} skipped: attachments exceed 25MB`);
                continue;
            }

            // Формируем вложения
            const attachments = [];
            for (const file of files) {
                attachments.push({
                    filename: `${file.title}.${file.expansion}`,
                    content: file.data, // Бинарные данные из БД
                });
            }

            // Формируем список вложений
            let attachmentsHtml = '';
            files.forEach((file, index) => {
                attachmentsHtml += `
                    <div style="display: flex; align-items: center; background-color: #f5f5f5; padding: 12px; border-radius: 6px; margin: 4px 0; transition: all 0.2s ease;">
                        <svg xmlns="http://www.w3.org/2000/svg" style="height: 24px; width: 24px; color: #6b7280; margin-right: 8px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span style="color: #374151;">${'Вложение №' + index}.${file.expansion} ${file.title ? 'Описание: ' + file.title : '' }</span>
                    </div>
                `;
            });

            // HTML-шаблон письма с инлайн-стилями
            const htmlContent = `
                <!DOCTYPE html>
                    <html lang="ru">
                    <head>
                        <meta charset="UTF-8">
                        <title>Обращение #${ticket.id}</title>
                    </head>
                    <body style="margin:0; padding:0; background-color:#f5f5f5;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <td align="center" valign="top">
                                    <!-- Main Container -->
                                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: Arial, sans-serif;">
                                        <!-- Header -->
                                        <tr>
                                            <td bgcolor="#2563eb" style="padding:24px; color:#ffffff;">
                                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                                    <tr>
                                                        <td style="font-size:24px; font-weight:bold;">Обращение #${ticket.id}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                    
                                        <!-- Content -->
                                        <tr>
                                            <td style="padding:24px; color:#1f2937;">
                                                <!-- User Info -->
                                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height:1.6;">
                                                    <tr>
                                                        <td style="padding-bottom:8px;">
                                                            <strong style="color:#2563eb;">Пользователь:</strong> ${ticket.user_email || 'N/A'}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding-bottom:8px;">
                                                            <strong style="color:#2563eb;">Организация:</strong> ${ticket.organization}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding-bottom:8px;">
                                                            <strong style="color:#2563eb;">Филиал:</strong> ${ticket.branch || 'N/A'}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding-bottom:8px;">
                                                            <strong style="color:#2563eb;">Классификация:</strong> ${ticket.classification}
                                                        </td>
                                                    </tr>
                                                </table>
                    
                                                <!-- Message -->
                                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px; background-color:#f9fafb; padding:16px; border-radius:6px;">
                                                    <tr>
                                                        <td style="padding:12px;">
                                                            <strong style="color:#2563eb;">Сообщение:</strong><br/>
                                                            <span style="display:inline-block; margin-top:4px;">${ticket.message}</span>
                                                        </td>
                                                    </tr>
                                                </table>
                    
                                                <!-- Attachments -->
                                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
                                                    <tr>
                                                        <td>
                                                            <strong style="color:#2563eb;">Вложения:</strong>
                                                            <ul style="margin:8px 0 0 0; padding-left:20px;">
                                                                ${attachmentsHtml}
                                                            </ul>
                                                        </td>
                                                    </tr>
                                                </table>
                    
                                                <!-- Footer Note -->
                                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:32px; font-size:12px; color:#6b7280; font-style:italic;">
                                                    <tr>
                                                        <td>Это автоматическое сообщение от чат-бота "Безопасность производства". Просьба не отвечать на него.</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                    
                                        <!-- Timestamp Footer -->
                                        <tr>
                                            <td style="background-color:#f9fafb; padding:16px; font-size:12px; color:#6b7280;">
                                                Отправлено: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Berlin' })}
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </body>
                    </html>
            `;

            // Настройка письма
            const mailOptions = {
                from: user,
                to: to,
                subject: `Ticket #${ticket.id} - ${ticket.classification}`,
                html: htmlContent, // Используем HTML
                attachments,
            };

            // Отправка письма
            await transporter.sendMail(mailOptions);

            // Обновляем sent_email
            await db('tickets')
                .where({ id: ticket.id })
                .update({ sent_email: true });

            console.log(`Ticket ${ticket.id} sent to ${to}`);
        }
    } catch (error) {
        logger.error(`Error sending tickets: ${error.message}`, { stack: error.stack });
    }
};

// Вызываем метод периодически каждые 24 часа
const targetEmail = 'ProlubnikovVV@rushydro.ru';
setInterval(() => sendTicketEmail(targetEmail), 2000);

export { sendCodeEmail, sendTicketEmail };