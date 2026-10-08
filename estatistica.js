/**
 * RedeLab — Calculadora Estatística & Registro Manual de Engajamento
 * Baseada nas diretrizes pedagógicas de Oficina 1 (A Matemática dos Algoritmos).
 */

const TOTAL_FICTITIOUS_USERS = 10000;

// Pesos da Fórmula de Engajamento
const WEIGHTS = {
  LIKE: 2,         // +2 pts: Ação rápida
  COMMENT: 8,      // +8 pts: Esforço de digitação e retenção de tela
  SHARE: 20        // +20 pts: Fura a bolha e atrai novos usuários
};

// Dados e Metadados das 5 Postagens
const POSTS_DATA = [
  {
    id: 1,
    title: "Post 1: Gincana Cultural da Escola",
    author: "Lucas Gabriel (9º B)",
    category: "Amigável / Convivência",
    categoryClass: "friendly",
    cardClass: "friendly-type",
    reachFactor: 8.0,
    desc: "Post amigável com foco em cooperação e cartolinas coloridas."
  },
  {
    id: 2,
    title: "Post 2: Ataque às Garotas nos Esportes (Misoginia)",
    author: "Thiago Alves (9º A)",
    category: "Tóxico / Misoginia",
    categoryClass: "toxic",
    cardClass: "toxic-type",
    reachFactor: 15.5,
    desc: "Conteúdo preconceituoso que provoca indignação, debate furioso e comentários longos."
  },
  {
    id: 3,
    title: "Post 3: Maquete de Ciências com Reciclados",
    author: "Marina Pereira (8º A)",
    category: "Amigável / Convivência",
    categoryClass: "friendly",
    cardClass: "friendly-type",
    reachFactor: 8.5,
    desc: "Post comemorando o término de um trabalho escolar em grupo."
  },
  {
    id: 4,
    title: "Post 4: Preconceito contra Bolsistas e Novatos",
    author: "Gabriel Fonseca (9º C)",
    category: "Discurso de Ódio / Exclusão",
    categoryClass: "toxic",
    cardClass: "toxic-type",
    reachFactor: 16.0,
    desc: "Discurso hostil que polariza a rede e fura bolhas rapidamente através do algoritmo."
  },
  {
    id: 5,
    title: "Post 5: Provocação Manhã vs. Tarde",
    author: "Enzo Santos (9º A)",
    category: "Provocação Escolar",
    categoryClass: "neutral",
    cardClass: "neutral-type",
    reachFactor: 13.0,
    desc: "Rivalidade clássica entre turnos que incita respostas rápidas."
  }
];

const STORAGE_KEY = 'redelab_oficina_feed_v2';
const PROFILE_KEY = 'redelab_student_profile_v2';

document.addEventListener('DOMContentLoaded', () => {
  renderProfile();
  initCalculatorCards();
  // Tenta carregar os dados reais do feed inicialmente se existirem
  loadFromFeed(false);
});

// ============================================================
// Renderização dos Cards com Campos de Entrada Manual
// ============================================================

function initCalculatorCards() {
  const container = document.getElementById('calcCardsContainer');
  if (!container) return;

  container.innerHTML = '';

  POSTS_DATA.forEach(post => {
    const card = document.createElement('article');
    card.className = `calc-post-card ${post.cardClass}`;
    card.id = `calcCard-${post.id}`;

    card.innerHTML = `
      <div class="calc-card-header">
        <div class="calc-post-title-group">
          <h3>${escapeHtml(post.title)}</h3>
          <span class="calc-post-author">👤 ${escapeHtml(post.author)} • ${escapeHtml(post.desc)}</span>
        </div>
        <div class="calc-badge-group">
          <span class="type-pill ${post.categoryClass}">${post.category}</span>
          <span class="factor-pill" title="Multiplicador de alcance deste tipo de conteúdo">Fator: ×${post.reachFactor.toFixed(1)}</span>
        </div>
      </div>

      <div class="calc-inputs-grid">
        <!-- Campo: Curtidas -->
        <div class="calc-input-block">
          <div class="calc-input-label">
            <span>❤️ Curtidas</span>
            <span class="calc-input-weight">+2 pts</span>
          </div>
          <div class="calc-control-row">
            <button class="calc-step-btn" onclick="stepManualValue(${post.id}, 'likes', -1)">-1</button>
            <input type="number" min="0" class="calc-input-num" id="inputLikes-${post.id}" value="0"
                   oninput="recalculatePost(${post.id})" onchange="recalculatePost(${post.id})">
            <button class="calc-step-btn" onclick="stepManualValue(${post.id}, 'likes', 1)">+1</button>
            <button class="calc-step-btn" onclick="stepManualValue(${post.id}, 'likes', 10)">+10</button>
          </div>
        </div>

        <!-- Campo: Comentários -->
        <div class="calc-input-block">
          <div class="calc-input-label">
            <span>💬 Comentários</span>
            <span class="calc-input-weight highlight">+8 pts</span>
          </div>
          <div class="calc-control-row">
            <button class="calc-step-btn" onclick="stepManualValue(${post.id}, 'comments', -1)">-1</button>
            <input type="number" min="0" class="calc-input-num" id="inputComments-${post.id}" value="0"
                   oninput="recalculatePost(${post.id})" onchange="recalculatePost(${post.id})">
            <button class="calc-step-btn" onclick="stepManualValue(${post.id}, 'comments', 1)">+1</button>
            <button class="calc-step-btn" onclick="stepManualValue(${post.id}, 'comments', 10)">+10</button>
          </div>
        </div>

        <!-- Campo: Compartilhamentos -->
        <div class="calc-input-block">
          <div class="calc-input-label">
            <span>🚀 Compartilhamentos</span>
            <span class="calc-input-weight viral">+20 pts</span>
          </div>
          <div class="calc-control-row">
            <button class="calc-step-btn" onclick="stepManualValue(${post.id}, 'shares', -1)">-1</button>
            <input type="number" min="0" class="calc-input-num" id="inputShares-${post.id}" value="0"
                   oninput="recalculatePost(${post.id})" onchange="recalculatePost(${post.id})">
            <button class="calc-step-btn" onclick="stepManualValue(${post.id}, 'shares', 1)">+1</button>
            <button class="calc-step-btn" onclick="stepManualValue(${post.id}, 'shares', 5)">+5</button>
          </div>
        </div>
      </div>

      <!-- Memória de Cálculo e Resultados Dinâmicos -->
      <div class="calc-results-strip">
        <div class="calc-breakdown-row">
          <div class="calc-math-formula" id="mathFormula-${post.id}">
            P = (0 × 2) + (0 × 8) + (0 × 20) = <strong>0 pts</strong>
          </div>
          <div class="calc-pills-duo">
            <span class="points-pill" id="scorePill-${post.id}">0 pts</span>
            <span class="reach-pill" id="reachPill-${post.id}">0 pessoas</span>
          </div>
        </div>

        <div class="stat-bar-container">
          <div class="stat-bar-fill ${post.categoryClass}" id="reachBar-${post.id}" style="width: 0%;"></div>
        </div>

        <div class="calc-reach-details">
          <span id="reachCalcStep-${post.id}">Alcance: 15 + (0 pts × ${post.reachFactor}) = <strong>0 pessoas</strong></span>
          <span id="reachPercent-${post.id}">0% da rede</span>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  recalculateAll();
}

// ============================================================
// Incremento e Decremento Rápido
// ============================================================

function stepManualValue(postId, type, delta) {
  const capType = type.charAt(0).toUpperCase() + type.slice(1);
  const input = document.getElementById(`input${capType}-${postId}`);
  if (!input) return;
  const current = Math.max(0, parseInt(input.value, 10) || 0);
  const updated = Math.max(0, current + delta);
  input.value = updated;
  recalculatePost(postId);
}

// ============================================================
// Lógica de Cálculo Matemático
// ============================================================

function recalculatePost(postId) {
  const postMeta = POSTS_DATA.find(p => p.id === postId);
  if (!postMeta) return;

  const likes = Math.max(0, parseInt(document.getElementById(`inputLikes-${postId}`)?.value, 10) || 0);
  const comments = Math.max(0, parseInt(document.getElementById(`inputComments-${postId}`)?.value, 10) || 0);
  const shares = Math.max(0, parseInt(document.getElementById(`inputShares-${postId}`)?.value, 10) || 0);

  const ptsLikes = likes * WEIGHTS.LIKE;
  const ptsComments = comments * WEIGHTS.COMMENT;
  const ptsShares = shares * WEIGHTS.SHARE;
  const score = ptsLikes + ptsComments + ptsShares;

  let reach = 0;
  if (score > 0) {
    reach = Math.min(TOTAL_FICTITIOUS_USERS, Math.round(15 + score * postMeta.reachFactor));
  }

  const percent = ((reach / TOTAL_FICTITIOUS_USERS) * 100).toFixed(1);

  // Atualiza elementos de texto e fórmula
  const formulaEl = document.getElementById(`mathFormula-${postId}`);
  if (formulaEl) {
    formulaEl.innerHTML = `P = (${likes} × 2) + (${comments} × 8) + (${shares} × 20) = <strong>${score} pts</strong>`;
  }

  const scorePill = document.getElementById(`scorePill-${postId}`);
  if (scorePill) scorePill.innerText = `${score} pts`;

  const reachPill = document.getElementById(`reachPill-${postId}`);
  if (reachPill) reachPill.innerText = `${reach.toLocaleString('pt-BR')} pessoas`;

  const reachBar = document.getElementById(`reachBar-${postId}`);
  if (reachBar) reachBar.style.width = `${Math.min(100, percent)}%`;

  const reachStepEl = document.getElementById(`reachCalcStep-${postId}`);
  if (reachStepEl) {
    if (score > 0) {
      reachStepEl.innerHTML = `Alcance: 15 + (${score} × ${postMeta.reachFactor}) = <strong>${reach.toLocaleString('pt-BR')} pessoas</strong>`;
    } else {
      reachStepEl.innerHTML = `Alcance: <strong>0 pessoas</strong> (sem engajamento)`;
    }
  }

  const reachPercentEl = document.getElementById(`reachPercent-${postId}`);
  if (reachPercentEl) reachPercentEl.innerText = `${percent}% da rede escolar`;

  updateSummaryChart();
}

function recalculateAll() {
  POSTS_DATA.forEach(p => recalculatePost(p.id));
}

// ============================================================
// Gráfico Comparativo Geral de Todos os Posts
// ============================================================

function updateSummaryChart() {
  const chartStack = document.getElementById('chartRowsStack');
  if (!chartStack) return;

  chartStack.innerHTML = '';

  let maxReach = 0;
  let topPostId = null;

  POSTS_DATA.forEach(post => {
    const likes = Math.max(0, parseInt(document.getElementById(`inputLikes-${post.id}`)?.value, 10) || 0);
    const comments = Math.max(0, parseInt(document.getElementById(`inputComments-${post.id}`)?.value, 10) || 0);
    const shares = Math.max(0, parseInt(document.getElementById(`inputShares-${post.id}`)?.value, 10) || 0);

    const score = (likes * WEIGHTS.LIKE) + (comments * WEIGHTS.COMMENT) + (shares * WEIGHTS.SHARE);
    let reach = 0;
    if (score > 0) {
      reach = Math.min(TOTAL_FICTITIOUS_USERS, Math.round(15 + score * post.reachFactor));
    }

    if (reach > maxReach) {
      maxReach = reach;
      topPostId = post.id;
    }

    const pct = ((reach / TOTAL_FICTITIOUS_USERS) * 100).toFixed(1);

    const row = document.createElement('div');
    row.className = 'chart-bar-item';
    row.innerHTML = `
      <div class="chart-bar-labels">
        <strong>${escapeHtml(post.title)} (${post.category})</strong>
        <span class="chart-metric">${reach.toLocaleString('pt-BR')} pessoas (${score} pts)</span>
      </div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill ${post.categoryClass}" style="width: ${Math.min(100, pct)}%;"></div>
      </div>
    `;
    chartStack.appendChild(row);
  });

  // Atualiza banner de destaque
  const highlightEl = document.getElementById('topPostHighlight');
  if (highlightEl) {
    if (maxReach > 0 && topPostId) {
      const top = POSTS_DATA.find(p => p.id === topPostId);
      highlightEl.innerHTML = `
        🏆 <strong>Publicação com Maior Alcance:</strong> ${escapeHtml(top.title)}
        com <strong>${maxReach.toLocaleString('pt-BR')} pessoas alcançadas</strong>.
        ${top.reachFactor > 10 ? '🔥 <em>(O fator de retenção/conflito alto multiplicou expressivamente os pontos!)</em>' : ''}
      `;
    } else {
      highlightEl.innerHTML = 'Insira dados acima para ver o comparativo de alcance em tempo real.';
    }
  }
}

// ============================================================
// Cenários Pré-Configurados & Interações
// ============================================================

// 1. Puxa dados reais já salvos no feed do LocalStorage
function loadFromFeed(showToastMsg = true) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (showToastMsg) showToast('ℹ️ O Feed ainda está zerado ou sem interações.');
      return;
    }
    const state = JSON.parse(raw);
    const posts = state.posts || state;

    POSTS_DATA.forEach(p => {
      const post = posts[p.id] || {};
      const likes = Number(post.likes) || 0;
      const shares = Number(post.shares) || 0;
      const commentsArr = Array.isArray(post.comments)
        ? post.comments
        : (post.comments && typeof post.comments === 'object' ? Object.values(post.comments) : []);

      let totalCommentsCount = commentsArr.length;
      commentsArr.forEach(c => {
        const replies = Array.isArray(c.replies) ? c.replies : Object.values(c.replies || {});
        totalCommentsCount += replies.length;
      });

      const inLikes = document.getElementById(`inputLikes-${p.id}`);
      const inComments = document.getElementById(`inputComments-${p.id}`);
      const inShares = document.getElementById(`inputShares-${p.id}`);

      if (inLikes) inLikes.value = likes;
      if (inComments) inComments.value = totalCommentsCount;
      if (inShares) inShares.value = shares;
    });

    recalculateAll();
    if (showToastMsg) showToast('📥 Dados reais do feed carregados com sucesso!');
  } catch (e) {
    if (showToastMsg) showToast('❌ Erro ao ler dados do feed.');
  }
}

// 2. Experimento Científico: Mesmas ações em todos os posts
function setEqualActionsScenario() {
  const L = 25;
  const C = 10;
  const S = 3;

  POSTS_DATA.forEach(p => {
    document.getElementById(`inputLikes-${p.id}`).value = L;
    document.getElementById(`inputComments-${p.id}`).value = C;
    document.getElementById(`inputShares-${p.id}`).value = S;
  });

  recalculateAll();
  showToast('⚖️ Cenário de Ações Idênticas aplicado! Observe a discrepância de alcance.');
}

// 3. Cenário Típico de Polarização Digital
function setPolarizationScenario() {
  // Post 1 (Amigável): Poucos comentários
  document.getElementById('inputLikes-1').value = 18;
  document.getElementById('inputComments-1').value = 3;
  document.getElementById('inputShares-1').value = 1;

  // Post 2 (Misoginia): Muita indignação e debate furioso
  document.getElementById('inputLikes-2').value = 45;
  document.getElementById('inputComments-2').value = 38;
  document.getElementById('inputShares-2').value = 12;

  // Post 3 (Maquete Ciências): Curtidas pacíficas
  document.getElementById('inputLikes-3').value = 22;
  document.getElementById('inputComments-3').value = 4;
  document.getElementById('inputShares-3').value = 1;

  // Post 4 (Ódio a Novatos): Altíssima polarização
  document.getElementById('inputLikes-4').value = 35;
  document.getElementById('inputComments-4').value = 42;
  document.getElementById('inputShares-4').value = 15;

  // Post 5 (Turnos): Discussão moderada
  document.getElementById('inputLikes-5').value = 28;
  document.getElementById('inputComments-5').value = 15;
  document.getElementById('inputShares-5').value = 5;

  recalculateAll();
  showToast('🎲 Cenário Realista de Polarização carregado!');
}

// 4. Limpar todos os campos
function resetAllManualInputs() {
  POSTS_DATA.forEach(p => {
    const inL = document.getElementById(`inputLikes-${p.id}`);
    const inC = document.getElementById(`inputComments-${p.id}`);
    const inS = document.getElementById(`inputShares-${p.id}`);
    if (inL) inL.value = 0;
    if (inC) inC.value = 0;
    if (inS) inS.value = 0;
  });

  recalculateAll();
  showToast('🔄 Todos os campos foram zerados.');
}

// ============================================================
// Utilitários & Perfil
// ============================================================

function renderProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const nameEl = document.getElementById('sidebarUserName');
      const infoEl = document.getElementById('sidebarUserInfo');
      const avEl = document.getElementById('sidebarAvatarCircle');
      if (nameEl) nameEl.innerText = p.name || 'Aluno Participante';
      if (infoEl) infoEl.innerText = p.grade || '8º / 9º Ano';
      if (avEl && p.name) {
        const parts = p.name.split(' ').filter(Boolean);
        let initials = 'AL';
        if (parts.length >= 2) initials = (parts[0][0] + parts[1][0]).toUpperCase();
        else if (parts.length === 1 && parts[0].length >= 2) initials = parts[0].substring(0, 2).toUpperCase();
        avEl.innerText = initials;
      }
    }
  } catch (e) {}
}

let toastTimeout = null;
function showToast(text) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.innerText = text;
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2800);
}

function escapeHtml(str) {
  if (typeof str !== 'string') str = String(str || '');
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
