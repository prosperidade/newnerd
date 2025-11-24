/*
 * Configuração do ambiente para o projeto refatorado.
 *
 * Defina as variáveis SUPABASE_URL e SUPABASE_ANON_KEY na
 * inicialização do aplicativo (por exemplo, injetando-as através de
 * uma tag script antes da importação deste arquivo). O objeto
 * `window.CONFIG` pode ser estendido conforme necessário com outras
 * configurações como nomes de buckets e IDs de usuário.
 */

window.CONFIG = window.CONFIG || {};
window.CONFIG.SUPABASE = window.CONFIG.SUPABASE || {
  url: '',
  anonKey: '',
};