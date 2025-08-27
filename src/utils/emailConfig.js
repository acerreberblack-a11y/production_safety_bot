import ConfigLoader from "./configLoader.js";
import nodemailer from "nodemailer";
import logger from "./logger.js";
import db from '../../db/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsRoot = path.join(__dirname, '..', 'reports');

const defaultHtmlTemplate = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>Обращение #{{ticketId}}</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f5f5f5;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td align="center" valign="top">
                    <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: Arial, sans-serif;">
                        <tr>
                            <td bgcolor="#2563eb" style="padding:24px; color:#ffffff;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="font-size:24px; font-weight:bold;">Обращение #{{ticketId}}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:24px; color:#1f2937;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height:1.6;">
                                    <tr><td style="padding-bottom:8px;"><strong style="color:#2563eb;">Пользователь:</strong> {{userEmail}}</td></tr>
                                    <tr><td style="padding-bottom:8px;"><strong style="color:#2563eb;">Организация:</strong> {{organization}}</td></tr>
                                    <tr><td style="padding-bottom:8px;"><strong style="color:#2563eb;">Филиал:</strong> {{branch}}</td></tr>
                                    <tr><td style="padding-bottom:8px;"><strong style="color:#2563eb;">Классификация:</strong> {{classification}}</td></tr>
                                </table>
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px; background-color:#f9fafb; padding:16px; border-radius:6px;">
                                    <tr><td style="padding:12px;"><strong style="color:#2563eb;">Сообщение:</strong><br/><span style="display:inline-block; margin-top:4px;">{{message}}</span></td></tr>
                                </table>
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:24px;">
                                    <tr><td><strong style="color:#2563eb;">Вложения:</strong><ul style="margin:8px 0 0 0; padding-left:20px;">{{attachmentsHtml}}</ul></td></tr>
                                </table>
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:32px; font-size:12px; color:#6b7280; font-style:italic;">
                                    <tr><td>Это автоматическое сообщение от чат-бота \"Безопасность производства\". Просьба не отвечать на него.</td></tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="background-color:#f9fafb; padding:16px; font-size:12px; color:#6b7280;">
                                Отправлено: {{date}}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
`;

const applyTemplate = (template, data) =>
    template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] ?? "");

const createTransporter = async () => {
    const config = await ConfigLoader.loadConfig();
    const { host, port, secure, user, password, rejectUnauthorized } =
        config.general?.email || {};

    if (!host || !user || !password) {
        throw new Error('Не заданы параметры почты');
    }

    return nodemailer.createTransport({
        host,
        port: Number(port) || 587,
        secure: Boolean(secure),
        auth: {
            user,
            pass: password,
        },
        tls: {
            rejectUnauthorized: rejectUnauthorized ?? true,
        },
    });
};

// Формирует HTML список вложений
const buildAttachmentsHtml = (files) =>
    (files || []).map((file, index) => {
        const ext = file.expansion || (file.name ? file.name.split('.').pop() : '');
        const description = file.title || file.description || '';
        return `
            <div style="display: flex; align-items: center; background-color: #f5f5f5; padding: 12px; border-radius: 6px; margin: 4px 0; transition: all 0.2s ease;">
                <svg xmlns=\"http://www.w3.org/2000/svg\" style=\"height: 24px; width: 24px; color: #6b7280; margin-right:8px;\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                    <path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z\" />
                </svg>
                <span style=\"color: #374151;\">${'Вложение №' + (index + 1)}.${ext} ${description ? 'Описание: ' + description : ''}</span>
            </div>
        `;
    }).join('');

const buildHtmlContent = (ticket, attachmentsHtml, template = defaultHtmlTemplate) => {
    const data = {
        ticketId: ticket.id,
        userEmail: ticket.user_email || 'N/A',
        organization: ticket.organization,
        branch: ticket.branch || 'N/A',
        classification: ticket.classification,
        message: ticket.message,
        attachmentsHtml,
        date: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Berlin' }),
    };
    return applyTemplate(template, data);
};

const sendCodeEmail = async (to, code) => {
    try {
        const config = await ConfigLoader.loadConfig();
        const { user } = config.general?.email || {};
        const transporter = await createTransporter();
        return await transporter.sendMail({
            from: user,
            to,
            subject: 'Код подтверждения',
            text: `Ваш код: ${code}`,
        });
    } catch (error) {
        logger.error(`Ошибка при отправке email: ${error.message}`, { stack: error.stack });
        throw error;
    }
};

const sendTicketEmail = async () => {
    try {
        const config = await ConfigLoader.loadConfig();
        const { user, support_email: to, ticket_subject, ticket_template } = config.general?.email || {};
        if (!to) {
            throw new Error('Не указан адрес получателя для обращений');
        }

        const transporter = await createTransporter();

        const tickets = await db('tickets')
            .select('tickets.*', 'users.email as user_email')
            .join('users', 'tickets.user_id', 'users.id')
            .where({ sent_email: false });

        for (const ticket of tickets) {
            const files = await db('files').where({ ticket_id: ticket.id });
            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            if (totalSize > 25 * 1024 * 1024) {
                console.warn(`Ticket ${ticket.id} skipped: attachments exceed 25MB`);
                continue;
            }

            const attachments = files.map(file => ({
                filename: `${file.title}.${file.expansion}`,
                content: file.data,
            }));

            const attachmentsHtml = buildAttachmentsHtml(files);
            const htmlContent = buildHtmlContent(ticket, attachmentsHtml, ticket_template);
            const subjectTemplate = ticket_subject || 'Ticket #{{ticketId}} - {{classification}}';
            const subject = applyTemplate(subjectTemplate, {
                ticketId: ticket.id,
                classification: ticket.classification,
            });

            await transporter.sendMail({
                from: user,
                to,
                subject,
                html: htmlContent,
                attachments,
            });

            await db('tickets')
                .where({ id: ticket.id })
                .update({ sent_email: true });

            console.log(`Ticket ${ticket.id} sent to ${to}`);
        }
    } catch (error) {
        logger.error(`Error sending tickets: ${error.message}`, { stack: error.stack });
    }
};

const startTicketEmailSender = () => {
    const intervalMs = 24 * 60 * 60 * 1000; // 24 часа
    sendTicketEmail().catch((err) =>
        logger.error(`Initial ticket send failed: ${err.message}`, { stack: err.stack })
    );
    return setInterval(() => {
        sendTicketEmail().catch((err) =>
            logger.error(`Scheduled ticket send failed: ${err.message}`, { stack: err.stack })
        );
    }, intervalMs);
};

const sendReportsFromFolder = async () => {
    try {
        const config = await ConfigLoader.loadConfig();
        const { user, support_email: to, ticket_subject, ticket_template } = config.general?.email || {};
        if (!to) {
            throw new Error('Не указан адрес получателя для обращений');
        }
        const transporter = await createTransporter();

        const userDirs = await fs.readdir(reportsRoot, { withFileTypes: true }).catch(() => []);

        for (const userDir of userDirs) {
            if (!userDir.isDirectory()) continue;
            const userPath = path.join(reportsRoot, userDir.name);
            const ticketDirs = await fs.readdir(userPath, { withFileTypes: true });

            for (const ticketDir of ticketDirs) {
                if (!ticketDir.isDirectory()) continue;
                const ticketPath = path.join(userPath, ticketDir.name);

                try {
                    const issueFile = path.join(ticketPath, 'issue.json');
                    const issueData = JSON.parse(await fs.readFile(issueFile, 'utf8'));

                    const attachments = [];
                    for (const fileInfo of (issueData.files || [])) {
                        const filePath = path.join(ticketPath, fileInfo.name);
                        try {
                            const data = await fs.readFile(filePath);
                            attachments.push({ filename: fileInfo.name, content: data });
                        } catch (err) {
                            logger.error(`Ошибка чтения файла ${filePath}: ${err.message}`);
                        }
                    }

                    const attachmentsHtml = buildAttachmentsHtml(issueData.files || []);
                    const ticketData = {
                        id: ticketDir.name,
                        user_email: issueData.user,
                        organization: issueData.company,
                        branch: issueData.filial,
                        classification: issueData.classification,
                        message: issueData.text,
                    };
                    const htmlContent = buildHtmlContent(ticketData, attachmentsHtml, ticket_template);
                    const subjectTemplate = ticket_subject || 'Ticket #{{ticketId}} - {{classification}}';
                    const subject = applyTemplate(subjectTemplate, {
                        ticketId: ticketData.id,
                        classification: ticketData.classification,
                    });

                    await transporter.sendMail({
                        from: user,
                        to,
                        subject,
                        html: htmlContent,
                        attachments,
                    });

                    await fs.rm(ticketPath, { recursive: true, force: true });
                    logger.info(`Отправлено обращение из ${ticketPath}, папка удалена`);
                } catch (err) {
                    logger.error(`Ошибка обработки ${ticketPath}: ${err.message}`);
                }
            }

            const remaining = await fs.readdir(userPath).catch(() => []);
            if (remaining.length === 0) {
                await fs.rm(userPath, { recursive: true, force: true });
            }
        }
    } catch (error) {
        logger.error(`Error sending reports from folder: ${error.message}`, { stack: error.stack });
    }
};

const startReportEmailSender = () => {
    const intervalMs = 24 * 60 * 60 * 1000; // 24 часа
    sendReportsFromFolder().catch((err) =>
        logger.error(`Initial report send failed: ${err.message}`, { stack: err.stack })
    );
    return setInterval(() => {
        sendReportsFromFolder().catch((err) =>
            logger.error(`Scheduled report send failed: ${err.message}`, { stack: err.stack })
        );
    }, intervalMs);
};

export { sendCodeEmail, sendTicketEmail, startTicketEmailSender, sendReportsFromFolder, startReportEmailSender };
