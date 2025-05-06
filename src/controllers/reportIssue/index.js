import { Scenes } from 'telegraf';
import logger from '../../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportIssue = new Scenes.BaseScene('reportIssue');

// Максимальное количество файлов
const MAX_FILES = 10;
// Максимальный размер файла (20 МБ в байтах)
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ

reportIssue.enter(async (ctx) => {
    try {
        await ctx.reply(
            'Пожалуйста, опишите вашу проблему. Вы также можете прикрепить файлы (изображения, видео, кружки, голосовые сообщения, PDF, документы). ' +
            `Максимум ${MAX_FILES} файлов, размер каждого файла не более 20 МБ.\n\nКогда закончите, отправьте сообщение с текстом "Готово" или нажмите на кнопку ниже.`,
            {
                reply_markup: {
                    keyboard: [['Готово'], ['Назад']],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }
        );
        ctx.session.issueData = {
            description: '',
            files: [] // Теперь будет массив объектов { name, buffer, caption }
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
                company: ctx.session.selectedOrganization,
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

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        const response = await fetch(fileLink);
        const buffer = Buffer.from(await response.arrayBuffer());

        // Сохраняем файл в сессии с описанием
        ctx.session.issueData.files.push({
            name: fileName,
            buffer: buffer,
            caption: caption
        });

        await ctx.reply(`Файл ${fileName} добавлен${caption ? ' с описанием: ' + caption : ''}. Осталось ${MAX_FILES - ctx.session.issueData.files.length} из ${MAX_FILES} файлов.`);
        logger.info(`User ${ctx.from.id} uploaded file ${fileName}${caption ? ' with caption: ' + caption : ''}`);
    } catch (error) {
        logger.error(`Error handling file upload: ${error.message}`);
        await ctx.reply('Извините, произошла ошибка при загрузке файла');
    }
});

export default reportIssue;