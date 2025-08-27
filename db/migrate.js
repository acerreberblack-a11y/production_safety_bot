import db from './client.js';

db.migrate.latest()
    .then(() => {
        console.log('Миграции выполнены');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Ошибка:', err);
        process.exit(1);
    });