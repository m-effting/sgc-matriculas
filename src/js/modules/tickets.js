import { db } from './supabase.js';
import { calculateDeadline } from './utils.js';

export async function getAllTickets() {
    const { data, error } = await db
        .from('atendimentos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function createTicket(formData) {
    const days = parseInt(formData.get('deadlineDays'));
    const now = new Date();
    
    // Tenta pegar o usuário logado
    const { data: { user } } = await db.auth.getUser();
    
    // Se não tiver usuário (caso tenha pulado o login), usa 'Anonimo' ou similar
    const userEmail = user ? user.email : 'Sistema Local';
    const userId = user ? user.id : null; 

    // Gera protocolo
    const datePart = now.toISOString().slice(0,10).replace(/-/g,'');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const protocol = `SGC-${datePart}-${randomPart}`;

    const newTicket = {
        protocol: protocol,
        attendant: formData.get('attendant'),
        created_by_email: userEmail,
        // created_by: userId, // Descomentar para linkar com a FK de profiles (se o usuário existir lá)
        channel: formData.get('channel'),
        requester: formData.get('requester'),
        cpf: formData.get('cpf'),
        phone: formData.get('phone'),
        description: formData.get('description'),
        deadline_days: days,
        deadline_date: calculateDeadline(days).toISOString(),
        
        // IMPORTANTE: O SQL exige que o status seja um destes: 'pendente', 'em_andamento', 'resolvido', 'cancelado'
        status: 'pendente', 
        
        created_at: now.toISOString()
    };

    return await db.from('atendimentos').insert([newTicket]);
}
