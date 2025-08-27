import db from './client.js';
async function runMigrationsAndSeeds() {
  try {
    await db.migrate.latest();
    console.log('Миграции выполнены');
    await db.seed.run();
    console.log('Сиды выполнены');
    process.exit(0);
  } catch (err) {
    console.error('Ошибка:', err);
    process.exit(1);
  }
}

runMigrationsAndSeeds();