/**
 * RedeLab — Sincronização em Tempo Real com Firebase Realtime Database
 * Todos os dispositivos na sala veem as mesmas interações ao vivo.
 *
 * ⚙️  CONFIGURAÇÃO: preencha FIREBASE_CONFIG com os dados do seu projeto.
 *     Guia completo em: https://console.firebase.google.com/
 */

// ============================================================
// ⚙️  COLE AQUI OS DADOS DO SEU PROJETO FIREBASE
// ============================================================
const FIREBASE_CONFIG = {
  apiKey:            "COLE_SUA_API_KEY",
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  databaseURL:       "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID"
};
// ============================================================

const TOTAL_FICTITIOUS_USERS = 10000;

const WEIGHTS = {
  LIKE:          2,
  COMMENT:       8,
  REPLY:        12,
  COMMENT_LIKE:  1,
  SHARE:        20
};

// Metadados locais — não precisam ir ao banco
const POST_META = {
  1: { reachFactor: 8.0  },
  2: { reachFactor: 15.5 },
  3: { reachFactor: 8.5  },
  4: { reachFactor: 16.0 },
  5: { reachFactor: 13.0 }
};

// Estrutura zerada para reset
function getZeroState() {
  const s = {};
  for (let i = 1; i <= 5; i++) {
    s[i] = { likes: 0, shares: 0, comments: {} };
  }
  return s;
}

// Referência global ao nó do Firebase
let postsRef = null;
// Cópia local dos dados mais recentes recebidos do Firebase
let currentData = getZeroState();

// ============================================================
// Inicialização
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const isConfigured = FIREBASE_CONFIG.apiKey !== 'COLE_SUA_API_KEY';

  if (isConfigured) {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      const db  = firebase.database();
      postsRef  = db.ref('oficina/posts');

      // Escuta todas as mudanças em tempo real
      postsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          // Primeira vez: grava o estado zerado no banco
          postsRef.set(getZeroState());
          return;
        }
        currentData = data;
        renderAll(data);
        updateAllCalculations(data);
      });
    } catch (e) {
      console.error('Erro ao inicializar Firebase:', e);
      fallbackLocal();
    }
  } else {
    // Firebase não configurado — modo local (um dispositivo)
    fallbackLocal();
  }
});

function fallbackLocal() {
  console.warn('Firebase não configurado. Rodando em modo local.');
  renderAll(currentData);
  updateAllCalculations(currentData);
}

// ============================================================
// Ações do usuário → escrevem no Firebase
// ============================================================

function toggleLike(postId) {
  if (postsRef) {
    postsRef.child(`${postId}/likes`).transaction(n => (n || 0) + 1);
  } else {
    currentData[postId].likes += 1;
    renderAll(currentData);
    updateAllCalculations(currentData);
  }
  showToast('❤️ Post curtido!');
}

function sharePost(postId) {
  if (postsRef) {
    postsRef.child(`${postId}/shares`).transaction(n => (n || 0) + 1);
  } else {
    currentData[postId].shares += 1;
    renderAll(currentData);
    updateAllCalculations(currentData);
  }
  showToast('🚀 Post compartilhado!');
}

function submitComment(postId) {
  const input = document.getElementById(`commentInput-${postId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const newComment = { author: 'Aluno Participante', text, likes: 0, replies: {} };

  if (postsRef) {
    postsRef.child(`${postId}/comments`).push(newComment);
  } else {
    const id = `c${Date.now()}`;
    if (!currentData[postId].comments) currentData[postId].comments = {};
    currentData[postId].comments[id] = newComment;
    renderAll(currentData);
    updateAllCalculations(currentData);
  }

  input.value = '';
  showToast('💬 Comentário enviado!');
}

function likeComment(postId, commentId) {
  if (postsRef) {
    postsRef.child(`${postId}/comments/${commentId}/likes`).transaction(n => (n || 0) + 1);
  } else {
    const c = currentData[postId].comments[commentId];
    if (c) { c.likes = (c.likes || 0) + 1; }
    renderAll(currentData);
    updateAllCalculations(currentData);
  }
  showToast('❤️ Curtida no comentário!');
}

function submitReply(postId, commentId) {
  const input = document.getElementById(`replyInput-${postId}-${commentId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const reply = { author: 'Aluno Participante', text };

  if (postsRef) {
    postsRef.child(`${postId}/comments/${commentId}/replies`).push(reply);
  } else {
    const c = currentData[postId].comments[commentId];
    if (c) {
      if (!c.replies) c.replies = {};
      c.replies[`r${Date.now()}`] = reply;
    }
    renderAll(currentData);
    updateAllCalculations(currentData);
  }

  const row = document.getElementById(`replyRow-${postId}-${commentId}`);
  if (row) row.style.display = 'none';
  input.value = '';
  showToast('🔁 Resposta enviada!');
}

// Abre/fecha caixa de resposta (apenas local — sem Firebase)
function toggleReplyBox(postId, commentId) {
  const row = document.getElementById(`replyRow-${postId}-${commentId}`);
  if (!row) return;
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
  if (row.style.display === 'flex') {
    const input = document.getElementById(`replyInput-${postId}-${commentId}`);
    if (input) input.focus();
  }
}

// Reset: sobrescreve o nó do Firebase com zeros
function resetAllFeed() {
  const zero = getZeroState();
  if (postsRef) {
    postsRef.set(zero);
  } else {
    currentData = zero;
    renderAll(currentData);
    updateAllCalculations(currentData);
  }
  showToast('🔄 Todos os posts foram zerados com sucesso!');
}

// ============================================================
// Renderização — atualiza o DOM a partir dos dados do Firebase
// ============================================================

function renderAll(data) {
  for (let id = 1; id <= 5; id++) {
    const post = (data && data[id]) || { likes: 0, shares: 0, comments: {} };
    renderPostStats(id, post);
    renderCommentsList(id, post.comments || {});
  }
}

function renderPostStats(postId, post) {
  const likes    = post.likes   || 0;
  const shares   = post.shares  || 0;
  const comments = post.comments || {};

  let totalComments = 0;
  let totalReplies  = 0;
  Object.values(comments).forEach(c => {
    totalComments++;
    totalReplies += Object.keys(c.replies || {}).length;
  });
  const totalCount = totalComments + totalReplies;

  const sLikes    = document.getElementById(`statLikes-${postId}`);
  const sComments = document.getElementById(`statComments-${postId}`);
  const sShares   = document.getElementById(`statShares-${postId}`);

  if (sLikes)    sLikes.innerHTML    = `❤️ <strong>${likes}</strong> ${likes === 1 ? 'curtida' : 'curtidas'}`;
  if (sComments) sComments.innerHTML = `💬 <strong>${totalCount}</strong> ${totalCount === 1 ? 'comentário' : 'comentários'}`;
  if (sShares)   sShares.innerHTML   = `🚀 <strong>${shares}</strong> ${shares === 1 ? 'compartilhamento' : 'compartilhamentos'}`;

  const btnLike = document.getElementById(`btnLike-${postId}`);
  if (btnLike) {
    btnLike.classList.toggle('liked', likes > 0);
    btnLike.querySelector('.btn-icon').innerText = likes > 0 ? '❤️' : '🤍';
    btnLike.querySelector('.btn-label').innerText = likes > 0 ? `Curtido (${likes})` : 'Curtir';
  }

  const btnShare = document.getElementById(`btnShare-${postId}`);
  if (btnShare) {
    btnShare.classList.toggle('shared', shares > 0);
  }
}

function renderCommentsList(postId, comments) {
  const container = document.getElementById(`commentsArea-${postId}`);
  if (!container) return;

  // Preserva reply boxes que estavam abertos
  const openBoxes = new Set();
  container.querySelectorAll('.reply-input-row').forEach(row => {
    if (row.style.display !== 'none' && row.id) openBoxes.add(row.id);
  });

  container.innerHTML = '';

  Object.entries(comments).forEach(([commentId, c]) => {
    const replies      = c.replies || {};
    const replyEntries = Object.entries(replies);
    const replyRowId   = `replyRow-${postId}-${commentId}`;
    const wasOpen      = openBoxes.has(replyRowId);

    let repliesHtml = '';
    if (replyEntries.length > 0) {
      repliesHtml = `<div class="replies-thread">` +
        replyEntries.map(([, r]) =>
          `<div class="reply-item"><strong>${escapeHtml(r.author)}:</strong> ${escapeHtml(r.text)}</div>`
        ).join('') +
        `</div>`;
    }

    const likesCount = c.likes || 0;
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.innerHTML = `
      <div class="c-header">
        <span class="c-user">${escapeHtml(c.author)}</span>
      </div>
      <div class="c-body-text">${escapeHtml(c.text)}</div>
      <div class="c-actions-row">
        <button class="c-like-btn${likesCount > 0 ? ' liked' : ''}"
                onclick="likeComment(${postId}, '${commentId}')">
          ❤️ ${likesCount} ${likesCount === 1 ? 'curtida' : 'curtidas'}
        </button>
        <button class="c-reply-btn" onclick="toggleReplyBox(${postId}, '${commentId}')">
          Responder
        </button>
      </div>
      ${repliesHtml}
      <div class="reply-input-row" id="${replyRowId}" style="display:${wasOpen ? 'flex' : 'none'};">
        <input type="text" placeholder="Escreva sua resposta..."
               id="replyInput-${postId}-${commentId}"
               onkeypress="if(event.key==='Enter') submitReply(${postId}, '${commentId}')">
        <button onclick="submitReply(${postId}, '${commentId}')">Enviar</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// ============================================================
// Cálculo de estatísticas
// ============================================================

function updateAllCalculations(data) {
  data = data || currentData;

  let totalInteractionsCount = 0;
  let maxReach = 0;

  for (let id = 1; id <= 5; id++) {
    const post     = (data && data[id]) || { likes: 0, shares: 0, comments: {} };
    const likes    = post.likes  || 0;
    const shares   = post.shares || 0;
    const comments = post.comments || {};

    let commentsCount    = 0;
    let repliesCount     = 0;
    let commentLikesCount = 0;

    Object.values(comments).forEach(c => {
      commentsCount++;
      commentLikesCount += c.likes || 0;
      repliesCount      += Object.keys(c.replies || {}).length;
    });

    totalInteractionsCount += likes + commentsCount + repliesCount + commentLikesCount + shares;

    const score =
      (likes           * WEIGHTS.LIKE)          +
      (commentsCount   * WEIGHTS.COMMENT)        +
      (repliesCount    * WEIGHTS.REPLY)          +
      (commentLikesCount * WEIGHTS.COMMENT_LIKE) +
      (shares          * WEIGHTS.SHARE);

    let reach = 0;
    if (score > 0) {
      reach = Math.min(TOTAL_FICTITIOUS_USERS,
        Math.round(15 + score * POST_META[id].reachFactor));
    }
    if (reach > maxReach) maxReach = reach;

    const totalCommentCount = commentsCount + repliesCount;
    const metaEl  = document.getElementById(`statMeta-${id}`);
    const ptsEl   = document.getElementById(`statPoints-${id}`);
    const reachEl = document.getElementById(`statReach-${id}`);
    const barEl   = document.getElementById(`statBar-${id}`);

    if (metaEl)  metaEl.innerText   = `${likes} curtidas • ${totalCommentCount} comentários/respostas • ${shares} compartilhamentos`;
    if (ptsEl)   ptsEl.innerText    = `${score} pts`;
    if (reachEl) reachEl.innerText  = `${reach.toLocaleString('pt-BR')} pessoas`;
    if (barEl) {
      const pct = ((reach / TOTAL_FICTITIOUS_USERS) * 100).toFixed(1);
      barEl.style.width = `${Math.min(100, pct)}%`;
    }
  }

  const navInteractions = document.getElementById('navFeedInteractions');
  const sideReachVal    = document.getElementById('sidebarReachValue');
  const sideReachBar    = document.getElementById('sidebarReachBar');

  if (navInteractions) navInteractions.innerText = `${totalInteractionsCount} ${totalInteractionsCount === 1 ? 'ação' : 'ações'}`;
  if (sideReachVal)    sideReachVal.innerText    = maxReach.toLocaleString('pt-BR');
  if (sideReachBar) {
    const pct = ((maxReach / TOTAL_FICTITIOUS_USERS) * 100).toFixed(0);
    sideReachBar.style.width = `${Math.min(100, pct)}%`;
  }
}

// ============================================================
// Navegação entre abas
// ============================================================
function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p  => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b  => b.classList.remove('active'));
  document.querySelectorAll('.m-btn').forEach(b     => b.classList.remove('active'));

  const sections = { oficina: 'sectionOficina', feed: 'sectionFeed', stats: 'sectionStats' };
  const navBtns  = { oficina: 'navOficinaBtn',  feed: 'navFeedBtn',   stats: 'navStatsBtn'   };
  const mIndex   = { oficina: 0, feed: 1, stats: 2 };

  if (sections[tabId]) document.getElementById(sections[tabId]).classList.add('active');
  if (navBtns[tabId])  document.getElementById(navBtns[tabId]).classList.add('active');
  const mBtns = document.querySelectorAll('.m-btn');
  if (mBtns[mIndex[tabId]]) mBtns[mIndex[tabId]].classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// SVG Interativo
// ============================================================
function updateNodeHint(text) {
  const box = document.getElementById('nodeHintBox');
  if (box) box.innerHTML = `💡 <strong>Papel no Grafo:</strong> ${escapeHtml(text)}`;
}

// ============================================================
// Toast
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
