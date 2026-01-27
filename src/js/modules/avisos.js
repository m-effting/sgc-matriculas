import { db } from './supabase.js';

/**
 * Retorna todos os avisos, ordenando por pinned e data de criação
 */
export async function getAllAvisos() {
    const { data, error } = await db
        .from('avisos')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao buscar avisos:', error);
        throw error;
    }
    return data;
}

/**
 * Cria um novo aviso
 * Aceita um objeto com title, content, e pinned
 */
export async function createAviso(avisoData) {
    const { title, content, pinned } = avisoData;

    // Pega usuário logado
    const { data: userData } = await db.auth.getUser();
    const user = userData?.user || null;

    const newAviso = {
        title,
        content,
        pinned: !!pinned,
        created_by: user?.id || null,
        created_by_email: user?.email || null
    };

    const { data, error } = await db.from('avisos').insert([newAviso]).select().single();
    if (error) {
        console.error('Erro ao criar aviso:', error);
        throw error;
    }
    return data;
}

/**
 * Atualiza um aviso existente
 * @param {string} id - ID do aviso
 * @param {Object} updates - campos a atualizar
 */
export async function updateAviso(id, updates) {
    const { data, error } = await db
        .from('avisos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Erro ao atualizar aviso:', error);
        throw error;
    }
    return data;
}

/**
 * Exclui um aviso
 * @param {string} id - ID do aviso
 */
export async function deleteAviso(id) {
    const { error } = await db.from('avisos').delete().eq('id', id);
    if (error) {
        console.error('Erro ao excluir aviso:', error);
        throw error;
    }
    return true;
}
