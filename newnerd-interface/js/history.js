// js/history.js - CORRIGIDO

async function loadHistoryFromSupabase() {
  console.log("📚 Carregando histórico...");

  // Verificação de Segurança
  if (!globalThis.supabaseClient) {
    console.error("SupabaseClient não encontrado. Verifique config.js.");
    return;
  }

  try {
    // CORREÇÃO AQUI: Usa globalThis.supabaseClient em vez de supabase solto
    const {
      data: { user },
      error: authError,
    } = await globalThis.supabaseClient.auth.getUser();

    if (authError || !user) {
      console.warn("Usuário não logado, histórico não será carregado.");
      return;
    }

    const { data, error } = await globalThis.supabaseClient
      .from("questoes_geradas")
      .select("*")
      .eq("professor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Atualiza a UI se tiver elementos de histórico (não quebra se não tiver)
    const historyList = document.getElementById("history-list");
    if (historyList && data) {
      // Lógica de renderizar histórico simples
      // (Pode adicionar sua lógica de renderização aqui se tiver)
      console.log(`Histórico carregado: ${data.length} itens.`);
    }
  } catch (e) {
    console.error("Erro histórico:", e);
  }
}

// Inicia apenas quando a config estiver pronta
document.addEventListener("configReady", loadHistoryFromSupabase);
// Fallback caso o evento já tenha passado
if (globalThis.supabaseClient) loadHistoryFromSupabase();
