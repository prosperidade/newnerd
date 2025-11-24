/*
 * questoes.js
 *
 * Script principal para o painel de questões do aluno. Carrega as
 * questões do banco, exibe cards e permite que o aluno responda
 * diretamente no painel. Após o envio, a resposta é gravada em
 * `respostas_alunos` e uma mensagem é exibida. Caso deseje obter
 * correção automática, integre com um webhook de IA e atualize o
 * registro no banco.
 */

import supabase from './modules/supabaseClient.js';
import { render as renderQuestion } from './modules/questionRenderer.js';

const container = document.getElementById('question-list');

async function init() {
  try {
    const { data: { session } } = await supabase.getSession();
    if (!session) {
      container.innerHTML = '<div class="alert alert-warning">Você precisa estar logado para ver as questões.</div>';
      return;
    }
    await carregarQuestoes(session.user.id);
  } catch (err) {
    console.error('Erro ao inicializar painel', err);
    container.innerHTML = `<div class="alert alert-danger">Erro ao carregar questões: ${err.message}</div>`;
  }
}

async function carregarQuestoes(alunoId) {
  const { data: questoes, error } = await supabase
    .from('questoes_geradas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  container.innerHTML = '';
  questoes.forEach((q) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="card-body">
      <h5 class="card-title">${q.disciplina} – ${q.tipo}</h5>
      <p class="card-text">${q.enunciado.substring(0, 80)}...</p>
      <button class="btn btn-primary">Responder</button>
    </div>`;
    const btn = card.querySelector('button');
    btn.addEventListener('click', () => abrirQuestao(q));
    container.appendChild(card);
  });
}

function abrirQuestao(questao) {
  // cria modal simples
  const modal = document.createElement('div');
  modal.className = 'modal d-block';
  modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modal.innerHTML = `<div class="modal-dialog"><div class="modal-content"><div class="modal-header">
    <h5 class="modal-title">Responder questão</h5>
    <button type="button" class="btn-close"></button>
  </div><div class="modal-body"></div><div class="modal-footer"></div></div></div>`;
  const closeBtn = modal.querySelector('.btn-close');
  closeBtn.addEventListener('click', () => modal.remove());
  document.body.appendChild(modal);
  const body = modal.querySelector('.modal-body');
  const footer = modal.querySelector('.modal-footer');
  // renderizar questão
  renderQuestion(body, questao, async ({ id, resposta }) => {
    // salvar resposta
    try {
      const { error } = await supabase
        .from('respostas_alunos')
        .insert({ questao_id: id, aluno_id: (await supabase.getSession()).data.session.user.id, resposta, status: 'pendente' });
      if (error) throw error;
      footer.innerHTML = '<span class="text-success">Resposta enviada!</span>';
    } catch (err) {
      footer.innerHTML = `<span class="text-danger">Erro ao enviar: ${err.message}</span>`;
    }
  });
}

init();