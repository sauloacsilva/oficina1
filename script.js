/**
 * RedeLab: Lógica do Feed e Algoritmo
 * Todos os posts iniciam ZERADOS.
 * As estatísticas e alcance de usuários fictícios são construídos pelas ações do usuário.
 */

// Universo simulado de estudantes fictícios
const TOTAL_FICTITIOUS_USERS = 10000;

// Pesos definidos para a oficina
const WEIGHTS = {
  LIKE: 2,         // +2 pts
  COMMENT: 8,      // +8 pts
  REPLY: 12,       // +12 pts
  COMMENT_LIKE: 1, // +1 pt
  SHARE: 20        // +20 pts
};

// Estado inicial dos 5 posts intercalados - TOTALMENTE ZERADOS
const posts = {
  1: {
    id: 1,
    title: "Post 1: Gincana Cultural",
    author: "Lucas Gabriel (9º B)",
    likes: 0,
    userLiked: false,
    shares: 0,
    userShared: false,
    comments: [],
    reachFactor: 8.0 // Post amigável
  },
  2: {
    id: 2,
    title: "Post 2: Ataque às Garotas nos Esportes (Misoginia)",
    author: "Thiago Alves (9º A)",
    likes: 0,
    userLiked: false,
    shares: 0,
    userShared: false,
    comments: [],
    reachFactor: 15.5 // Conteúdo misógino gera discussão intensa e viraliza rápido
  },
  3: {
    id: 3,
    title: "Post 3: Maquete de Ciências",
    author: "Marina Pereira (8º A)",
    likes: 0,
    userLiked: false,
    shares: 0,
    userShared: false,
    comments: [],
    reachFactor: 8.5 // Post amigável
  },
  4: {
    id: 4,
    title: "Post 4: Preconceito contra Bolsistas (Discurso de Ódio)",
    author: "Gabriel Fonseca (9º C)",
    likes: 0,
    userLiked: false,
    shares: 0,
    userShared: false,
    comments: [],
    reachFactor: 16.0 // Discurso de ódio polariza a rede e fura bolhas velozmente
  },
  5: {
    id: 5,
    title: "Post 5: Provocação Manhã vs. Tarde",
    author: "Enzo Santos (9º A)",
    likes: 0,
    userLiked: false,
    shares: 0,
    userShared: false,
    comments: [],
    reachFactor: 13.0 // Provocação clássica de turnos
  }
};

let commentIdCounter = 1;

document.addEventListener("DOMContentLoaded", () => {
  updateAllCalculations();
});

/**
 * Alterna entre abas
 */
function switchTab(tabId) {
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".m-btn").forEach(b => b.classList.remove("active"));

  if (tabId === "oficina") {
    document.getElementById("sectionOficina").classList.add("active");
    document.getElementById("navOficinaBtn").classList.add("active");
    const mBtns = document.querySelectorAll(".m-btn");
    if (mBtns[0]) mBtns[0].classList.add("active");
  } else if (tabId === "feed") {
    document.getElementById("sectionFeed").classList.add("active");
    document.getElementById("navFeedBtn").classList.add("active");
    const mBtns = document.querySelectorAll(".m-btn");
    if (mBtns[1]) mBtns[1].classList.add("active");
  } else if (tabId === "stats") {
    document.getElementById("sectionStats").classList.add("active");
    document.getElementById("navStatsBtn").classList.add("active");
    const mBtns = document.querySelectorAll(".m-btn");
    if (mBtns[2]) mBtns[2].classList.add("active");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Curtir / Descurtir
 */
function toggleLike(postId) {
  const post = posts[postId];
  if (!post) return;

  post.userLiked = !post.userLiked;
  if (post.userLiked) {
    post.likes += 1;
    showToast(`❤️ Post curtido!`);
  } else {
    post.likes = Math.max(0, post.likes - 1);
    showToast(`🤍 Curtida removida.`);
  }

  renderPostButtonsAndStats(postId);
  updateAllCalculations();
}

/**
 * Compartilhar
 */
function sharePost(postId) {
  const post = posts[postId];
  if (!post) return;

  post.shares += 1;
  post.userShared = true;
  showToast(`🚀 Post compartilhado!`);

  renderPostButtonsAndStats(postId);
  updateAllCalculations();
}

/**
 * Adicionar comentário comum
 */
function submitComment(postId) {
  const input = document.getElementById(`commentInput-${postId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const post = posts[postId];
  const comment = {
    id: commentIdCounter++,
    author: "Você (Estudante)",
    text: text,
    likes: 0,
    userLiked: false,
    replies: []
  };

  post.comments.push(comment);
  input.value = "";

  renderCommentsList(postId);
  renderPostButtonsAndStats(postId);
  updateAllCalculations();

  showToast(`💬 Comentário enviado!`);
}

/**
 * Renderiza comentários do post
 */
function renderCommentsList(postId) {
  const container = document.getElementById(`commentsArea-${postId}`);
  if (!container) return;
  container.innerHTML = "";

  posts[postId].comments.forEach(c => {
    const card = document.createElement("div");
    card.className = "comment-card";
    card.id = `cCard-${postId}-${c.id}`;

    let repliesHtml = "";
    if (c.replies && c.replies.length > 0) {
      repliesHtml = `<div class="replies-thread">` + 
        c.replies.map(r => `<div class="reply-item"><strong>${escapeHtml(r.author)}:</strong> ${escapeHtml(r.text)}</div>`).join("") +
        `</div>`;
    }

    card.innerHTML = `
      <div class="c-header">
        <span class="c-user">${escapeHtml(c.author)}</span>
      </div>
      <div class="c-body-text">${escapeHtml(c.text)}</div>
      <div class="c-actions-row">
        <button class="c-like-btn ${c.userLiked ? 'liked' : ''}" onclick="likeComment(${postId}, ${c.id})">
          ❤️ ${c.likes} ${c.likes === 1 ? 'curtida' : 'curtidas'}
        </button>
        <button class="c-reply-btn" onclick="toggleReplyBox(${postId}, ${c.id})">
          Responder
        </button>
      </div>
      ${repliesHtml}
      <div class="reply-input-row" id="replyRow-${postId}-${c.id}" style="display: none;">
        <input type="text" placeholder="Escreva sua resposta..." id="replyInput-${postId}-${c.id}" onkeypress="if(event.key==='Enter') submitReply(${postId}, ${c.id})">
        <button onclick="submitReply(${postId}, ${c.id})">Enviar</button>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * Curtir comentário
 */
function likeComment(postId, commentId) {
  const post = posts[postId];
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;

  comment.userLiked = !comment.userLiked;
  if (comment.userLiked) {
    comment.likes += 1;
    showToast(`❤️ Curtida no comentário!`);
  } else {
    comment.likes = Math.max(0, comment.likes - 1);
  }

  renderCommentsList(postId);
  updateAllCalculations();
}

/**
 * Abrir caixa de resposta
 */
function toggleReplyBox(postId, commentId) {
  const row = document.getElementById(`replyRow-${postId}-${commentId}`);
  if (!row) return;
  row.style.display = row.style.display === "none" ? "flex" : "none";
  if (row.style.display === "flex") {
    const input = document.getElementById(`replyInput-${postId}-${commentId}`);
    if (input) input.focus();
  }
}

/**
 * Enviar resposta ao comentário
 */
function submitReply(postId, commentId) {
  const input = document.getElementById(`replyInput-${postId}-${commentId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const post = posts[postId];
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;

  comment.replies.push({
    author: "Você",
    text: text
  });

  renderCommentsList(postId);
  renderPostButtonsAndStats(postId);
  updateAllCalculations();

  showToast(`🔁 Resposta enviada!`);
}

/**
 * Atualiza números nos botões e faixas do feed
 */
function renderPostButtonsAndStats(postId) {
  const post = posts[postId];
  if (!post) return;

  // Botão curtir
  const btnLike = document.getElementById(`btnLike-${postId}`);
  if (btnLike) {
    btnLike.classList.toggle("liked", post.userLiked);
    btnLike.querySelector(".btn-icon").innerText = post.userLiked ? "❤️" : "🤍";
    btnLike.querySelector(".btn-label").innerText = post.userLiked ? "Curtido" : "Curtir";
  }

  // Botão compartilhar
  const btnShare = document.getElementById(`btnShare-${postId}`);
  if (btnShare) {
    btnShare.classList.toggle("shared", post.userShared);
  }

  // Contagem de comentários (comentários + respostas)
  let totalComments = post.comments.length;
  post.comments.forEach(c => {
    if (c.replies) totalComments += c.replies.length;
  });

  // Faixa de estatísticas
  const sLikes = document.getElementById(`statLikes-${postId}`);
  const sComments = document.getElementById(`statComments-${postId}`);
  const sShares = document.getElementById(`statShares-${postId}`);

  if (sLikes) sLikes.innerHTML = `❤️ <strong>${post.likes}</strong> ${post.likes === 1 ? 'curtida' : 'curtidas'}`;
  if (sComments) sComments.innerHTML = `💬 <strong>${totalComments}</strong> ${totalComments === 1 ? 'comentário' : 'comentários'}`;
  if (sShares) sShares.innerHTML = `🚀 <strong>${post.shares}</strong> ${post.shares === 1 ? 'compartilhamento' : 'compartilhamentos'}`;
}

/**
 * Calcula a pontuação e o alcance de cada post
 */
function updateAllCalculations() {
  let totalInteractionsCount = 0;
  let totalGlobalScore = 0;
  let maxReach = 0;

  for (let id = 1; id <= 5; id++) {
    const post = posts[id];
    let repliesCount = 0;
    let commentLikesCount = 0;

    post.comments.forEach(c => {
      commentLikesCount += c.likes;
      if (c.replies) repliesCount += c.replies.length;
    });

    const totalCommentsAndReplies = post.comments.length + repliesCount;
    const actionsOnThisPost = post.likes + totalCommentsAndReplies + commentLikesCount + post.shares;
    totalInteractionsCount += actionsOnThisPost;

    // Fórmula exata
    const score = 
      (post.likes * WEIGHTS.LIKE) +
      (post.comments.length * WEIGHTS.COMMENT) +
      (repliesCount * WEIGHTS.REPLY) +
      (commentLikesCount * WEIGHTS.COMMENT_LIKE) +
      (post.shares * WEIGHTS.SHARE);

    totalGlobalScore += score;

    // Se o post tiver 0 ações, seu alcance é 0
    let reach = 0;
    if (score > 0) {
      // Começa com base de 15 pessoas e escala
      reach = Math.min(TOTAL_FICTITIOUS_USERS, Math.round(15 + (score * post.reachFactor)));
    }

    if (reach > maxReach) {
      maxReach = reach;
    }

    // Atualiza linha de estatísticas
    const metaEl = document.getElementById(`statMeta-${id}`);
    const ptsEl = document.getElementById(`statPoints-${id}`);
    const reachEl = document.getElementById(`statReach-${id}`);
    const barEl = document.getElementById(`statBar-${id}`);

    if (metaEl) {
      metaEl.innerText = `${post.likes} curtidas • ${totalCommentsAndReplies} comentários/respostas • ${post.shares} compartilhamentos`;
    }
    if (ptsEl) ptsEl.innerText = `${score} pts`;
    if (reachEl) reachEl.innerText = `${reach.toLocaleString("pt-BR")} pessoas`;
    if (barEl) {
      const pct = ((reach / TOTAL_FICTITIOUS_USERS) * 100).toFixed(1);
      barEl.style.width = `${Math.min(100, pct)}%`;
    }
  }

  // Atualiza indicadores na barra lateral
  const navInteractions = document.getElementById("navFeedInteractions");
  const navScore = document.getElementById("navStatsScore");
  const sideReachVal = document.getElementById("sidebarReachValue");
  const sideReachBar = document.getElementById("sidebarReachBar");

  if (navInteractions) navInteractions.innerText = `${totalInteractionsCount} ${totalInteractionsCount === 1 ? 'ação' : 'ações'}`;
  if (navScore) navScore.innerText = `${totalGlobalScore} pts`;
  if (sideReachVal) sideReachVal.innerText = maxReach.toLocaleString("pt-BR");
  if (sideReachBar) {
    const totalPct = ((maxReach / TOTAL_FICTITIOUS_USERS) * 100).toFixed(0);
    sideReachBar.style.width = `${Math.min(100, totalPct)}%`;
  }
}

/**
 * Reseta todos os dados para zero
 */
function resetAllFeed() {
  for (let id = 1; id <= 5; id++) {
    posts[id].likes = 0;
    posts[id].userLiked = false;
    posts[id].shares = 0;
    posts[id].userShared = false;
    posts[id].comments = [];
    renderCommentsList(id);
    renderPostButtonsAndStats(id);
  }

  updateAllCalculations();
  showToast("🔄 Todos os posts foram zerados com sucesso!");
}

/**
 * Dica nos nós do SVG
 */
function updateNodeHint(text) {
  const box = document.getElementById("nodeHintBox");
  if (box) {
    box.innerHTML = `💡 <strong>Papel no Grafo:</strong> ${escapeHtml(text)}`;
  }
}

/**
 * Toast
 */
let toastTimeout = null;
function showToast(text) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;

  toast.innerText = text;
  toast.classList.remove("hidden");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2800);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
