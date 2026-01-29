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
    
    // Gera protocolo
    const datePart = now.toISOString().slice(0,10).replace(/-/g,'');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const protocol = `SGC-${datePart}-${randomPart}`;

    // --- Lógica para processar Alunos ---
    // O FormData retorna arrays quando há múltiplos inputs com o mesmo nome 
    
    const studentNames = formData.getAll('student_name[]');
    const studentGrades = formData.getAll('student_grade[]');
    const studentZones = formData.getAll('student_zone[]');

    const students = studentNames.map((name, index) => {
        // Só adiciona se tiver nome preenchido
        if (!name.trim()) return null;
        return {
            name: name,
            grade: studentGrades[index] || '',
            zone: studentZones[index] || ''
        };
    }).filter(s => s !== null);

    const newTicket = {
        protocol: protocol,
        attendant: formData.get('attendant'),
        created_by_email: userEmail,
        created_by: user?.id || null, 
        channel: formData.get('channel'),
        requester: formData.get('requester'),
        cpf: formData.get('cpf'),
        phone: formData.get('phone'),
        description: formData.get('description'),
        deadline_days: days,
        deadline_date: calculateDeadline(days).toISOString(),
        
        students: students,

        status: 'pendente',
        created_at: now.toISOString()
    };

    return await db.from('atendimentos').insert([newTicket]);
}

/**
 * Atualiza um atendimento existente.
 * Se deadline_days for alterado, recalcula a data de entrega.
 */
export async function updateTicket(id, updates) {
    // Se houve alteração no prazo em dias, recalcular a data limite
    if (updates.deadline_days) {
        updates.deadline_date = calculateDeadline(parseInt(updates.deadline_days)).toISOString();
    }

    const { data, error } = await db
        .from('atendimentos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Erro ao atualizar ticket:', error);
        throw error;
    }
    return data;
}