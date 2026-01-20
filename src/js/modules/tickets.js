import { db } from './supabase.js';
import { calculateDeadline } from './utils.js';

/**
 * Busca todos os tickets ordenados por criação (mais recentes primeiro)
 */
export async function getAllTickets() {
    const { data, error } = await db
        .from('atendimentos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Cria um novo ticket no banco
 * @param {FormData} formData - Dados do formulário HTML
 */
export async function createTicket(formData) {
    const days = parseInt(formData.get('deadlineDays'));
    const now = new Date();
    
    // Gera protocolo único: SGC + Data + Random
    const datePart = now.toISOString().slice(0,10).replace(/-/g,'');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const protocol = `SGC-${datePart}-${randomPart}`;

    const newTicket = {
        protocol: protocol,
        attendant: formData.get('attendant'),
        channel: formData.get('channel'),
        requester: formData.get('requester'),
        cpf: formData.get('cpf'),
        phone: formData.get('phone'),
        description: formData.get('description'),
        deadline_days: days,
        deadline_date: calculateDeadline(days).toISOString(),
        status: 'pendente',
        created_at: now.toISOString()
    };

    return await db.from('atendimentos').insert([newTicket]);
}
            