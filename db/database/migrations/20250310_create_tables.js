export async function up(knex) {
    return knex.schema
        .createTable('roles', function (table) {
            table.increments('id').primary();
            table.string('title', 50).notNullable().unique(); // Ограничение длины
        })
        .createTable('users', function (table) {
            table.increments('id').primary();
            table.bigInteger('id_telegram').unsigned().notNullable().unique().index();
            table.string('username', 50).nullable();
            table.string('firstName', 50).nullable(); // Изменено с first_name на firstName
            table.string('lastName', 50).nullable(); // Изменено с last_name на lastName
            table.string('email', 100).nullable();
            table.string('linkChat').nullable(); // Изменено с link_chat на linkChat
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()); // Используем timestamp вместо dateTime
            table.timestamp('dataLastActivity').nullable().defaultTo(knex.fn.now()); // Изменено с activity_at на dataLastActivity
            table.boolean('is_blocked').notNullable().defaultTo(false); // Изменено с is_banned на is_blocked
            table.integer('role_id').unsigned().notNullable()
                .references('id').inTable('roles')
                .onDelete('RESTRICT')
                .onUpdate('CASCADE')
                .defaultTo(1);
        })
        .createTable('tickets', function (table) {
            table.increments('id').primary();
            table.integer('user_id').unsigned().notNullable()
                .references('id').inTable('users')
                .onDelete('CASCADE')
                .onUpdate('CASCADE');
            table.text('message').notNullable();
            table.string('organization').nullable();
            table.string('branch').nullable();
            table.string('classification').notNullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()); // Изменено с date_created на created_at
            table.boolean('sent_email').notNullable().defaultTo(false);
        })
        .createTable('files', function (table) {
            table.increments('id').primary();
            table.integer('ticket_id').unsigned().notNullable()
                .references('id').inTable('tickets')
                .onDelete('CASCADE')
                .onUpdate('CASCADE');
            table.string('title').notNullable();
            table.string('expansion').notNullable();
            table.integer('size').unsigned().notNullable();
            table.string('path').notNullable();
            table.binary('data').notNullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()); // Добавлено поле created_at для согласованности с кодом
        });
}

export async function down(knex) {
    return knex.schema
        .dropTable('files')
        .dropTable('tickets')
        .dropTable('users')
        .dropTable('roles');
}