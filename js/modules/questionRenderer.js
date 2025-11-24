/*
 * Módulo questionRenderer (refatorado)
 *
 * Fornece uma API para renderizar questões em um contêiner e
 * capturar a resposta do usuário. É utilizado tanto para exibir
 * perguntas ainda não respondidas quanto para revisar perguntas
 * respondidas, podendo ser estendido para mostrar gabaritos e
 * justificativas.
 */

export function render(container, question, onSubmit) {
  if (!container) throw new Error('Container inválido');
  container.innerHTML = '';
  const header = document.createElement('h5');
  header.textContent = question.enunciado;
  container.appendChild(header);
  let widget;
  switch (question.tipo) {
    case 'multipla':
      widget = renderMultipla(container, question.alternativas);
      break;
    case 'verdadeiro_falso':
      widget = renderVF(container);
      break;
    default:
      widget = renderDiscursiva(container);
      break;
  }
  const btn = document.createElement('button');
  btn.className = 'btn btn-success mt-3';
  btn.textContent = 'Enviar';
  btn.addEventListener('click', () => {
    const resposta = obterResposta(widget, question.tipo);
    onSubmit({ id: question.id, resposta });
  });
  container.appendChild(btn);
}

function renderMultipla(container, alternativas = []) {
  const group = document.createElement('div');
  alternativas.forEach((alt) => {
    const label = document.createElement('label');
    label.className = 'd-block';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'alternativa';
    radio.value = alt;
    label.appendChild(radio);
    label.append(' ' + alt);
    group.appendChild(label);
  });
  container.appendChild(group);
  return group;
}

function renderVF(container) {
  const wrapper = document.createElement('div');
  ['Verdadeiro', 'Falso'].forEach((texto) => {
    const label = document.createElement('label');
    label.className = 'd-block';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'vf';
    radio.value = texto.toLowerCase();
    label.appendChild(radio);
    label.append(' ' + texto);
    wrapper.appendChild(label);
  });
  container.appendChild(wrapper);
  return wrapper;
}

function renderDiscursiva(container) {
  const textarea = document.createElement('textarea');
  textarea.className = 'form-control';
  textarea.rows = 4;
  container.appendChild(textarea);
  return textarea;
}

function obterResposta(widget, tipo) {
  switch (tipo) {
    case 'multipla': {
      const selected = widget.querySelector('input[name="alternativa"]:checked');
      return selected ? selected.value : null;
    }
    case 'verdadeiro_falso': {
      const selected = widget.querySelector('input[name="vf"]:checked');
      return selected ? selected.value : null;
    }
    default:
      return widget.value.trim();
  }
}