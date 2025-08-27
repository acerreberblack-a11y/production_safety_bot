/*
import db from '../db/knexfile.js';

async function getAllTickets() {
  try {
    const tickets = await db.queryBuilder()
      .select('*')
      .from('tickets'); // Specify table explicitly
    return tickets;
  } catch (error) {
    console.error(`Error querying tickets: ${error.message}`);
    throw error;
  }
}

async function getTicketsWithDetails() {
  try {
    const tickets = await db.queryBuilder()
      .select(
        't.*',
        'u.email',
        'f.title as file_title',
        'f.expansion',
        'r.title as role_title'
      )
      .from('tickets as t')
      .join('users as u', 't.user_id', 'u.id')
      .leftJoin('files as f', 'f.ticket_id', 't.id')
      .leftJoin('roles as r', 'u.role_id', 'r.id');
    return tickets;
  } catch (error) {
    console.error(`Error querying tickets: ${error.message}`);
    throw error;
  }
}

export default { getAllTickets, getTicketsWithDetails };*/
