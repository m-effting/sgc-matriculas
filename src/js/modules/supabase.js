import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
   
const SUPABASE_URL = 'https://atdgxqipsfflemfdkydr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fa2wQrQs8SSznK1e_eGi1g_5JSWkzJ_';
   
   export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

