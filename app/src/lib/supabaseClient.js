import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não encontradas. Copie .env.example para .env e preencha com os dados do seu projeto Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Nunca guarda a sessão entre acessos — toda vez que a pessoa
    // abrir o sistema (aba nova, F5, ou depois de sair), precisa
    // digitar e-mail e senha de novo. Decisão de segurança.
    persistSession: false,
  },
});
