import '../env.js';

const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  pool: {
    min: 2,
    max: 10,
    afterCreate: (conn, done) => {
      conn.query('SELECT 1;', (err) => {
        done(err, conn);
      });
    },
  },
  migrations: {
    directory: './database/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './database/seeds',
  },
  useNullAsDefault: true,
  searchPath: ['bot_schema', 'public'],
};

export default config;

// npx knex migrate:latest
// npx knex seed:make initial_data
// npx knex seed:run
