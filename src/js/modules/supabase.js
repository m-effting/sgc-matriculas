   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

   const SUPABASE_URL = 'https://atdgxqipsfflemfdkydr.supabase.co';
   const SUPABASE_KEY = 'sb_publishable_fa2wQrQs8SSznK1e_eGi1g_5JSWkzJ_';

   /**
    * Instância global do cliente Supabase para comunicação com o banco de dados.
    */
   export const db = createClient(SUPABASE_URL, SUPABASE_KEY);