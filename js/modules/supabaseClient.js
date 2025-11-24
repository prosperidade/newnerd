/*
 * SupabaseClient module (refatorado)
 *
 * Este módulo centraliza a inicialização de um cliente Supabase
 * reutilizável. Espera que o script CDN do supabase seja incluído
 * previamente no HTML e que o objeto `window.CONFIG.SUPABASE` tenha
 * propriedades `url` e `anonKey` definidas.
 */

const { createClient } = window.supabase;

class SupabaseClientWrapper {
  constructor(config) {
    if (!config || !config.url || !config.anonKey) {
      throw new Error('Configuração do Supabase ausente');
    }
    this.client = createClient(config.url, config.anonKey);
  }
  getSession() {
    return this.client.auth.getSession();
  }
  signInWithEmail({ email, password }) {
    return this.client.auth.signInWithPassword({ email, password });
  }
  signOut() {
    return this.client.auth.signOut();
  }
  from(table) {
    return this.client.from(table);
  }
  rpc(fnName, args) {
    return this.client.rpc(fnName, args);
  }
}

const supabase = new SupabaseClientWrapper(window.CONFIG?.SUPABASE ?? {});

export default supabase;