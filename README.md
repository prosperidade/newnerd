# New Nerd

Plataforma educacional focada em professores e alunos, combinando geração de questões por IA, armazenamento no Supabase e interfaces web estáticas para cada público. Este repositório reúne o front-end de professores, o front-end de alunos, funções Edge do Supabase e utilitários de verificação.

## Estrutura principal
- `newnerd-interface/`: interface do professor com geração de questões, exportação (PDF/Word/CSV/ZIP) e painel de histórico.
- `aluno-interface/`: interface do aluno para responder questões geradas e acompanhar painel.
- `supabase/functions/`: funções Edge (generate-question, chat-ia e embed) usadas pelo front-end.
- `js/`: módulos JavaScript reutilizáveis (cliente Supabase, renderização de questões e embeddings) para protótipos.
- `verification/`: script Playwright e captura de tela para verificar o rebranding do login do aluno.

## Pré-requisitos
- Node.js 18+ (para servir os arquivos estáticos e executar a verificação Playwright, se desejado).
- Supabase CLI (opcional) para rodar as funções Edge localmente.
- Chaves de API: OpenAI, Google Generative Language e Service Role do Supabase para as funções.

## Configuração rápida
1. **Front-end do professor/aluno**: sirva a pasta correspondente com um servidor estático. Exemplo:
   ```bash
   npx http-server newnerd-interface -c-1
   npx http-server aluno-interface -c-1
   ```
   Ajuste `CONFIG` e chaves locais em `newnerd-interface/js/config.local.js` (veja a Documentação).

2. **Funções Edge** (opcional): com Supabase CLI configurada, rode individualmente, por exemplo:
   ```bash
   cd supabase
   supabase functions serve generate-question
   supabase functions serve chat-ia
   supabase functions serve embed
   ```
   Garanta que as variáveis de ambiente estejam exportadas (OpenAI, Google, Service Role, SUPABASE_URL).

3. **Verificação de UI** (opcional): para validar o rebranding do login do aluno via Playwright:
   ```bash
   python verification/verify_rebrand.py
   ```

## Documentação
Consulte a [DOCUMENTACAO.md](DOCUMENTACAO.md) para detalhes de arquitetura, fluxos das interfaces e configuração das funções Edge.
