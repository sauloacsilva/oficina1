/**
 * RedeLab — Sistema de Feed, Algoritmo & Preservação Resiliente de Dados
 *
 * 🛡️ ARQUITETURA DE DADOS RESILIENTE (DUAL ENGINE):
 * 1. MODO LOCAL (LocalStorage + BroadcastChannel) [Padrão]:
 *    - Salva imediatamente cada curtida, comentário, resposta e compartilhamento no navegador.
 *    - Funciona 100% offline ou online, sem precisar de cadastro, chaves ou servidor.
 *    - Sincroniza abas e janelas abertas simultaneamente no mesmo navegador em tempo real.
 *    - Não tem limites de cotas nem risco de queda de serviços de terceiros (fim dos erros do JSONBin).
 *
 * 2. MODO NUVEM EM TEMPO REAL (Firebase Realtime Database) [Opcional para Salas de Aula]:
 *    - Se o professor desejar sincronizar 20-30 celulares de alunos no telão ao vivo:
 *    - Conexão via WebSockets (Push instantâneo sem polling repetitivo a cada 3s).
 *    - 100 conexões simultâneas no plano gratuito do Google.
 *    - Configurável diretamente via modal na interface ("⚙️ Nuvem") ou no objeto abaixo.
 *    - Fail-safe: se a nuvem cair ou faltar internet, o app opera no LocalStorage sem interrupções.
 */

// ============================================================
// ⚙️ CONFIGURAÇÃO OPCIONAL DO FIREBASE (NUVEM EM TEMPO REAL)
// Deixe vazio para usar o modo LocalStorage automático (100% funcional).
// ============================================================
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// ============================================================
// Constantes Matemáticas da Oficina
// ============================================================
const TOTAL_FICTITIOUS_USERS = 10000;

const WEIGHTS = {
  LIKE: 2,         // +2 pts: Ação rápida
  COMMENT: 8,      // +8 pts: Esforço de digitação
  REPLY: 12,       // +12 pts: Discussão / Debate contínuo
  COMMENT_LIKE: 1, // +1 pt: Reação ao comentário
  SHARE: 20        // +20 pts: Fura bolhas e viraliza
};

const POST_META = {
  1: { reachFactor: 8.0 },  // Gincana da Escola (Amigável)
  2: { reachFactor: 15.5 }, // Misoginia nos Esportes (Controverso/Tóxico)
  3: { reachFactor: 8.5 },  // Maquete de Ciências (Amigável)
  4: { reachFactor: 16.0 }, // Preconceito contra Bolsistas/Novatos (Discurso de Ódio)
  5: { reachFactor: 13.0 }  // Disputa de Turnos Manhã vs. Tarde (Provocação)
};

// Chaves de armazenamento local
const STORAGE_KEY = 'redelab_oficina_feed_v2';
const PROFILE_KEY = 'redelab_student_profile_v2';
const CLOUD_CONFIG_KEY = 'redelab_firebase_config_v2';

// ============================================================
// Estado Inicial & Estrutura de Dados
// ============================================================
function getZeroState() {
  return {
    posts: {
      1: { likes: 0, shares: 0, comments: [] },
      2: { likes: 0, shares: 0, comments: [] },
      3: { likes: 0, shares: 0, comments: [] },
      4: { likes: 0, shares: 0, comments: [] },
      5: { likes: 0, shares: 0, comments: [] }
    }
  };
}

function ensureValidState(data) {
  if (!data || typeof data !== 'object') return getZeroState();
  const valid = { posts: {} };
  for (let i = 1; i <= 5; i++) {
    const rawPost = (data.posts && data.posts[i]) || (data[i]) || {};
    let comments = [];
    if (Array.isArray(rawPost.comments)) {
      comments = rawPost.comments;
    } else if (rawPost.comments && typeof rawPost.comments === 'object') {
      comments = Object.values(rawPost.comments);
    }

    // Normaliza comentários e respostas
    comments = comments.map(c => ({
      id: c.id || ('c_' + Math.random().toString(36).substr(2, 9)),
      author: c.author || 'Aluno Participante',
      text: c.text || '',
      likes: Number(c.likes) || 0,
      replies: Array.isArray(c.replies)
        ? c.replies
        : (c.replies && typeof c.replies === 'object' ? Object.values(c.replies) : [])
    }));

    valid.posts[i] = {
      likes: Number(rawPost.likes) || 0,
      shares: Number(rawPost.shares) || 0,
      comments
    };
  }
  return valid;
}

// Estado em memória
let localState = getZeroState();

// Gerenciamento de nuvem
let isCloudActive = false;
let cloudDbRef = null;

// ============================================================
// Canal de Comunicação Entre Abas (BroadcastChannel)
// ============================================================
let broadcastChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('redelab_sync_channel');
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'SYNC_STATE') {
        localState = ensureValidState(event.data.state);
        renderAll(localState);
        updateAllCalculations(localState);
      }
    };
  }
} catch (e) {
  console.warn('BroadcastChannel não disponível:', e);
}

// Sincronização via evento 'storage' nativo (fallback de abas em navegadores)
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY && event.newValue) {
    try {
      const parsed = JSON.parse(event.newValue);
      localState = ensureValidState(parsed);
      renderAll(localState);
      updateAllCalculations(localState);
    } catch (e) {
      console.warn('Erro ao processar storage event:', e);
    }
  }
});

// ============================================================
// Persistência: Leitura & Gravação
// ============================================================

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return ensureValidState(parsed);
    }
  } catch (e) {
    console.warn('Erro ao carregar dados do LocalStorage:', e);
  }
  return getZeroState();
}

function persistState(newState, broadcast = true) {
  localState = newState;

  // 1. Salva no LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  } catch (e) {
    console.warn('Erro ao gravar no LocalStorage:', e);
  }

  // 2. Notifica outras abas no mesmo navegador
  if (broadcast && broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'SYNC_STATE', state: newState });
    } catch (e) {}
  }

  // 3. Sincroniza na Nuvem (Firebase), se ativa
  if (isCloudActive && cloudDbRef) {
    try {
      cloudDbRef.set(newState.posts).catch(err => {
        console.warn('Erro ao gravar no Firebase:', err);
      });
    } catch (e) {
      console.warn('Exceção ao gravar no Firebase:', e);
    }
  }
}

// ============================================================
// Inicialização do Aplicativo
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Carrega dados locais imediatamente (garantia de funcionamento instantâneo)
  localState = loadInitialState();
  renderAll(localState);
  updateAllCalculations(localState);
  renderUserProfile();

  // 2. Atualiza badge de status de armazenamento
  updateStorageBadge();

  // 3. Tenta conectar ao Firebase se houver configuração salva ou padrão
  initCloudIfAvailable();
});

// ============================================================
// Ações do Usuário no Feed
// ============================================================

function toggleLike(postId) {
  localState.posts[postId].likes = (localState.posts[postId].likes || 0) + 1;
  persistState(localState);
  renderAll(localState);
  updateAllCalculations(localState);
  showToast('❤️ Post curtido! Pontuação atualizada.');
}

function sharePost(postId) {
  localState.posts[postId].shares = (localState.posts[postId].shares || 0) + 1;
  persistState(localState);
  renderAll(localState);
  updateAllCalculations(localState);
  showToast('🚀 Post compartilhado! Alcance expandido.');
}

function submitComment(postId) {
  const input = document.getElementById(`commentInput-${postId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    showToast('⚠️ Digite algo antes de comentar!');
    return;
  }

  const profile = getStudentProfile();
  const newComment = {
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    author: profile.name,
    text,
    likes: 0,
    replies: []
  };

  if (!Array.isArray(localState.posts[postId].comments)) {
    localState.posts[postId].comments = [];
  }
  localState.posts[postId].comments.push(newComment);

  input.value = '';
  persistState(localState);
  renderAll(localState);
  updateAllCalculations(localState);
  showToast('💬 Comentário publicado!');
}

function likeComment(postId, commentId) {
  const comment = (localState.posts[postId].comments || []).find(c => String(c.id) === String(commentId));
  if (comment) {
    comment.likes = (comment.likes || 0) + 1;
    persistState(localState);
    renderAll(localState);
    updateAllCalculations(localState);
    showToast('❤️ Curtida no comentário!');
  }
}

function submitReply(postId, commentId) {
  const input = document.getElementById(`replyInput-${postId}-${commentId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    showToast('⚠️ Digite uma resposta!');
    return;
  }

  const profile = getStudentProfile();
  const comment = (localState.posts[postId].comments || []).find(c => String(c.id) === String(commentId));
  if (comment) {
    if (!Array.isArray(comment.replies)) comment.replies = [];
    comment.replies.push({
      id: 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      author: profile.name,
      text
    });
  }

  const row = document.getElementById(`replyRow-${postId}-${commentId}`);
  if (row) row.style.display = 'none';
  input.value = '';

  persistState(localState);
  renderAll(localState);
  updateAllCalculations(localState);
  showToast('🔁 Resposta enviada à conversa!');
}

function toggleReplyBox(postId, commentId) {
  const row = document.getElementById(`replyRow-${postId}-${commentId}`);
  if (!row) return;
  const isOpen = row.style.display === 'flex';
  row.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) {
    const input = document.getElementById(`replyInput-${postId}-${commentId}`);
    if (input) input.focus();
  }
}

// Reset do feed
function resetAllFeed() {
  const zero = getZeroState();
  persistState(zero);
  renderAll(zero);
  updateAllCalculations(zero);
  showToast('🔄 Todos os posts foram zerados com sucesso!');
}

function confirmResetAllFeed() {
  const msg = 'Tem certeza de que deseja zerar todas as curtidas, comentários e compartilhamentos? Esta ação reinicia a oficina.';
  if (window.confirm(msg)) {
    resetAllFeed();
  }
}

// ============================================================
// Renderização da Interface
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

  let totalCommentsAndReplies = 0;
  comments.forEach(c => {
    totalCommentsAndReplies++;
    totalCommentsAndReplies += (c.replies || []).length;
  });

  const sLikes = document.getElementById(`statLikes-${postId}`);
  const sComments = document.getElementById(`statComments-${postId}`);
  const sShares = document.getElementById(`statShares-${postId}`);

  if (sLikes) sLikes.innerHTML = `❤️ <strong>${likes}</strong> ${likes === 1 ? 'curtida' : 'curtidas'}`;
  if (sComments) sComments.innerHTML = `💬 <strong>${totalCommentsAndReplies}</strong> ${totalCommentsAndReplies === 1 ? 'comentário' : 'comentários'}`;
  if (sShares) sShares.innerHTML = `🚀 <strong>${shares}</strong> ${shares === 1 ? 'compartilhamento' : 'compartilhamentos'}`;

  const btnLike = document.getElementById(`btnLike-${postId}`);
  if (btnLike) {
    btnLike.classList.toggle('liked', likes > 0);
    const icon = btnLike.querySelector('.btn-icon');
    const label = btnLike.querySelector('.btn-label');
    if (icon) icon.innerText = likes > 0 ? '❤️' : '🤍';
    if (label) label.innerText = likes > 0 ? `Curtido (${likes})` : 'Curtir';
  }

  const btnShare = document.getElementById(`btnShare-${postId}`);
  if (btnShare) {
    btnShare.classList.toggle('shared', shares > 0);
    const label = btnShare.querySelector('.btn-label');
    if (label) label.innerText = shares > 0 ? `Compartilhado (${shares})` : 'Compartilhar';
  }
}

function renderCommentsList(postId, comments) {
  const container = document.getElementById(`commentsArea-${postId}`);
  if (!container) return;

  // Preserva reply boxes que estavam abertos antes de re-renderizar
  const openBoxes = new Set();
  container.querySelectorAll('.reply-input-row').forEach(row => {
    if (row.style.display !== 'none' && row.id) openBoxes.add(row.id);
  });

  container.innerHTML = '';

  (comments || []).forEach(c => {
    const replies = Array.isArray(c.replies) ? c.replies : [];
    const replyRowId = `replyRow-${postId}-${c.id}`;
    const wasOpen = openBoxes.has(replyRowId);

    let repliesHtml = '';
    if (replies.length > 0) {
      repliesHtml = `<div class="replies-thread">` +
        replies.map(r =>
          `<div class="reply-item"><strong>${escapeHtml(r.author || 'Aluno')}:</strong> ${escapeHtml(r.text || '')}</div>`
        ).join('') +
        `</div>`;
    }

    const cLikes = c.likes || 0;
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.innerHTML = `
      <div class="c-header">
        <span class="c-user">${escapeHtml(c.author || 'Aluno')}</span>
      </div>
      <div class="c-body-text">${escapeHtml(c.text || '')}</div>
      <div class="c-actions-row">
        <button class="c-like-btn${cLikes > 0 ? ' liked' : ''}"
                onclick="likeComment(${postId}, '${escapeHtml(String(c.id))}')">
          ❤️ ${cLikes} ${cLikes === 1 ? 'curtida' : 'curtidas'}
        </button>
        <button class="c-reply-btn" onclick="toggleReplyBox(${postId}, '${escapeHtml(String(c.id))}')">
          Responder
        </button>
      </div>
      ${repliesHtml}
      <div class="reply-input-row" id="${replyRowId}" style="display:${wasOpen ? 'flex' : 'none'};">
        <input type="text" placeholder="Escreva sua resposta..."
               id="replyInput-${postId}-${escapeHtml(String(c.id))}"
               onkeypress="if(event.key==='Enter') submitReply(${postId}, '${escapeHtml(String(c.id))}')">
        <button onclick="submitReply(${postId}, '${escapeHtml(String(c.id))}')">Enviar</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// ============================================================
// Cálculos Matemáticos do Algoritmo
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
// Perfil do Aluno (Personalização na Barra Lateral)
// ============================================================

function getStudentProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { name: 'Aluno Participante', grade: '8º / 9º Ano' };
}

function updateStudentProfile(name, grade) {
  const profile = {
    name: (name || 'Aluno Participante').trim(),
    grade: (grade || '8º / 9º Ano').trim()
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  renderUserProfile();
  showToast('👤 Nome atualizado com sucesso!');
}

function renderUserProfile() {
  const p = getStudentProfile();
  const nameEl = document.getElementById('sidebarUserName');
  const infoEl = document.getElementById('sidebarUserInfo');
  const avEl = document.getElementById('sidebarAvatarCircle');

  if (nameEl) nameEl.innerText = p.name;
  if (infoEl) infoEl.innerText = p.grade;
  if (avEl) {
    const parts = p.name.split(' ').filter(Boolean);
    let initials = 'AL';
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
      initials = parts[0].substring(0, 2).toUpperCase();
    }
    avEl.innerText = initials;
  }
}

function editStudentProfile() {
  const current = getStudentProfile();
  const newName = window.prompt('Digite seu nome para assinar seus comentários:', current.name);
  if (newName !== null && newName.trim() !== '') {
    const newGrade = window.prompt('Digite sua turma (ex: 8º A, 9º B):', current.grade);
    updateStudentProfile(newName, newGrade !== null ? newGrade : current.grade);
  }
}

// ============================================================
// Backup e Portabilidade: Exportar & Importar JSON
// ============================================================

function exportDataJson() {
  try {
    const payload = {
      project: 'RedeLab - Oficina de Matemática',
      exportedAt: new Date().toISOString(),
      state: localState
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const dateFormatted = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute('download', `redelab-dados-oficina-${dateFormatted}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('📥 Dados da oficina exportados com sucesso!');
  } catch (e) {
    showToast('❌ Erro ao exportar dados.');
  }
}

function triggerImportJson() {
  const input = document.getElementById('importFileInput');
  if (input) input.click();
}

function handleFileImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const importedState = parsed.state || parsed;
      if (importedState && (importedState.posts || importedState[1])) {
        localState = ensureValidState(importedState);
        persistState(localState);
        renderAll(localState);
        updateAllCalculations(localState);
        showToast('📤 Dados importados e restaurados com sucesso!');
      } else {
        window.alert('O arquivo selecionado não contém a estrutura esperada de postagens do RedeLab.');
      }
    } catch (err) {
      window.alert('Erro ao processar arquivo JSON: ' + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ============================================================
// Sincronização em Nuvem (Firebase Realtime Database Opcional)
// ============================================================

function getSavedCloudConfig() {
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_FIREBASE_CONFIG;
}

function initCloudIfAvailable() {
  const config = getSavedCloudConfig();
  const hasValidConfig = config && config.apiKey && config.databaseURL;

  if (!hasValidConfig) {
    isCloudActive = false;
    updateStorageBadge();
    return;
  }

  // Verifica se o SDK do Firebase foi carregado
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK não carregado no navegador.');
    isCloudActive = false;
    updateStorageBadge();
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    const db = firebase.database();
    cloudDbRef = db.ref('redelab/posts');

    // Escuta atualizações da nuvem em tempo real (WebSockets Push)
    cloudDbRef.on('value', (snapshot) => {
      const val = snapshot.val();
      if (val) {
        localState = ensureValidState({ posts: val });
        // Grava no LocalStorage local sem reenviar para a nuvem
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(localState));
        } catch (e) {}
        renderAll(localState);
        updateAllCalculations(localState);
      } else {
        // Se nó estiver vazio, envia estado atual
        cloudDbRef.set(localState.posts);
      }
    }, (error) => {
      console.warn('Erro na conexão do Firebase:', error);
      isCloudActive = false;
      updateStorageBadge();
    });

    isCloudActive = true;
    updateStorageBadge();
    console.log('Firebase conectado com sucesso.');
  } catch (e) {
    console.warn('Falha ao inicializar Firebase:', e);
    isCloudActive = false;
    updateStorageBadge();
  }
}

function updateStorageBadge() {
  const badge = document.getElementById('storageStatusBadge');
  const textEl = document.getElementById('storageStatusText');
  const modalDot = document.getElementById('modalStatusDot');
  const modalTitle = document.getElementById('modalStatusTitle');
  const modalDesc = document.getElementById('modalStatusDesc');

  if (isCloudActive) {
    if (badge) {
      badge.classList.add('cloud');
      badge.title = 'Sincronizado ao vivo via Firebase com todos os dispositivos';
    }
    if (textEl) textEl.innerText = '☁️ Conectado ao Vivo (Nuvem)';
    if (modalDot) modalDot.style.background = '#3b82f6';
    if (modalTitle) modalTitle.innerText = 'Modo Nuvem Conectado (Firebase Realtime)';
    if (modalDesc) modalDesc.innerText = 'Todas as ações são sincronizadas em tempo real com todos os celulares e projetor da sala.';
  } else {
    if (badge) {
      badge.classList.remove('cloud');
      badge.title = 'Dados preservados com segurança no navegador do dispositivo';
    }
    if (textEl) textEl.innerText = '💾 Salvo no Navegador';
    if (modalDot) modalDot.style.background = '#10b981';
    if (modalTitle) modalTitle.innerText = 'Modo Local Ativo (100% Funcional)';
    if (modalDesc) modalDesc.innerText = 'Os dados são preservados instantaneamente no armazenamento do seu navegador (LocalStorage) e sincronizados entre abas abertas.';
  }
}

function openCloudModal() {
  const modal = document.getElementById('cloudModal');
  if (!modal) return;
  const config = getSavedCloudConfig();
  const inputUrl = document.getElementById('cfgDbUrl');
  const inputKey = document.getElementById('cfgApiKey');
  const inputProj = document.getElementById('cfgProjectId');

  if (inputUrl && config.databaseURL) inputUrl.value = config.databaseURL;
  if (inputKey && config.apiKey) inputKey.value = config.apiKey;
  if (inputProj && config.projectId) inputProj.value = config.projectId;

  updateStorageBadge();
  modal.classList.remove('hidden');
}

function closeCloudModal() {
  const modal = document.getElementById('cloudModal');
  if (modal) modal.classList.add('hidden');
}

function saveCloudConfig() {
  const dbUrl = (document.getElementById('cfgDbUrl')?.value || '').trim();
  const apiKey = (document.getElementById('cfgApiKey')?.value || '').trim();
  const projectId = (document.getElementById('cfgProjectId')?.value || '').trim();

  if (!dbUrl || !apiKey) {
    window.alert('Por favor, informe pelo menos a Database URL e a API Key do seu projeto Firebase.');
    return;
  }

  const newConfig = {
    apiKey,
    databaseURL: dbUrl,
    projectId: projectId || 'redelab-oficina',
    authDomain: `${projectId || 'redelab-oficina'}.firebaseapp.com`
  };

  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(newConfig));
  initCloudIfAvailable();
  closeCloudModal();
  showToast('☁️ Configurações da nuvem salvas!');
}

function disableCloudConfig() {
  localStorage.removeItem(CLOUD_CONFIG_KEY);
  isCloudActive = false;
  cloudDbRef = null;
  updateStorageBadge();
  closeCloudModal();
  showToast('💾 Modo Local reativado.');
}

// ============================================================
// Navegação Entre Abas
// ============================================================

function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.m-btn').forEach(b => b.classList.remove('active'));

  const map = {
    oficina: ['sectionOficina', 'navOficinaBtn', 0],
    feed: ['sectionFeed', 'navFeedBtn', 1],
    stats: ['sectionStats', 'navStatsBtn', 2]
  };

  if (map[tabId]) {
    const sec = document.getElementById(map[tabId][0]);
    const nav = document.getElementById(map[tabId][1]);
    if (sec) sec.classList.add('active');
    if (nav) nav.classList.add('active');
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
// Toast e Utilitários
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
  if (typeof str !== 'string') str = String(str || '');
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
