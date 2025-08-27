import db from './db.js';
async function createUser(telegramId, username = null, firstName = null, lastName = null, linkChat = null, email = null) {
    try {
        const [user] = await db('users')
            .insert({
                id_telegram: telegramId,
                username,
                firstName,
                lastName,
                linkChat,
                email,
                created_at: db.fn.now()
            })
            .returning('*');
        return user;
    } catch (error) {
        console.error(`Error creating user: ${error.message}`);
        throw error;
    }
}

async function findUserByTelegramId(telegramId) {
    try {
        return await db('users')
            .where({ id_telegram: telegramId })
            .first(); // Работает одинаково в обоих диалектах
    } catch (error) {
        console.error(`Error finding user by Telegram ID: ${error.message}`);
        throw error;
    }
}

async function updateUser(telegramId, updates) {
    try {
        const [user] = await db('users')
            .where({ id_telegram: telegramId })
            .update({
                ...updates,
                dataLastActivity: db.fn.now() // NOW() для PostgreSQL
            })
            .returning('*'); // Работает в PostgreSQL, в SQLite возвращался бы только счетчик
        return user;
    } catch (error) {
        console.error(`Error updating user: ${error.message}`);
        throw error;
    }
}

async function changeRole(telegramId, roleId) {
    try {
        const [user] = await db('users')
            .where({ id_telegram: telegramId })
            .update({
                role_id: roleId,
                dataLastActivity: db.fn.now()
            })
            .returning('*');
        return user;
    } catch (error) {
        console.error(`Error changing role: ${error.message}`);
        throw error;
    }
}

async function searchUsers(query) {
    try {
        return await db('users')
            .where(builder => {
                builder
                    .whereILike('username', `%${query}%`)
                    .orWhereILike('firstName', `%${query}%`)
                    .orWhereILike('lastName', `%${query}%`)
                    .orWhere(db.raw('id_telegram::text LIKE ?', [`%${query}%`])); // Cast bigint to text
            });
    } catch (error) {
        console.error(`Error searching users: ${error.message}`);
        throw error;
    }
}

async function getUserDetails(userId) {
    try {
        return await db('users')
            .where({ id: userId })
            .first();
    } catch (error) {
        console.error(`Error getting user details: ${error.message}`);
        throw error;
    }
}

async function selectAllRoleUsers() {
    try {
        return await db('roles').select('*');
    } catch (error) {
        console.error(`Error selecting roles: ${error.message}`);
        throw error;
    }
}

async function updateUserRole(userId, roleId) {
    try {
        const [user] = await db('users')
            .where({ id: userId })
            .update({
                role_id: roleId,
                dataLastActivity: db.fn.now()
            })
            .returning('*');
        return user;
    } catch (error) {
        console.error(`Error updating user role: ${error.message}`);
        throw error;
    }
}

async function blockUser(userId) {
    try {
        const [user] = await db('users')
            .where({ id: userId })
            .update({
                is_blocked: db.raw('NOT is_blocked'), // Работает в PostgreSQL, в SQLite тоже бы сработало
                dataLastActivity: db.fn.now()
            })
            .returning('*');
        return user;
    } catch (error) {
        console.error(`Error blocking user: ${error.message}`);
        throw error;
    }
}

async function deleteUser(userId) {
    try {
        const count = await db('users')
            .where({ id: userId })
            .del(); // В SQLite нет RETURNING для DELETE, но в PostgreSQL можно добавить .returning('*')
        return { success: count > 0 };
    } catch (error) {
        console.error(`Error deleting user: ${error.message}`);
        throw error;
    }
}

async function createTicket(userId, message, organization, branch = null, classification) {
    try {
        const [ticket] = await db('tickets')
            .insert({
                user_id: userId,
                message,
                organization,
                branch,
                classification,
                created_at: db.fn.now()
            })
            .returning('*');
        return ticket;
    } catch (error) {
        console.error(`Error creating ticket: ${error.message}`);
        throw error;
    }
}

async function createFile(ticketId, title, expansion, size, path) {
    try {
        const [file] = await db('files') // Было 'tickets', должно быть 'files'
        .insert({
            ticket_id: ticketId,
            title,
            expansion,
            size,
            path,
            created_at: db.fn.now()
        })
        .returning('*');
        return file;
    } catch (error) {
        console.error(`Error creating file: ${error.message}`);
        throw error;
    }
}

async function getTicketsByUserId(userId) {
    try {
        return await db('tickets')
            .where({ user_id: userId })
            .orderBy('created_at', 'desc');
    } catch (error) {
        console.error(`Error fetching tickets for user ${userId}: ${error.message}`);
        throw error;
    }
}

export {
    createUser,
    findUserByTelegramId,
    updateUser,
    changeRole,
    searchUsers,
    getUserDetails,
    selectAllRoleUsers,
    updateUserRole,
    blockUser,
    deleteUser,
    createTicket,
    createFile,
    getTicketsByUserId
};