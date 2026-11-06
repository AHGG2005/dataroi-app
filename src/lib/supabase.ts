import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Exportamos un cliente único para usarlo en toda la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey);