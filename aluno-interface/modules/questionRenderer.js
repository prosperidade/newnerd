/*
 * questionRenderer module
 *
 * This module centralises the logic for rendering questions on screen and
 * collecting user responses. It supports multiple types of questions
 * (múltipla escolha, verdadeiro/falso, discursiva) and hides away the
 * repetitive DOM manipulation found in the original code. It exposes
 * a single `render` function that accepts a container element, a
 * question object and a callback invoked when the user submits an
 * answer.
 */

/**
 * Render a question into the given container. The question object must
 * contain the following properties:
 *   - id: unique identifier
 *   - tipo: 'multipla', 'verdadeiro_falso' ou 'discursiva'
 *   - enunciado: string com o texto da pergunta
 *   - alternativas: array de strings (para múltipla escolha)
 *   - gabarito: string ou boolean esperado
 *   - justificativa: explicação opcional
 *
 * O callback `onSubmit` recebe um objeto com o `id` e a `resposta`
 * fornecida pelo usuário. O módulo não lida com persistência; isso
 * deve ser feito por um serviço externo (por exemplo, supabase).
 */
export function render(container, question, onSubmit) {
  if (!container) {
    throw new Error('Container element is required');
  }
  // Limpa o container
  container.innerHTML = '';
  // Cria enunciado
  const heading = document.createElement('h3');
  heading.textContent = question.enunciado;
  container.appendChild(heading);

  let inputElement;
  switch (question.tipo) {
    case 'multipla':
      inputElement = renderMultipleChoice(container, question.alternativas);
      break;
    case 'verdadeiro_falso':
      inputElement = renderTrueFalse(container);
      break;
    case 'discursiva':
    default:
      inputElement = renderDiscursive(container);
      break;
  }
  // Botão de envio
  const btn = document.createElement('button');
  btn.textContent = 'Enviar resposta';
  btn.className = 'btn btn-primary';
  btn.addEventListener('click', () => {
    const resposta = getResposta(inputElement, question.tipo);
    if (onSubmit && typeof onSubmit === 'function') {
      onSubmit({ id: question.id, resposta });
    }
  });
  container.appendChild(btn);
}

function renderMultipleChoice(container, alternativas = []) {
  const ul = document.createElement('ul');
  ul.className = 'list-unstyled';
  alternativas.forEach((alt, i) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'alternativa';
    radio.value = alt;
    label.appendChild(radio);
    label.append(' ' + alt);
    li.appendChild(label);
    ul.appendChild(li);
  });
  container.appendChild(ul);
  return ul;
}

function renderTrueFalse(container) {
  const wrapper = document.createElement('div');
  ['Verdadeiro', 'Falso'].forEach((texto) => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'verdadeiro_falso';
    radio.value = texto.toLowerCase();
    label.appendChild(radio);
    label.append(' ' + texto);
    wrapper.appendChild(label);
    wrapper.appendChild(document.createElement('br'));
  });
  container.appendChild(wrapper);
  return wrapper;
}

function renderDiscursive(container) {
  const textarea = document.createElement('textarea');
  textarea.className = 'form-control';
  textarea.rows = 6;
  container.appendChild(textarea);
  return textarea;
}

function getResposta(element, tipo) {
  switch (tipo) {
    case 'multipla': {
      const selected = element.querySelector('input[name="alternativa"]:checked');
      return selected ? selected.value : null;
    }
    case 'verdadeiro_falso': {
      const selected = element.querySelector('input[name="verdadeiro_falso"]:checked');
      return selected ? selected.value : null;
    }
    case 'discursiva':
    default:
      return element.value.trim();
  }
}