export async function seed(knex) {
    // Удаляем все данные перед заполнением
    return knex('roles').del()
        .then(() => {
            return knex('roles').insert([
                { id: 1, title: 'user' },
                { id: 2, title: 'manager' },
                { id: 3, title: 'admin' }
            ]);
        });
}