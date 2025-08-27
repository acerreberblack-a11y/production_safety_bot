import db from './db.js';
import logger from '../src/utils/logger.js';

// Создание записи пользователя
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
        logger.error(`Error creating user: ${error.message}`, { stack: error.stack });
        throw error;
    }
}

async function findUserByTelegramId(telegramId) {
    try {
        return await db('users')
            .leftJoin('tickets', 'users.id', 'tickets.user_id')
            .select('users.*', 'tickets.organization as organization', 'tickets.branch as branch')
            .where('users.id_telegram', telegramId)
            .orderBy('tickets.created_at', 'desc')
            .first(); // Возвращает пользователя с последними организацией и филиалом
    } catch (error) {
        logger.error(`Error finding user by Telegram ID: ${error.message}`, { stack: error.stack });
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
        logger.error(`Error updating user: ${error.message}`, { stack: error.stack });
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
        logger.error(`Error searching users: ${error.message}`, { stack: error.stack });
        throw error;
    }
}

async function getUserDetails(userId) {
    try {
        return await db('users')
            .where({ id: userId })
            .first();
    } catch (error) {
        logger.error(`Error getting user details: ${error.message}`, { stack: error.stack });
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
        logger.error(`Error updating user role: ${error.message}`, { stack: error.stack });
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
        logger.error(`Error blocking user: ${error.message}`, { stack: error.stack });
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
        logger.error(`Error deleting user: ${error.message}`, { stack: error.stack });
        throw error;
    }
}

async function getTicketsByUserId(userId) {
    try {
        return await db('tickets')
            .where({ user_id: userId })
            .orderBy('created_at', 'desc')
            .limit(10);
    } catch (error) {
        logger.error(`Error fetching tickets for user ${userId}: ${error.message}`, { stack: error.stack });
        throw error;
    }
}

async function getTicketDetails(ticketId) {
    try {
        const ticket = await db('tickets').where({ id: ticketId }).first();
        if (!ticket) return null;
        const files = await db('files').where({ ticket_id: ticketId });
        return { ticket, files };
    } catch (error) {
        logger.error(`Error getting ticket details: ${error.message}`, { stack: error.stack });
        throw error;
    }
}

async function getStatistics() {
    try {
        const [users] = await db('users').count('id as count');
        const [tickets] = await db('tickets').count('id as count');
        const [files] = await db('files').count('id as count');

        return {
            userCount: Number(users.count),
            ticketCount: Number(tickets.count),
            fileCount: Number(files.count)
        };
    } catch (error) {
        logger.error(`Error getting statistics: ${error.message}`, { stack: error.stack });
        throw error;
    }
}

export {
    createUser,
    findUserByTelegramId,
    updateUser,
    searchUsers,
    getUserDetails,
    updateUserRole,
    blockUser,
    deleteUser,
    getTicketsByUserId,
    getTicketDetails,
    getStatistics
};
