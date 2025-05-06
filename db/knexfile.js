const config = {
  client: 'pg',
  connection: {
    host: '192.168.126.132',
    port: 5432,
    user: 'testuser',
    password: '123',
    database: 'testdb'
  },
  pool: {
    min: 2,
    max: 10,
    afterCreate: (conn, done) => {
      conn.query('SELECT 1;', (err) => {
        done(err, conn);
      });
    }
  },
  migrations: {
    directory: './database/migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './database/seeds'
  },
  useNullAsDefault: true,
  searchPath: ['bot_schema', 'public']
};

export default config;