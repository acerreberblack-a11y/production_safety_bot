import knex from 'knex';
import config from './knexfile.js';

// Инициализация подключения к базе данных через Knex
const db = knex(config);

export default db;
