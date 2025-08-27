import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../../db/db.js';
import ConfigLoader from '../../utils/configLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportIssue = new Scenes.BaseScene('reportIssue');

// Максимальное количество файлов
const MAX_FILES = 10;
// Максимальный размер файла (20 МБ в байтах)
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ
// Максимальный общий объем файлов (24 МБ в байтах)
const MAX_TOTAL_SIZE = 24 * 1024 * 1024; // 24 МБ

const MAX_FILE_SIZE_MB = MAX_FILE_SIZE / (1024 * 1024);
const MAX_TOTAL_SIZE_MB = MAX_TOTAL_SIZE / (1024 * 1024);

reportIssue.enter(async (ctx) => {
    try {
        const config = await ConfigLoader.loadConfig();
        const reportConfig = config.controllers?.reportIssue;
        const textTemplate = reportConfig?.text || 'Пожалуйста, опишите вашу проблему. Вы также можете прикрепить файлы (изображения, видео, кружки, голосовые сообщения, PDF, документы). Максимум {MAX_FILES} файлов, размер каждого файла не более {MAX_FILE_SIZE} МБ, общий объем не более {MAX_TOTAL_SIZE} МБ.\n\nКогда закончите, отправьте сообщение с текстом "Готово" или нажмите на кнопку ниже.';
        const messageText = textTemplate
            .replace('{MAX_FILES}', MAX_FILES)
            .replace('{MAX_FILE_SIZE}', MAX_FILE_SIZE_MB)
            .replace('{MAX_TOTAL_SIZE}', MAX_TOTAL_SIZE_MB);
        await ctx.reply(
            messageText,
            {
                reply_markup: {
                    keyboard: [['Готово'], ['Назад'], ['Отменить заполнение']],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
        ctx.session.issueData = {
            description: '',
            files: [], // Теперь будет массив объектов { name, buffer, caption }
            totalSize: 0
        };
        logger.info(`User ${ctx.from.id} entered reportIssue scene`);
    } catch (error) {
        logger.error(`Error in reportIssue scene enter: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка', {
            reply_markup: { remove_keyboard: true }
        });
    }
});

// Обработка текстового ввода
reportIssue.on('text', async (ctx) => {
    const text = ctx.message.text;

    if (text === 'Отменить заполнение') {
        try {
            delete ctx.session.issueData;
            delete ctx.session.selectedOrg;
            delete ctx.session.selectedBranch;
            delete ctx.session.selectedClassification;
            delete ctx.session.ticketType;
            delete ctx.session.classifications;
            delete ctx.session.waitingForClassification;
            delete ctx.session.waitingForBranch;
            delete ctx.session.waitingForOrg;
            await ctx.reply('Заполнение обращения было отменено.', {
                reply_markup: { remove_keyboard: true }
            });
            await ctx.scene.enter('welcome');
        } catch (error) {
            logger.error(`Error in cancel action: ${error.message}`);
            await ctx.reply('Извините, произошла ошибка', {
                reply_markup: { remove_keyboard: true }
            });
        }
        return;
    }

    if (text === 'Назад') {
        try {
            await ctx.reply('Вы вернулись к выбору классификации.', {
                reply_markup: { remove_keyboard: true }
            });
            await ctx.scene.enter('classification');
            delete ctx.session.issueData;
            logger.info(`User ${ctx.from.id} returned to classification scene`);
        } catch (error) {
            logger.error(`Error in back action: ${error.message}`);
            await ctx.reply('Извините, произошла ошибка', {
                reply_markup: { remove_keyboard: true }
            });
        }
        return;
    }

    if (text === 'Готово') {
        try {
            if (!ctx.session.issueData.description) {
                await ctx.reply('Пожалуйста, опишите проблему перед завершением.');
                return;
            }

            // Определяем путь к папке пользователя
            const userFolder = path.join(__dirname, '../../reports', ctx.from.id.toString());

            // Создаем папку пользователя, если её нет
            await fs.mkdir(userFolder, { recursive: true });

            // Получаем список существующих папок
            const folders = (await fs.readdir(userFolder, { withFileTypes: true }))
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            // Определяем максимальный номер
            let maxNumber = -1;
            folders.forEach(folder => {
                const match = folder.match(/^(\d+)_/);
                if (match) {
                    const number = parseInt(match[1], 10);
                    maxNumber = Math.max(maxNumber, number);
                }
            });
            const nextNumber = maxNumber + 1;

            // Форматируем дату и время
            const now = new Date();
            const formattedDate = `${(now.getDate()).toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
            const formattedTime = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
            const issueFolderName = `${nextNumber}_${formattedDate}_${formattedTime}`;
            const issueFolder = path.join(userFolder, issueFolderName);

            await fs.mkdir(issueFolder);

            // Формируем JSON объект
            const issueData = {
                user: ctx.from.id.toString(),
                type: ctx.session.ticketType,
                company: ctx.session.selectedOrganization || 'Не указано',
                filial: ctx.session.selectedBranch,
                classification: ctx.session.selectedClassification,
                text: ctx.session.issueData.description,
                files: ctx.session.issueData.files.map((file, index) => {
                    const fileNumber = index + 1;
                    const newFileName = `${fileNumber}_${file.name}`;
                    file.newName = newFileName; // Сохраняем новое имя для записи на диск
                    return {
                        name: newFileName,
                        description: file.caption || ''
                    };
                })
            };

            // Сохраняем JSON файл
            await fs.writeFile(path.join(issueFolder, 'issue.json'), JSON.stringify(issueData, null, 2), 'utf-8');

            // Сохраняем файлы с новым именем
            for (let i = 0; i < ctx.session.issueData.files.length; i++) {
                const file = ctx.session.issueData.files[i];
                const filePath = path.join(issueFolder, file.newName);
                await fs.writeFile(filePath, file.buffer);
            }

            // Сохранение в базу данных
            await saveTicketFromFolder(ctx.from.id.toString(), issueFolderName);

            await ctx.reply(`Ваше обращение успешно создано в папке ${issueFolderName}! Вы вернетесь в главное меню.`, {
                reply_markup: { remove_keyboard: true }
            });

            logger.info(`User ${ctx.from.id} created an issue in folder ${issueFolder}`);
            // Полная очистка сессии
            ctx.session = {
                __scenes: ctx.session.__scenes || { current: 'welcome', state: {} }
            };
            await ctx.scene.enter('welcome'); // Переход в сцену welcome
        } catch (error) {
            logger.error(`Error saving issue: ${error.message}`);
            await ctx.reply('Извините, произошла ошибка при сохранении обращения', {
                reply_markup: { remove_keyboard: true }
            });
        }
        return;
    }

    // Сохраняем описание проблемы
    ctx.session.issueData.description += (ctx.session.issueData.description ? '\n' : '') + text;
    await ctx.reply('Описание добавлено. Если хотите прикрепить файлы или завершить, используйте кнопки.');
});

// Обработка файлов
reportIssue.on(['photo', 'video', 'video_note', 'voice', 'document'], async (ctx) => {
    try {
        if (!ctx.session.issueData) {
            await ctx.reply('Пожалуйста, начните процесс заново.');
            return;
        }

        // Проверяем количество файлов
        if (ctx.session.issueData.files.length >= MAX_FILES) {
            await ctx.reply(`Вы уже загрузили максимальное количество файлов (${MAX_FILES}). Отправьте "Готово" для завершения.`);
            return;
        }

        let file, fileSize, fileName, caption;

        if (ctx.message.photo) {
            file = ctx.message.photo[ctx.message.photo.length - 1];
            fileSize = file.file_size;
            fileName = `${file.file_id}.jpg`;
            caption = ctx.message.caption || '';
        } else if (ctx.message.video) {
            file = ctx.message.video;
            fileSize = file.file_size;
            fileName = `${file.file_id}.${file.mime_type.split('/')[1]}`;
            caption = ctx.message.caption || '';
        } else if (ctx.message.video_note) {
            file = ctx.message.video_note;
            fileSize = file.file_size;
            fileName = `${file.file_id}.mp4`;
            caption = ''; // Кружки не поддерживают подписи
        } else if (ctx.message.voice) {
            file = ctx.message.voice;
            fileSize = file.file_size;
            fileName = `${file.file_id}.ogg`;
            caption = ''; // Голосовые сообщения не поддерживают подписи
        } else if (ctx.message.document) {
            file = ctx.message.document;
            fileSize = file.file_size;
            fileName = file.file_name;
            caption = ctx.message.caption || '';

            const allowedMimeTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            if (!allowedMimeTypes.includes(file.mime_type)) {
                await ctx.reply('Этот тип файла не поддерживается. Разрешены только PDF и документы Word.');
                return;
            }
        }

        if (fileSize > MAX_FILE_SIZE) {
            await ctx.reply('Файл слишком большой. Максимальный размер файла — 20 МБ.');
            return;
        }

        const remainingTotal = MAX_TOTAL_SIZE - ctx.session.issueData.totalSize;
        if (fileSize > remainingTotal) {
            await ctx.reply(`Нельзя загрузить файл, превышен общий лимит 24 МБ. Осталось ${(remainingTotal / (1024 * 1024)).toFixed(2)} МБ.`);
            return;
        }

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        const response = await fetch(fileLink);
        const buffer = Buffer.from(await response.arrayBuffer());

        // Сохраняем файл в сессии с описанием
        ctx.session.issueData.files.push({
            name: fileName,
            buffer: buffer,
            caption: caption
        });
        ctx.session.issueData.totalSize += fileSize;

        const freeSpace = MAX_TOTAL_SIZE - ctx.session.issueData.totalSize;
        await ctx.reply(`Файл ${fileName} добавлен${caption ? ' с описанием: ' + caption : ''}. Осталось ${MAX_FILES - ctx.session.issueData.files.length} из ${MAX_FILES} файлов. Свободно ${(freeSpace / (1024 * 1024)).toFixed(2)} МБ из 24 МБ.`);
        logger.info(`User ${ctx.from.id} uploaded file ${fileName}${caption ? ' with caption: ' + caption : ''}`);
    } catch (error) {
        logger.error(`Error handling file upload: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка при загрузке файла');
    }
});

// Функция сохранения в базу данных
async function saveTicketFromFolder(telegramId, ticketFolder) {
  try {
    const issuePath = path.join('reports', telegramId, ticketFolder, 'issue.json');
    const issueData = JSON.parse(await fs.readFile(issuePath, 'utf-8'));

    // Find or create user
    let user = await db('users').where({ id_telegram: telegramId }).first();
    if (!user) {
      user = await db('users')
        .insert({
          id_telegram: telegramId,
          email: issueData.type,
          created_at: db.fn.now(),
        })
        .returning('*')
        .then(rows => rows[0]);
    }

    // Create ticket
    const [ticket] = await db('tickets')
      .insert({
        user_id: user.id,
        message: issueData.text,
        organization: issueData.company || 'Не указано',
        branch: issueData.filial,
        classification: issueData.classification,
        created_at: db.fn.now(),
      })
      .returning('*');

    // Save files with binary data
    for (const file of issueData.files) {
      const filePath = path.join('reports', telegramId, ticketFolder, file.name);
      const fileStats = await fs.stat(filePath);
      const fileData = await fs.readFile(filePath); // Читаем бинарные данные
      await db('files').insert({
        ticket_id: ticket.id,
        title: file.description,
        expansion: path.extname(file.name).slice(1),
        size: fileStats.size,
        path: filePath,
        data: fileData, // Сохраняем бинарные данные
        created_at: db.fn.now(),
      });
    }

    return { ticket, user };
  } catch (error) {
    logger.error(`Error saving ticket: ${error.message}`, { stack: error.stack });
    throw error;
  }
}

export default reportIssue;
