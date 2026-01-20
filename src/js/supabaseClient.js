const SUPABASE_URL = 'https://atdgxqipsfflemfdkydr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fa2wQrQs8SSznK1e_eGi1g_5JSWkzJ_';

// Inicializa o cliente Supabase globalmente
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Exporta para uso em outros arquivos 
window.db = supabase;

console.log("Supabase conectado!");
