# Documentação do Sistema New Nerd

Este documento descreve a arquitetura, os fluxos e as dependências do projeto New Nerd, contemplando as interfaces web, funções Edge do Supabase e módulos de suporte.

## Visão geral
- **Objetivo**: permitir que professores gerem questões com IA, exportem materiais e mantenham um histórico, enquanto alunos respondem e enviam suas resoluções.
- **Stack**: front-end estático (HTML/CSS/JS), Supabase para autenticação/armazenamento/banco vetorial e Edge Functions em Deno para IA (OpenAI) e embeddings (Google).
- **Pastas-chave**: `newnerd-interface/` (professor), `aluno-interface/` (aluno), `supabase/functions/` (backend serverless) e `js/` (módulos reaproveitáveis).

## Interfaces Web
### Interface do professor (`newnerd-interface/`)
- **Página principal** (`index.html`): formulário para gerar questões individuais, filtros, histórico e cards de estatísticas. O resultado inclui botões de exportação (PDF, Word, JSON, CSV e ZIP) e cópia para área de transferência.
- **Geração de questões** (`js/generator.js`): envia uma requisição POST para a Edge Function `generate-question`, normaliza o retorno e renderiza cartões compatíveis com múltipla escolha, discursiva, verdadeiro/falso e associação. Também acopla botões de exportação em lote.
- **Configuração** (`js/config.js`): define URLs do Supabase, chaves públicas, modo de ambiente (dev/prod) e tenta carregar `config.local.js` em desenvolvimento para chaves sensíveis (OpenAI). Inicializa `window.supabaseClient` assim que a configuração fica pronta.
- **Outras páginas**: biblioteca do professor, painel e chat especializado para professores (`biblioteca-professor.html`, `painel-professor.html`, `chat-professor.html`), que reutilizam os módulos e o cliente Supabase configurados.

### Interface do aluno (`aluno-interface/`)
- **Painel de questões** (`js/questoes.js`): após obter a sessão do Supabase, lista as questões geradas (`questoes_geradas`), abre uma modal para responder e persiste as respostas em `respostas_alunos`. Usa o módulo `questionRenderer` para montar widgets por tipo.
- **Páginas de fluxo**: login, painel, biblioteca e contestação (`login.html`, `painel.html`, `biblioteca.html`, `contestacoes.html`), todas apoiadas no mesmo cliente Supabase e estilos compartilhados.

### Módulos utilitários (`js/modules/`)
- **`supabaseClient.js`**: encapsula a criação do cliente Supabase via CDN e expõe métodos `auth` e `rpc` reutilizáveis.
- **`questionRenderer.js`**: renderiza diferentes tipos de questão (múltipla, V/F e discursiva) em um contêiner e captura a resposta do usuário para callbacks personalizados.
- **`embeddingService.js`**: proxies para RPCs de geração e busca semântica (`gerar_embedding_seguro`, `match_embeddings`) no banco.

## Funções Edge (Supabase)
### `generate-question`
- **Propósito**: gerar uma ou mais questões didáticas com OpenAI, aceitar variações e gravar no banco quando há `professor_id`.
- **Fluxo**: validação de método/inputs → construção de prompt contextual (tipo, disciplina, série, dificuldade e regras de formato JSON) → chamada ao `/v1/chat/completions` (modelo configurável, padrão `gpt-4o-mini`) → parsing seguro do JSON → cálculo de tokens/custo → inserção opcional em `questoes_geradas` e `professor_embeddings` com metadados.
- **Entradas mínimas**: `tema` (mensagem), `tipo_questao` (multipla_escolha/discursiva/verdadeiro_falso), `disciplina`, `serie`, `dificuldade`, `quantidade` e `professor_id` opcional.

### `chat-ia`
- **Propósito**: responder mensagens de chat com contexto de professor ou tutor socrático para alunos.
- **Fluxo**: valida método, aceita `mensagens` e `contexto.papel`, aplica prompt de sistema diferenciado (tutor ou assistente pedagógico), chama OpenAI Chat Completions e retorna texto, tokens e custo estimado.

### `embed`
- **Propósito**: processar documentos armazenados, extrair texto e gerar embeddings via Google Gemini, atualizando tabelas do Supabase.
- **Fluxo**: recebe `document_id`, `table_name` e `bucket_name`; carrega metadados do documento, baixa o arquivo do storage, higieniza texto (até 8k chars), gera embedding com `text-embedding-004` e grava `embedding`, `texto_extraido` e status (`completed`/`ready`) no registro.
- **Comportamentos especiais**: se o texto for muito curto, marca o registro como `ignored/ready` sem embutir.

## Configuração e variáveis
### Front-end (professor)
- **Arquivo**: `newnerd-interface/js/config.js`.
- **Ambiente**: `ENV` = dev/prod (controla carregamento de `config.local.js`).
- **Supabase**: `SUPABASE_URL` e `SUPABASE_ANON_KEY` públicos; inicializa `window.supabaseClient` quando `configReady` é disparado.
- **Funções/IA**: `GENERATE_FUNCTION_URL`, `WEBHOOK_URL`, `EMBED_URL`, `OPENAI_API_KEY` (somente em dev via `config.local.js`).
- **Outros**: IDs de teste de professor, mensagens de UI e chaves de storage/histórico.

### Funções Edge (variáveis de ambiente)
- `OPENAI_API_KEY` (todos). `OPENAI_MODEL` opcional em `generate-question`.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`/`SERVICE_ROLE` para acesso administrativo.
- `GOOGLE_API_KEY` para `embed`.

## Operação e fluxos
1. **Geração de questões (professor)**: usuário preenche tema/tipo/disciplina → `generator.js` monta payload e chama `generate-question` → cartão renderizado com gabarito/justificativa → exportações disponíveis.
2. **Armazenamento e histórico**: quando `professor_id` é enviado, a função grava questões em `questoes_geradas` e cria entradas em `professor_embeddings` para futura busca semântica.
3. **Uso pelo aluno**: painel carrega as questões geradas, permite resposta via modal e grava em `respostas_alunos`; correção automática pode ser pluggada via webhook se desejado.
4. **Embeddings de materiais**: uploads do professor ou aluno disparam a função `embed`, que extrai texto e salva vetores para buscas contextuais (RPCs `gerar_embedding_seguro`/`match_embeddings`).

## Execução local
- Sirva o front-end com qualquer servidor estático (ex.: `npx http-server newnerd-interface -c-1`).
- Para depurar funções, use `supabase functions serve <nome>` dentro de `supabase/` com as variáveis carregadas.
- Para validar UI, execute `python verification/verify_rebrand.py`, que abre o `login.html` do aluno e captura `verification/aluno_login_rebrand.png`.
