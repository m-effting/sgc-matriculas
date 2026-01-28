import { db } from './supabase.js';

/**
 * Retorna todos os avisos, ordenando por pinned e data de criação
 * Agora busca também o username na tabela profiles
 */
export async function getAllAvisos() {
    // 1. Busca os avisos
    const { data: avisos, error } = await db
        .from('avisos')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao buscar avisos:', error);
        throw error;
    }

    if (!avisos || avisos.length === 0) return [];

    // 2. Coleta os IDs únicos dos criadores dos avisos
    const userIds = [...new Set(avisos.map(a => a.created_by).filter(Boolean))];

    // 3. Busca os profiles correspondentes para pegar o username
    let profileMap = {};
    if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await db
            .from('profiles')
            .select('id, username')
            .in('id', userIds);
        
        if (!profileError && profiles) {
            // Cria um mapa: { 'uuid': 'username' }
            profiles.forEach(p => {
                profileMap[p.id] = p.username;
            });
        }
    }

    // 4. Retorna os avisos com o campo username acoplado
    return avisos.map(a => ({
        ...a,
        username: profileMap[a.created_by] || 'Usuário Desconhecido' // Fallback caso não ache profile
    }));
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
    // Adiciona timestamp de atualização
    const dataToUpdate = {
        ...updates,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await db
        .from('avisos')
        .update(dataToUpdate)
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