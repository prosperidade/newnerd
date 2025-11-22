
// ===== PRESETS =====
export const PRESETS = {
  efi: {
    label: "EF I (1ª—4ª)",
    memSeq: [3, 6, 2, 1],
    flexChanges: 1,
    speedBands: [700, 1200],
    logic: { seq: "1 — 2 — 4 — 8 — ?", options: [12, 10, 16, 6], correct: 16 },
    cpt: { targets: ["X"], n: 40, isi: [600, 900] },
    lit: {
      A: [
        {
          stem: "O gato subiu no telhado. Título mais apropriado:",
          opts: [
            "Animais em perigo",
            "O gato curioso",
            "Tempestade",
            "Cachorro perdido",
          ],
          ans: 1,
        },
        {
          stem: "Pedro viu arco-íris após chuva. O que inferir?",
          opts: ["Era noite", "Parou de chover", "Fez frio", "Era inverno"],
          ans: 1,
        },
      ],
      B: [
        {
          stem: '"Ana abriu livro e sorriu". O que explica?',
          opts: [
            "Ficou triste",
            "Gostou do que leu",
            "Estava cansada",
            "Perdeu livro",
          ],
          ans: 1,
        },
        {
          stem: '"Rio serpenteia". Serpenteia significa:',
          opts: [
            "Corre em curvas",
            "Corre reto",
            "Para de correr",
            "Sobe montanha",
          ],
          ans: 0,
        },
      ],
      C: [
        {
          stem: "Objetivo de legenda:",
          opts: ["Narrar", "Explicar brevemente", "Convencer", "Contar piada"],
          ans: 1,
        },
        {
          stem: "Ideia principal de parágrafo:",
          opts: [
            "Sempre 1ª linha",
            "Pode estar em qualquer parte",
            "Sempre última",
            "Só no título",
          ],
          ans: 1,
        },
      ],
    },
    mat: {
      A: [
        { stem: "7 + 5 =", opts: ["11", "12", "13", "14"], ans: 1 },
        { stem: "9 − 4 =", opts: ["3", "4", "5", "6"], ans: 2 },
      ],
      B: [
        { stem: "Metade de 18 =", opts: ["9", "8", "6", "12"], ans: 0 },
        { stem: "2 × 7 =", opts: ["12", "13", "14", "15"], ans: 2 },
      ],
      C: [
        {
          stem: "Perímetro retângulo 3×5:",
          opts: ["8", "15", "16", "10"],
          ans: 2,
        },
        {
          stem: "12 balas para 3 crianças, cada um recebe:",
          opts: ["3", "4", "6", "12"],
          ans: 1,
        },
      ],
    },
  },
  efii: {
    label: "EF II (5ª—8ª)",
    memSeq: [7, 3, 9, 1, 5, 8],
    flexChanges: 2,
    speedBands: [500, 900],
    logic: {
      seq: "2 — 5 — 11 — 23 — ?",
      options: [35, 47, 29, 31],
      correct: 47,
    },
    cpt: { targets: ["X"], n: 50, isi: [500, 800] },
    lit: {
      A: [
        {
          stem: '"Clima ameno" significa:',
          opts: ["Chuvoso", "Agradável", "Frio", "Tempestuoso"],
          ans: 1,
        },
      ],
      B: [
        {
          stem: "Reportagem foca:",
          opts: ["Opinião", "Relatar fatos", "Ficção", "Poesia"],
          ans: 1,
        },
      ],
      C: [
        {
          stem: "Ideia principal parágrafo:",
          opts: ["Sempre 1ª", "Qualquer parte", "Sempre última", "Só título"],
          ans: 1,
        },
      ],
    },
    mat: {
      A: [{ stem: "3/4 de 20 =", opts: ["5", "10", "15", "12"], ans: 2 }],
      B: [{ stem: "2x+6=18, x=", opts: ["3", "6", "9", "12"], ans: 1 }],
      C: [{ stem: "y=2x+1, x=3, y=", opts: ["5", "6", "7", "8"], ans: 2 }],
    },
  },
  em: {
    label: "EM (1º—3º)",
    memSeq: [9, 4, 7, 2, 6, 3, 8],
    flexChanges: 2,
    speedBands: [400, 800],
    logic: {
      seq: "3 — 9 — 27 — ? — 243",
      options: [54, 72, 81, 108],
      correct: 81,
    },
    cpt: { targets: ["X"], n: 60, isi: [450, 700] },
    lit: {
      A: [
        {
          stem: 'Em texto científico, "hipótese":',
          opts: ["Opinião", "Suposição testável", "Conclusão", "Resumo"],
          ans: 1,
        },
      ],
      B: [
        {
          stem: "Editorial busca:",
          opts: [
            "Entreter",
            "Instruir",
            "Opinar/influenciar",
            "Relatar neutro",
          ],
          ans: 2,
        },
      ],
      C: [
        {
          stem: "Falácia é:",
          opts: ["Argumento válido", "Erro raciocínio", "Resumo", "Hipótese"],
          ans: 1,
        },
      ],
    },
    mat: {
      A: [
        {
          stem: "f(x)=2x+1 é:",
          opts: ["Quadrática", "Linear", "Exponencial", "Constante"],
          ans: 1,
        },
      ],
      B: [{ stem: "Derivada x²=", opts: ["2x", "x", "x³", "2"], ans: 0 }],
      C: [
        {
          stem: "Exponencial cresce quando a>",
          opts: ["0", "1", "-1", "-2"],
          ans: 1,
        },
      ],
    },
  },
  grad: {
    label: "Graduação",
    memSeq: [12, 7, 9, 4, 6, 10, 3, 8],
    flexChanges: 3,
    speedBands: [350, 700],
    logic: {
      seq: "4 — 7 — 13 — 25 — ?",
      options: [43, 49, 37, 53],
      correct: 49,
    },
    cpt: { targets: ["X"], n: 70, isi: [400, 650] },
    lit: {
      A: [
        {
          stem: 'Revisão, "lacuna":',
          opts: ["Resumo", "Falta estudos", "Erro método", "Conclusão fraca"],
          ans: 1,
        },
      ],
      B: [
        {
          stem: "Argumento dedutivo validade:",
          opts: ["Verdade premissas", "Forma lógica", "Amostra", "Autoridade"],
          ans: 1,
        },
      ],
      C: [
        {
          stem: "Viés confirmação:",
          opts: [
            "Buscar contrários",
            "Buscar que confirmam",
            "Erro aleatório",
            "Falha medição",
          ],
          ans: 1,
        },
      ],
    },
    mat: {
      A: [
        {
          stem: "P(A)=0,3 P(B)=0,5 indep → P(A∩B)=",
          opts: ["0,15", "0,2", "0,8", "0,3"],
          ans: 0,
        },
      ],
      B: [
        { stem: "∫2x dx=", opts: ["x²+C", "2x²+C", "x+C", "x²/2+C"], ans: 0 },
      ],
      C: [
        {
          stem: "Teste t compara",
          opts: ["Médias", "Variâncias", "Medianas", "Proporções"],
          ans: 0,
        },
      ],
    },
  },
};

// ===== NORMS (cortes) =====
export const NORMS = {
  efi: {
    cognitive: { cuts: [20, 36], max: 50 },
    reading: { cuts: [1, 2], max: 3 },
    math: { cuts: [1, 2], max: 3 },
  },
  efii: {
    cognitive: { cuts: [22, 37], max: 50 },
    reading: { cuts: [1, 2], max: 3 },
    math: { cuts: [1, 2], max: 3 },
  },
  em: {
    cognitive: { cuts: [24, 38], max: 50 },
    reading: { cuts: [1, 2], max: 3 },
    math: { cuts: [1, 2], max: 3 },
  },
  grad: {
    cognitive: { cuts: [26, 40], max: 50 },
    reading: { cuts: [1, 2], max: 3 },
    math: { cuts: [1, 2], max: 3 },
  },
};
