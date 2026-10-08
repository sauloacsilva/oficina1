/**
 * RedeLab — Sincronização via JSONBin.io
 * API de JSON gratuita, sem SDK. Polling a cada 3s para sincronizar
 * todos os dispositivos conectados ao GitHub Pages.
 *
 * ⚙️  CONFIGURAÇÃO (2 valores apenas):
 *   1. Acesse https://jsonbin.io → crie conta gratuita
 *   2. Clique em "CREATE BIN" → cole o JSON inicial abaixo → salve
 *   3. Copie o BIN_ID (aparece na URL) e a MASTER_KEY (menu API Keys)
 *   4. Cole os dois valores nas constantes abaixo
 */

// ============================================================
// ⚙️  SUAS CREDENCIAIS JSONBIN
// ============================================================
const BIN_ID = 'C6ac5bfbaac6210605a1b152f';    // ex: "64f3a1b2..."
const MASTER_KEY = '$2a$10$pCFb3igTCxvYYv8QlIw7GezegEOAJuWL/phP/OaN7lG6hQ/yU9NMa'; // ex: "$2a$10$..."
const POLL_MS = 3000; // Verifica novos dados a cada 3 segundos
// ============================================================

const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Master-Key': MASTER_KEY,
  'X-Bin-Versioning': 'false'  // Desativa versionamento para simplificar
};

// ============================================================
// JSON INICIAL — cole este conteúdo ao criar seu Bin no JSONBin.io
// ============================================================
// {
//   "posts": {
//     "1": { "likes": 0, "shares": 0, "comments": [] },
//     "2": { "likes": 0, "shares": 0, "comments": [] },
//     "3": { "likes": 0, "shares": 0, "comments": [] },
//     "4": { "likes": 0, "shares": 0, "comments": [] },
//     "5": { "likes": 0, "shares": 0, "comments": [] }
//   }
// }
// ============================================================

const TOTAL_FICTITIOUS_USERS = 10000;

const WEIGHTS = {
  LIKE: 2,
  COMMENT: 8,
  REPLY: 12,
  COMMENT_LIKE: 1,
  SHARE: 20
};

const POST_META = {
  1: { reachFactor: 8.0 },
  2: { reachFactor: 15.5 },
  3: { reachFactor: 8.5 },
  4: { reachFactor: 16.0 },
  5: { reachFactor: 13.0 }
};

function getZeroState() {
  const s = { posts: {} };
  for (let i = 1; i <= 5; i++) {
    s.posts[i] = { likes: 0, shares: 0, comments: [] };
  }
  return s;
}

// Estado local em memória (atualizado pelo polling)
let localState = getZeroState();
// Flag para saber se o JSONBin está configurado
const IS_CONFIGURED = BIN_ID !== 'COLE_SEU_BIN_ID_AQUI';

// ============================================================
// Comunicação com JSONBin.io
// ============================================================

async function readState() {
  try {
    const res = await fetch(API_URL, { headers: HEADERS });
    const json = await res.json();
    return json.record || getZeroState();
  } catch (e) {
    console.warn('Leitura falhou:', e);
    return localState;
  }
}

async function writeState(newState) {
  try {
    await fetch(API_URL, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(newState)
    });
    localState = newState;
  } catch (e) {
    console.warn('Gravação falhou:', e);
  }
}

// ============================================================
// Inicialização e Polling
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (IS_CONFIGURED) {
    // Carrega o estado atual do servidor
    const data = await readState();
    localState = data;
    renderAll(data);
    updateAllCalculations(data);
    // Inicia polling — verifica atualizações a cada POLL_MS ms
    setInterval(async () => {
      const fresh = await readState();
      localState = fresh;
      renderAll(fresh);
      updateAllCalculations(fresh);
    }, POLL_MS);
  } else {
    // Modo local: funciona sem JSONBin
    renderAll(localState);
    updateAllCalculations(localState);
  }
});

// ============================================================
// Ações do usuário
// ============================================================

function toggleLike(postId) {
  // Atualização otimista: modifica local e re-renderiza imediatamente
  localState.posts[postId].likes = (localState.posts[postId].likes || 0) + 1;
  renderAll(localState);
  updateAllCalculations(localState);
  showToast('❤️ Post curtido!');
  // Grava no servidor em segundo plano
  if (IS_CONFIGURED) writeState(localState);
}

function sharePost(postId) {
  localState.posts[postId].shares = (localState.posts[postId].shares || 0) + 1;
  renderAll(localState);
  updateAllCalculations(localState);
  showToast('🚀 Post compartilhado!');
  if (IS_CONFIGURED) writeState(localState);
}

function submitComment(postId) {
  const input = document.getElementById(`commentInput-${postId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const newComment = {
    id: Date.now(),
    author: 'Aluno Participante',
    text,
    likes: 0,
    replies: []
  };

  if (!Array.isArray(localState.posts[postId].comments)) {
    localState.posts[postId].comments = [];
  }
  localState.posts[postId].comments.push(newComment);

  input.value = '';
  renderAll(localState);
  updateAllCalculations(localState);
  showToast('💬 Comentário enviado!');
  if (IS_CONFIGURED) writeState(localState);
}

function likeComment(postId, commentId) {
  const comment = (localState.posts[postId].comments || []).find(c => c.id === commentId);
  if (comment) comment.likes = (comment.likes || 0) + 1;
  renderAll(localState);
  updateAllCalculations(localState);
  showToast('❤️ Curtida no comentário!');
  if (IS_CONFIGURED) writeState(localState);
}

function submitReply(postId, commentId) {
  const input = document.getElementById(`replyInput-${postId}-${commentId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const comment = (localState.posts[postId].comments || []).find(c => c.id === commentId);
  if (comment) {
    if (!Array.isArray(comment.replies)) comment.replies = [];
    comment.replies.push({ id: Date.now(), author: 'Aluno Participante', text });
  }

  const row = document.getElementById(`replyRow-${postId}-${commentId}`);
  if (row) row.style.display = 'none';
  input.value = '';

  renderAll(localState);
  updateAllCalculations(localState);
  showToast('🔁 Resposta enviada!');
  if (IS_CONFIGURED) writeState(localState);
}

function toggleReplyBox(postId, commentId) {
  const row = document.getElementById(`replyRow-${postId}-${commentId}`);
  if (!row) return;
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  if (row.style.display === 'flex') {
    const input = document.getElementById(`replyInput-${postId}-${commentId}`);
    if (input) input.focus();
  }
}

function resetAllFeed() {
  const zero = getZeroState();
  localState = zero;
  renderAll(zero);
  updateAllCalculations(zero);
  showToast('🔄 Todos os posts foram zerados com sucesso!');
  if (IS_CONFIGURED) writeState(zero);
}

// ============================================================
// Renderização
// ============================================================

function renderAll(data) {
  for (let id = 1; id <= 5; id++) {
    const post = (data.posts && data.posts[id]) || { likes: 0, shares: 0, comments: [] };
    renderPostStats(id, post);
    renderCommentsList(id, post.comments || []);
  }
}

function renderPostStats(postId, post) {
  const likes = post.likes || 0;
  const shares = post.shares || 0;
  const comments = Array.isArray(post.comments) ? post.comments : [];

  let totalCount = 0;
  comments.forEach(c => {
    totalCount++;
    totalCount += (c.replies || []).length;
  });

  const sLikes = document.getElementById(`statLikes-${postId}`);
  const sComments = document.getElementById(`statComments-${postId}`);
  const sShares = document.getElementById(`statShares-${postId}`);

  if (sLikes) sLikes.innerHTML = `❤️ <strong>${likes}</strong> ${likes === 1 ? 'curtida' : 'curtidas'}`;
  if (sComments) sComments.innerHTML = `💬 <strong>${totalCount}</strong> ${totalCount === 1 ? 'comentário' : 'comentários'}`;
  if (sShares) sShares.innerHTML = `🚀 <strong>${shares}</strong> ${shares === 1 ? 'compartilhamento' : 'compartilhamentos'}`;

  const btnLike = document.getElementById(`btnLike-${postId}`);
  if (btnLike) {
    btnLike.classList.toggle('liked', likes > 0);
    btnLike.querySelector('.btn-icon').innerText = likes > 0 ? '❤️' : '🤍';
    btnLike.querySelector('.btn-label').innerText = likes > 0 ? `Curtido (${likes})` : 'Curtir';
  }

  const btnShare = document.getElementById(`btnShare-${postId}`);
  if (btnShare) btnShare.classList.toggle('shared', shares > 0);
}

function renderCommentsList(postId, comments) {
  const container = document.getElementById(`commentsArea-${postId}`);
  if (!container) return;

  // Preserva reply boxes abertos antes de re-renderizar
  const openBoxes = new Set();
  container.querySelectorAll('.reply-input-row').forEach(row => {
    if (row.style.display !== 'none' && row.id) openBoxes.add(row.id);
  });

  container.innerHTML = '';

  (comments || []).forEach(c => {
    const replies = c.replies || [];
    const replyRowId = `replyRow-${postId}-${c.id}`;
    const wasOpen = openBoxes.has(replyRowId);

    let repliesHtml = '';
    if (replies.length > 0) {
      repliesHtml = `<div class="replies-thread">` +
        replies.map(r =>
          `<div class="reply-item"><strong>${escapeHtml(r.author)}:</strong> ${escapeHtml(r.text)}</div>`
        ).join('') +
        `</div>`;
    }

    const cLikes = c.likes || 0;
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.innerHTML = `
      <div class="c-header">
        <span class="c-user">${escapeHtml(c.author)}</span>
      </div>
      <div class="c-body-text">${escapeHtml(c.text)}</div>
      <div class="c-actions-row">
        <button class="c-like-btn${cLikes > 0 ? ' liked' : ''}"
                onclick="likeComment(${postId}, ${c.id})">
          ❤️ ${cLikes} ${cLikes === 1 ? 'curtida' : 'curtidas'}
        </button>
        <button class="c-reply-btn" onclick="toggleReplyBox(${postId}, ${c.id})">
          Responder
        </button>
      </div>
      ${repliesHtml}
      <div class="reply-input-row" id="${replyRowId}" style="display:${wasOpen ? 'flex' : 'none'};">
        <input type="text" placeholder="Escreva sua resposta..."
               id="replyInput-${postId}-${c.id}"
               onkeypress="if(event.key==='Enter') submitReply(${postId}, ${c.id})">
        <button onclick="submitReply(${postId}, ${c.id})">Enviar</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// ============================================================
// Estatísticas
// ============================================================

function updateAllCalculations(data) {
  let totalInteractions = 0;
  let maxReach = 0;

  for (let id = 1; id <= 5; id++) {
    const post = (data.posts && data.posts[id]) || { likes: 0, shares: 0, comments: [] };
    const likes = post.likes || 0;
    const shares = post.shares || 0;
    const comments = Array.isArray(post.comments) ? post.comments : [];

    let commentsCount = comments.length;
    let repliesCount = 0;
    let commentLikesCount = 0;
    comments.forEach(c => {
      commentLikesCount += c.likes || 0;
      repliesCount += (c.replies || []).length;
    });

    totalInteractions += likes + commentsCount + repliesCount + commentLikesCount + shares;

    const score =
      (likes * WEIGHTS.LIKE) +
      (commentsCount * WEIGHTS.COMMENT) +
      (repliesCount * WEIGHTS.REPLY) +
      (commentLikesCount * WEIGHTS.COMMENT_LIKE) +
      (shares * WEIGHTS.SHARE);

    let reach = 0;
    if (score > 0) {
      reach = Math.min(TOTAL_FICTITIOUS_USERS,
        Math.round(15 + score * POST_META[id].reachFactor));
    }
    if (reach > maxReach) maxReach = reach;

    const totalCount = commentsCount + repliesCount;
    const metaEl = document.getElementById(`statMeta-${id}`);
    const ptsEl = document.getElementById(`statPoints-${id}`);
    const reachEl = document.getElementById(`statReach-${id}`);
    const barEl = document.getElementById(`statBar-${id}`);

    if (metaEl) metaEl.innerText = `${likes} curtidas • ${totalCount} comentários/respostas • ${shares} compartilhamentos`;
    if (ptsEl) ptsEl.innerText = `${score} pts`;
    if (reachEl) reachEl.innerText = `${reach.toLocaleString('pt-BR')} pessoas`;
    if (barEl) {
      barEl.style.width = `${Math.min(100, (reach / TOTAL_FICTITIOUS_USERS * 100).toFixed(1))}%`;
    }
  }

  const navInteractions = document.getElementById('navFeedInteractions');
  const sideReachVal = document.getElementById('sidebarReachValue');
  const sideReachBar = document.getElementById('sidebarReachBar');

  if (navInteractions) navInteractions.innerText = `${totalInteractions} ${totalInteractions === 1 ? 'ação' : 'ações'}`;
  if (sideReachVal) sideReachVal.innerText = maxReach.toLocaleString('pt-BR');
  if (sideReachBar) sideReachBar.style.width = `${Math.min(100, (maxReach / TOTAL_FICTITIOUS_USERS * 100).toFixed(0))}%`;
}

// ============================================================
// Navegação
// ============================================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.m-btn').forEach(b => b.classList.remove('active'));

  const map = { oficina: ['sectionOficina', 'navOficinaBtn', 0], feed: ['sectionFeed', 'navFeedBtn', 1], stats: ['sectionStats', 'navStatsBtn', 2] };
  if (map[tabId]) {
    document.getElementById(map[tabId][0]).classList.add('active');
    document.getElementById(map[tabId][1]).classList.add('active');
    const mBtns = document.querySelectorAll('.m-btn');
    if (mBtns[map[tabId][2]]) mBtns[map[tabId][2]].classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNodeHint(text) {
  const box = document.getElementById('nodeHintBox');
  if (box) box.innerHTML = `💡 <strong>Papel no Grafo:</strong> ${escapeHtml(text)}`;
}

// ============================================================
// Toast e utilitários
// ============================================================
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
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
