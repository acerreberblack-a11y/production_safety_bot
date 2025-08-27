import ConfigLoader from "./configLoader.js";
import nodemailer from "nodemailer";
import logger from "./logger.js";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsRoot = path.join(__dirname, '..', 'reports');

// Шаблон письма по умолчанию для обращения
const defaultHtmlTemplate = `
        <!doctype html>
        <html lang="ru">
        <head><meta charset="utf-8"><title>Обращение #{{ticketId}}</title></head>
        <body style="margin:0;padding:0;background-color:#f5f5f5">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr><td align="center" valign="top">
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background:#fff;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,.1);font-family:Arial,sans-serif">
                <tr>
                  <td bgcolor="#2563eb" style="padding:24px;color:#fff;font-size:24px;font-weight:700">
                    Обращение #{{ticketId}}
                  </td>
                </tr>

                <tr><td style="padding:24px;color:#1f2937">
                  <table width="100%" cellpadding="0" cellspacing="0" style="line-height:1.6">
                    <tr><td style="padding-bottom:8px"><strong style="color:#2563eb">Пользователь:</strong> {{userEmail}}</td></tr>
                    <tr><td style="padding-bottom:8px"><strong style="color:#2563eb">Организация:</strong> {{organization}}</td></tr>
                    <tr><td style="padding-bottom:8px"><strong style="color:#2563eb">Филиал:</strong> {{branch}}</td></tr>
                    <tr><td style="padding-bottom:8px"><strong style="color:#2563eb">Классификация:</strong> {{classification}}</td></tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f9fafb;padding:16px;border-radius:6px">
                    <tr><td style="padding:12px">
                      <strong style="color:#2563eb">Сообщение:</strong><br>
                      <span style="display:inline-block;margin-top:4px">{{message}}</span>
                    </td></tr>
                  </table>

                  {{attachmentsSection}}

                  <div style="margin-top:32px;font-size:12px;color:#6b7280;font-style:italic">
                    Это автоматическое сообщение от чат-бота «Безопасность производства». Просьба не отвечать на него.
                  </div>
                </td></tr>

                <tr>
                  <td style="background:#f9fafb;padding:16px;font-size:12px;color:#6b7280">
                    Отправлено: {{date}}
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `;

// Экранируем специальные HTML-символы
const escapeHtml = (text = "") =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

// Подставляем данные в шаблон вида {{key}}
const applyTemplate = (template, data) =>
  (template || "").replace(/{{\s*(\w+)\s*}}/g, (_, key) => data[key] ?? "");

// Создаём транспорт для отправки почты
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
    auth: { user, pass: password },
    tls: { rejectUnauthorized: rejectUnauthorized ?? true },
  });
};

// Формирует HTML-список вложений
const buildAttachmentsHtml = (files) =>
  (files || []).map((file, index) => {
    const ext = escapeHtml(
      file.expansion || (file.name ? file.name.split('.').pop() : '') || ''
    );
    const title = escapeHtml(file.title || file.description || '');
    const name = `Вложение №${index + 1}.${ext}`;
    const titlePart = title ? ` — ${title}` : '';
    return `
      <li style="margin:6px 0;background:#f5f5f5;padding:10px;border-radius:6px;list-style:none;display:flex;align-items:center;">
        <span style="display:inline-flex;width:24px;height:24px;margin-right:8px;opacity:.7">📎</span>
        <span style="color:#374151">${name}${titlePart}</span>
      </li>
    `;
  }).join('');

// Формируем HTML-письмо для обращения
const buildHtmlContent = (ticket, attachmentsHtml, template = defaultHtmlTemplate) => {
  const attachmentsSection = attachmentsHtml
    ? `\n                    <div style="margin-top:24px">\n                      <strong style="color:#2563eb">Вложения:</strong>\n                      <ul style="margin:8px 0 0 0;padding:0">${attachmentsHtml}</ul>\n                    </div>`
    : '';
  const data = {
    ticketId: escapeHtml(String(ticket.id)),
    userEmail: escapeHtml(ticket.user_email || 'N/A'),
    organization: escapeHtml(ticket.organization || 'N/A'),
    branch: escapeHtml(ticket.branch || 'N/A'),
    classification: escapeHtml(ticket.classification || 'N/A'),
    message: escapeHtml(ticket.message || ''),
    attachmentsSection,
    date: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
  };
  return applyTemplate(template, data);
};

// Отправка письма с кодом подтверждения
const sendCodeEmail = async (to, code) => {
  try {
    const config = await ConfigLoader.loadConfig();
    const { user } = config.general?.email || {};
    const transporter = await createTransporter();

    // HTML по умолчанию
    const html = `
      <!doctype html>
      <html lang="ru"><head><meta charset="utf-8"><title>Код подтверждения</title></head>
      <body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px">
        <table align="center" cellpadding="0" cellspacing="0" width="480" style="background:#fff;border-radius:8px;padding:24px">
          <tr><td>
            <h2 style="margin:0 0 12px 0;color:#2563eb">Код подтверждения</h2>
            <p>Ваш код:</p>
            <div style="font-size:28px;font-weight:700;letter-spacing:2px">${escapeHtml(String(code))}</div>
          </td></tr>
        </table>
      </body></html>
    `;

    return await transporter.sendMail({
      from: user,
      to,
      subject: 'Код подтверждения',
      html,                          // ← HTML содержимое по умолчанию
      text: `Ваш код: ${code}`,      // fallback
    });
  } catch (error) {
    logger.error(`Ошибка при отправке email: ${error.message}`, { stack: error.stack });
    throw error;
  }
};

const sendReportsFromFolder = async () => {
  try {
    const config = await ConfigLoader.loadConfig();
    const { user, support_email: to, ticket_subject, ticket_template } = config.general?.email || {};
    if (!to) throw new Error('Не указан адрес получателя для обращений');

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
              attachments.push({ filename: fileInfo.name || 'attachment.bin', content: data });
            } catch (err) {
              logger.error(`Ошибка чтения файла ${filePath}: ${err.message}`);
            }
          }

          const attachmentsHtml = buildAttachmentsHtml(issueData.files ?? []);

          const ticketData = {
            id: ticketDir.name,
            user_email: issueData.type ? `${issueData.user} (${issueData.type})` : 'Аноним',
            organization: issueData.company,
            branch: issueData.filial,
            classification: issueData.classification,
            message: issueData.text,
          };

          // HTML по умолчанию
          const effectiveTemplate =
            (typeof ticket_template === 'string' && ticket_template.trim())
              ? ticket_template
              : defaultHtmlTemplate;

          const htmlContent = buildHtmlContent(ticketData, attachmentsHtml, effectiveTemplate);

          const subjectTemplate = ticket_subject || 'Обращение #{{ticketId}} - {{classification}}';
          const subject = applyTemplate(subjectTemplate, {
            ticketId: ticketData.id,
            classification: ticketData.classification,
          });

          await transporter.sendMail({
            from: user,
            to,
            subject,
            html: htmlContent,
            text:
`Пользователь: ${ticketData.user_email}
Организация: ${ticketData.organization}
Филиал: ${ticketData.branch}
Классификация: ${ticketData.classification}

${ticketData.message || ''}`,
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

// Периодически отправляем обращения из файловой системы
const startReportEmailSender = () => {
  const intervalMs = 60 * 1000; // 1 Минута
  sendReportsFromFolder().catch((err) =>
    logger.error(`Initial report send failed: ${err.message}`, { stack: err.stack })
  );
  return setInterval(() => {
    sendReportsFromFolder().catch((err) =>
      logger.error(`Scheduled report send failed: ${err.message}`, { stack: err.stack })
    );
  }, intervalMs);
};

export { sendCodeEmail, startReportEmailSender };
