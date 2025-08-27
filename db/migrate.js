import db from './db.js';
import logger from '../src/utils/logger.js';

// Выполнение миграций и сидов базы данных
async function runMigrationsAndSeeds() {
  try {
    await db.migrate.latest();
    logger.info('Миграции выполнены');
    await db.seed.run();
    logger.info('Сиды выполнены');
    process.exit(0);
  } catch (err) {
    logger.error(`Ошибка выполнения миграций: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
}

runMigrationsAndSeeds();
