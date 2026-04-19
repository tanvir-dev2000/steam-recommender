let GAMES_META = {}, RECS = {}, PLAY_HISTORY = {}, ITEM_SIM = {};
let ALL_GAME_NAMES = [], ALL_USER_IDS = [];
let selectedGames = new Set();
let activeGenre = null, browsePage = 0;
const BROWSE_PAGE_SIZE = 40, HISTORY_PAGE_SIZE = 15;
let currentPage = 'home';

/* ── PAGE ROUTING ── */
function goTo(page) {
  if (currentPage === page) return;
  const old = document.getElementById('page-' + currentPage);
  const next = document.getElementById('page-' + page);
  old.classList.remove('active');
  old.classList.add('exit');
  setTimeout(() => old.classList.remove('exit'), 320);
  next.classList.add('active');
  currentPage = page;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + page);
  if (navBtn) navBtn.classList.add('active');
  
}

/* ── DATA LOADING ── */
async function loadData() {
  try {
    const [mR, rR, hR, sR] = await Promise.all([
      fetch('docs/games_metadata.json'),
      fetch('docs/recommendations.json'),
      fetch('docs/play_history.json'),
      fetch('docs/item_sim.json')
    ]);
    GAMES_META = await mR.json();
    RECS = await rR.json();
    PLAY_HISTORY = await hR.json();
    ITEM_SIM = await sR.json();
    ALL_GAME_NAMES = Object.keys(GAMES_META);
    ALL_USER_IDS = Object.keys(RECS);
    initUI();
  } catch (e) {
    document.querySelector('.content-area').innerHTML = `
      <div style="padding:60px;text-align:center;color:#e05252;font-family:sans-serif;">
        <h2>Could not load data files</h2>
        <p style="margin-top:10px;color:#8b90a0;">Make sure all four JSON files are in the same folder as index.html.</p>
        <p style="margin-top:6px;color:#555a6e;font-size:13px;">${e.message}</p>
      </div>`;
  }
}

function initUI() {
  buildGenrePills();
  renderBrowseGrid();
  setupPickSearch();
  setupUserSearch();
  buildAnalytics();
  document.getElementById('pick-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('pick-dropdown').classList.remove('open');
  });
  document.getElementById('user-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') lookupUser();
  });
}

/* ── GENRE PILLS ── */
const HIDDEN_GENRES = new Set(['nudity', 'sexual content', 'adult content', 'nsfw', 'hentai', 'eroge']);
function buildGenrePills() {
  const genres = new Set();
  for (const v of Object.values(GAMES_META)) {
    const _vg = v.genres || v.g; if (_vg) _vg.split(',').forEach(g => { const t = g.trim(); if (t && !HIDDEN_GENRES.has(t.toLowerCase())) genres.add(t); });
  }
  const sorted = ['All', ...Array.from(genres).sort()];
  document.getElementById('genre-pills').innerHTML = sorted.map(g =>
    `<button class="genre-pill${g === 'All' ? ' active' : ''}" onclick="filterGenre('${g.replace(/'/g, "\\'")}')">${g}</button>`
  ).join('');
}

function filterGenre(genre) {
  activeGenre = genre === 'All' ? null : genre;
  browsePage = 0;
  document.querySelectorAll('.genre-pill').forEach(p => p.classList.toggle('active', p.textContent === genre));
  renderBrowseGrid();
}

/* ── BROWSE GRID ── */
function renderBrowseGrid() {
  let names = ALL_GAME_NAMES;
  if (activeGenre) {
    names = names.filter(n => {
      const m = GAMES_META[n];
      return m.genres && m.genres.split(',').map(x => x.trim()).includes(activeGenre);
    });
  }
  document.getElementById('browse-label').textContent = activeGenre
    ? `${activeGenre} games (${names.length})`
    : `Browse all games (${names.length})`;
  const grid = document.getElementById('browse-grid');
  grid.innerHTML = '';
  const slice = names.slice(0, (browsePage + 1) * BROWSE_PAGE_SIZE);
  slice.forEach(name => grid.appendChild(makeGameCard(name, null, 'pick')));
  const hint = document.getElementById('browse-hint');
  hint.innerHTML = names.length > slice.length
    ? `<button class="btn-secondary" onclick="browsePage++;renderBrowseGrid()" style="margin-top:14px;display:inline-block;padding:8px 20px;font-size:13px;">Load more (${names.length - slice.length} remaining)</button>`
    : '';
}

/* ── STARS ── */
function rankToStars(rank) { return 5.5 - (rank / 10) * 5; }
function starSVG(f) { return `<svg class="star-svg" viewBox="0 0 14 14"><polygon points="7,1 8.8,5.3 13.5,5.7 10.1,8.7 11.1,13.3 7,10.8 2.9,13.3 3.9,8.7 0.5,5.7 5.2,5.3" fill="${f}"/></svg>`; }
function halfStarSVG(f, e) {
  const id = 'h' + Math.random().toString(36).slice(2, 7);
  return `<svg class="star-svg" viewBox="0 0 14 14"><defs><clipPath id="${id}"><rect x="0" y="0" width="7" height="14"/></clipPath></defs><polygon points="7,1 8.8,5.3 13.5,5.7 10.1,8.7 11.1,13.3 7,10.8 2.9,13.3 3.9,8.7 0.5,5.7 5.2,5.3" fill="${e}"/><polygon points="7,1 8.8,5.3 13.5,5.7 10.1,8.7 11.1,13.3 7,10.8 2.9,13.3 3.9,8.7 0.5,5.7 5.2,5.3" fill="${f}" clip-path="url(#${id})"/></svg>`;
}
function starsHTML(val) {
  const A = '#f5a623', G = '#2a2e3d';
  let o = '';
  for (let i = 1; i <= 5; i++) {
    if (val >= i) o += starSVG(A);
    else if (val >= i - 0.5) o += halfStarSVG(A, G);
    else o += starSVG(G);
  }
  return `<div class="stars-mini">${o}</div>`;
}

/* ── GAME CARD ── */
function makeGameCard(gameName, rank, mode) {
  const m = GAMES_META[gameName] || {};
  const div = document.createElement('div');
  div.className = 'game-card' + (selectedGames.has(gameName) && mode === 'pick' ? ' selected' : '');
  div.dataset.game = gameName;
  const cov = m.cover_image_url
    ? `<img class="card-cover" src="${m.cover_image_url}" alt="${esc(gameName)}" loading="lazy" onerror="this.outerHTML='<div class=card-cover-placeholder>No image</div>'">`
    : `<div class="card-cover-placeholder">No image</div>`;
  const gen = m.genres ? m.genres.split(',').slice(0, 2).join(', ') : 'Unknown';
  let foot = '';
  if (rank !== null) { foot = `${starsHTML(rankToStars(rank))}<span class="rank-chip">#${rank}</span>`; }
  else if (m.review_score_pct) { foot = starsHTML(m.review_score_pct / 20); }
  div.innerHTML = `${cov}<div class="card-check"><svg width="12" height="12" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><div class="card-body"><div class="card-title" title="${esc(gameName)}">${esc(gameName)}</div><div class="card-genre">${esc(gen)}</div><div class="card-footer">${foot}</div></div>`;
  if (mode === 'pick') div.addEventListener('click', () => togglePick(gameName, div));
  else div.addEventListener('click', () => openModal(gameName, rank));
  return div;
}

/* ── PICK MODE ── */
function togglePick(name, el) {
  if (selectedGames.has(name)) { selectedGames.delete(name); el.classList.remove('selected'); }
  else { selectedGames.add(name); el.classList.add('selected'); }
  updateTray();
}
function updateTray() {
  const tray = document.getElementById('pick-tray');
  const badge = document.getElementById('pick-badge');
  const countEl = document.getElementById('pick-count');
  if (!selectedGames.size) {
    tray.classList.remove('visible');
    badge.style.display = 'none';
    return;
  }
  tray.classList.add('visible');
  badge.style.display = 'flex';
  countEl.textContent = selectedGames.size;
  document.getElementById('tray-count').textContent = `${selectedGames.size} selected`;
  document.getElementById('tray-chips').innerHTML = Array.from(selectedGames).map(n => {
    const m = GAMES_META[n] || {};
    return `<div class="tray-chip">${m.cover_image_url ? `<img src="${m.cover_image_url}" alt="">` : '<img src="" style="opacity:0">'}<span>${esc(n.length > 22 ? n.slice(0, 20) + '…' : n)}</span><span class="tray-chip-remove" onclick="removePick('${n.replace(/'/g, "\\'")}')">×</span></div>`;
  }).join('');
}
function removePick(name) {
  selectedGames.delete(name);
  document.querySelectorAll('.game-card').forEach(c => { if (c.dataset.game === name) c.classList.remove('selected'); });
  updateTray();
}
function clearPicks() {
  selectedGames.clear();
  document.querySelectorAll('.game-card.selected').forEach(c => c.classList.remove('selected'));
  updateTray();
}

function getTagSet(n) {
  const m = GAMES_META[n] || {};
  return new Set([...(m.tags || '').split(','), ...(m.genres || '').split(',')].map(x => x.trim().toLowerCase()).filter(Boolean));
}
function jaccardSim(A, B) {
  if (!A.size || !B.size) return 0;
  let i = 0;
  A.forEach(x => { if (B.has(x)) i++; });
  return i / (A.size + B.size - i);
}

function getPickRecs() {
  if (!selectedGames.size) return;
  const summaryEl = document.getElementById('picks-summary');
  summaryEl.innerHTML = Array.from(selectedGames).map(n => {
    const m = GAMES_META[n] || {};
    return `<div class="pick-tag">${m.cover_image_url ? `<img src="${m.cover_image_url}" alt="">` : ''}${esc(n.length > 24 ? n.slice(0, 22) + '…' : n)}</div>`;
  }).join('');
  goTo('results');
  const grid = document.getElementById('pick-recs-grid');
  grid.innerHTML = `<div style="grid-column:1/-1;padding:40px 0;text-align:center;"><div class="spinner"></div><p style="color:var(--text3);font-size:13px;">Finding similar games…</p></div>`;
  setTimeout(() => {
    const simMap = {};
    selectedGames.forEach(picked => {
      const neighbours = ITEM_SIM[picked] || [];
      neighbours.forEach(([name, sim]) => {
        if (!selectedGames.has(name)) simMap[name] = (simMap[name] || 0) + sim;
      });
    });
    let scores = Object.entries(simMap).map(([name, sim]) => ({ name, sim }));
    if (!scores.length) {
      const combined = new Set(Array.from(selectedGames).flatMap(n => Array.from(getTagSet(n))));
      scores = ALL_GAME_NAMES.filter(n => !selectedGames.has(n)).map(n => ({ name: n, sim: jaccardSim(combined, getTagSet(n)) })).filter(x => x.sim > 0);
    }
    scores.sort((a, b) => b.sim - a.sim);
    scores = scores.slice(0, 20);
    grid.innerHTML = '';
    if (!scores.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>No matches found</h3><p>Try selecting games with more genre/tag data.</p></div>`;
      return;
    }
    scores.forEach((item, i) => grid.appendChild(makeRecCard(item, i + 1, GAMES_META[item.name] || {})));
  }, 80);
}

/* ── PICK SEARCH ── */
function setupPickSearch() {
  const input = document.getElementById('pick-search'), drop = document.getElementById('pick-dropdown');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { drop.classList.remove('open'); return; }
    const matches = ALL_GAME_NAMES.filter(n => n.toLowerCase().includes(q)).slice(0, 30);
    if (!matches.length) { drop.classList.remove('open'); return; }
    drop.innerHTML = matches.map(n => {
      const m = GAMES_META[n] || {};
      const g = m.genres ? m.genres.split(',').slice(0, 2).join(', ') : '';
      return `<div class="dropdown-item" onclick="selectFromDropdown('${n.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">${m.cover_image_url ? `<img class="dropdown-thumb" src="${m.cover_image_url}" alt="">` : '<div class="dropdown-thumb"></div>'}<span class="dropdown-name">${esc(n)}</span><span class="dropdown-genre">${esc(g)}</span></div>`;
    }).join('');
    drop.classList.add('open');
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('pick-search-wrap').contains(e.target)) drop.classList.remove('open');
  });
}
function selectFromDropdown(name) {
  selectedGames.add(name);
  document.querySelectorAll('.game-card').forEach(c => { if (c.dataset.game === name) c.classList.add('selected'); });
  updateTray();
  document.getElementById('pick-search').value = '';
  document.getElementById('pick-dropdown').classList.remove('open');
}

/* ── USER LOOKUP ── */
function setupUserSearch() {
  const input = document.getElementById('user-search'), drop = document.getElementById('user-dropdown');
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 2) { drop.classList.remove('open'); return; }
    const matches = ALL_USER_IDS.filter(id => id.includes(q)).slice(0, 20);
    if (!matches.length) { drop.classList.remove('open'); return; }
    drop.innerHTML = matches.map(id => {
      const hist = PLAY_HISTORY[id] || [];
      return `<div class="dropdown-item" onclick="selectUser('${id}')"><span class="dropdown-name">${id}</span><span class="dropdown-genre">${hist.length} games played</span></div>`;
    }).join('');
    drop.classList.add('open');
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('user-search-wrap').contains(e.target)) drop.classList.remove('open');
  });
}
function selectUser(id) { document.getElementById('user-search').value = id; document.getElementById('user-dropdown').classList.remove('open'); lookupUser(); }
function lookupUser() {
  const input = document.getElementById('user-search').value.trim();
  const out = document.getElementById('user-result');
  if (!input) return;
  if (!RECS[input]) { out.innerHTML = `<div class="empty-state"><h3>User not found</h3><p>ID <strong>${esc(input)}</strong> is not in the dataset.</p></div>`; return; }
  out.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Loading profile…</p></div>`;
  setTimeout(() => renderUserProfile(input), 60);
}

function renderUserProfile(uid) {
  const recs = RECS[uid] || [], history = PLAY_HISTORY[uid] || [];
  const out = document.getElementById('user-result');
  const genreCount = {};
  history.forEach(r => { if (r.genres) r.genres.split(',').forEach(g => { const t = g.trim(); genreCount[t] = (genreCount[t] || 0) + 1; }); });
  const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
  const totalHours = history.reduce((s, r) => s + r.hours, 0);
  out.innerHTML = `<div class="fade-in">
    <div class="profile-banner">
      <div class="avatar">${uid.slice(-2).toUpperCase()}</div>
      <div class="profile-info"><h2>User ${uid}</h2><p>Steam dataset profile</p></div>
      <div class="profile-stats">
        <div class="profile-stat"><div class="profile-stat-val">${history.length}</div><div class="profile-stat-label">Games played</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${totalHours >= 1000 ? (totalHours / 1000).toFixed(1) + 'k' : Math.round(totalHours)}</div><div class="profile-stat-label">Hours total</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${recs.length}</div><div class="profile-stat-label">Recommendations</div></div>
      </div>
    </div>
    ${topGenres.length ? `<div class="section-label" style="margin-bottom:10px;">Top genres</div><div class="genre-pills" style="margin-bottom:24px;">${topGenres.map(g => `<div class="genre-pill active" style="cursor:default">${esc(g)}</div>`).join('')}</div>` : ''}
    <div class="inner-tabs">
      <button class="inner-tab active" id="itab-recs-${uid}" onclick="switchInnerTab('${uid}','recs')">🎯 Recommendations (${recs.length})</button>
      <button class="inner-tab" id="itab-hist-${uid}" onclick="switchInnerTab('${uid}','hist')">🕹️ Play history (${history.length})</button>
    </div>
    <div id="inner-recs-${uid}"><div class="cards-grid" id="recs-grid-${uid}"></div></div>
    <div id="inner-hist-${uid}" style="display:none"></div>
  </div>`;
  const recsGrid = document.getElementById(`recs-grid-${uid}`);
  recs.forEach((r, i) => recsGrid.appendChild(makeRecCard(r, i + 1, GAMES_META[r.n] || {})));
  window[`_hist_${uid}`] = history;
  renderHistoryTable(uid, 0);
}

function switchInnerTab(uid, tab) {
  document.getElementById(`itab-recs-${uid}`).classList.toggle('active', tab === 'recs');
  document.getElementById(`itab-hist-${uid}`).classList.toggle('active', tab === 'hist');
  document.getElementById(`inner-recs-${uid}`).style.display = tab === 'recs' ? '' : 'none';
  document.getElementById(`inner-hist-${uid}`).style.display = tab === 'hist' ? '' : 'none';
}

function renderHistoryTable(uid, page) {
  const history = window[`_hist_${uid}`] || [];
  const container = document.getElementById(`inner-hist-${uid}`);
  const maxHours = Math.max(...history.map(r => r.hours), 1);
  const slice = history.slice(0, (page + 1) * HISTORY_PAGE_SIZE);
  const rows = slice.map((r, i) => {
    const pct = Math.min(100, (r.hours / maxHours) * 100);
    const thumb = r.img ? `<img class="history-thumb" src="${r.img}" alt="" onerror="this.style.display='none'">` : `<div class="history-thumb"></div>`;
    const dots = Array.from({ length: 5 }, (_, k) => `<svg viewBox="0 0 14 14" style="width:13px;height:13px;"><polygon points="7,1 8.8,5.3 13.5,5.7 10.1,8.7 11.1,13.3 7,10.8 2.9,13.3 3.9,8.7 0.5,5.7 5.2,5.3" fill="${k < r.rating ? '#f5a623' : '#2a2e3d'}"/></svg>`).join('');
    const hrs = r.hours >= 1000 ? (r.hours / 1000).toFixed(1) + 'k' : r.hours;
    return `<tr onclick="openModal('${r.game.replace(/'/g, "\\'").replace(/\\/g, '\\\\')}',null)">
      <td style="width:32px;color:var(--text3);font-size:12px;">${i + 1}</td>
      <td><div class="history-game-cell">${thumb}<span class="history-game-name">${esc(r.game)}</span></div></td>
      <td style="color:var(--text3);font-size:12px;">${r.genres ? esc(r.genres.split(',').slice(0, 2).join(', ')) : '—'}</td>
      <td><div class="hours-bar-wrap"><div class="hours-bar"><div class="hours-bar-fill" style="width:${pct}%"></div></div><span class="hours-label">${hrs}h</span></div></td>
      <td><div class="rating-dots">${dots}</div></td>
    </tr>`;
  }).join('');
  container.innerHTML = `<div class="table-wrap">
    <table class="history-table">
      <thead><tr><th>#</th><th>Game</th><th>Genres</th><th>Hours played</th><th>Rating</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${history.length > slice.length ? `<div class="show-more-row"><button class="btn-show-more" onclick="renderHistoryTable('${uid}',${page + 1})">Show more (${history.length - slice.length} remaining)</button></div>` : ''}
  </div>`;
}

function makeRecCard(rec, rank, meta) {
  const div = document.createElement('div');
  div.className = 'game-card'; div.dataset.game = rec.n || rec.name;
  const name = rec.n || rec.name;
  const img = rec.img || meta.img || meta.cover_image_url;
  const gen = (rec.g || meta.g || '').split(',').slice(0, 2).join(', ') || 'Unknown';
  const cov = img ? `<img class="card-cover" src="${img}" alt="${esc(name)}" loading="lazy" onerror="this.outerHTML='<div class=card-cover-placeholder>No image</div>'">` : `<div class="card-cover-placeholder">No image</div>`;
  div.innerHTML = `${cov}<div class="card-body"><div class="card-title" title="${esc(name)}">${esc(name)}</div><div class="card-genre">${esc(gen)}</div><div class="card-footer">${starsHTML(rankToStars(rank))}<span class="rank-chip">#${rank}</span></div></div>`;
  div.addEventListener('click', () => openModal(name, rank));
  return div;
}

/* ── MODAL ── */
function openModal(gameName, rank) {
  const m = GAMES_META[gameName] || {};
  document.getElementById('modal-cover').src = m.cover_image_url || '';
  document.getElementById('modal-cover').style.display = m.cover_image_url ? 'block' : 'none';
  document.getElementById('modal-title').textContent = gameName;
  let mh = '';
  if (rank) mh += `<span class="tag-chip" style="background:var(--accent);color:#fff;border-color:var(--accent)">#${rank} pick</span>`;
  if (m.release_date) mh += `<span class="tag-chip">${esc(m.release_date)}</span>`;
  if (m.price != null) mh += `<span class="tag-chip">${m.price === 0 ? 'Free' : '$' + m.price}</span>`;
  if (m.developers) mh += `<span class="tag-chip">${esc(m.developers.split(',')[0])}</span>`;
  document.getElementById('modal-meta').innerHTML = mh;
  document.getElementById('modal-desc').textContent = m.description || 'No description available.';
  document.getElementById('modal-stats').innerHTML = `
    <div class="modal-stat-box"><div class="modal-stat-val" style="color:var(--green)">${m.review_score_pct ? starsHTML(m.review_score_pct / 20) : '—'}</div><div class="modal-stat-label">Review score</div></div>
    <div class="modal-stat-box"><div class="modal-stat-val">${rank ? rankToStars(rank).toFixed(1) + ' ★' : '—'}</div><div class="modal-stat-label">Match score</div></div>
    <div class="modal-stat-box"><div class="modal-stat-val">${m.price != null ? (m.price === 0 ? 'Free' : '$' + m.price) : '—'}</div><div class="modal-stat-label">Price</div></div>`;
  document.getElementById('modal-tags').innerHTML = (m.tags ? m.tags.split(',').slice(0, 12) : []).map(t => `<span class="tag-chip">${esc(t.trim())}</span>`).join('');
  const url = m.app_id ? `https://store.steampowered.com/app/${m.app_id}/` : null;
  document.getElementById('modal-footer').innerHTML = `<button class="btn-secondary" style="flex:1" onclick="closeModal()">Close</button>${url ? `<a class="btn-steam" href="${url}" target="_blank" rel="noopener">View on Steam <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}`;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(e) { if (!e || e.target === document.getElementById('modal-overlay')) document.getElementById('modal-overlay').classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ═══════════════════════════════════════
   ANALYTICS ENGINE
═══════════════════════════════════════ */
let analyticsBuilt = false;

function buildAnalytics() {
  if (analyticsBuilt) return;
  analyticsBuilt = true;

  const games = Object.entries(GAMES_META);
  const allRecs = Object.values(RECS);
  const allHist = Object.values(PLAY_HISTORY);

  // Genre counts
  const genreCount = {};
  games.forEach(([, m]) => {
    const _gc = m.genres || m.g; if (!_gc) return;
    _gc.split(',').forEach(g => { const t = g.trim(); if (t) genreCount[t] = (genreCount[t] || 0) + 1; });
  });
  const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 14);

  // Tag counts
  const tagCount = {};
  games.forEach(([, m]) => {
    const _tc = m.tags || m.t; if (!_tc) return;
    _tc.split(',').forEach(t => { const k = t.trim(); if (k) tagCount[k] = (tagCount[k] || 0) + 1; });
  });
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 30);

  // Review score distribution
  const reviewBuckets = { 'Overwhelmingly Positive (95-100)': 0, 'Very Positive (80-94)': 0, 'Mostly Positive (70-79)': 0, 'Mixed (40-69)': 0, 'Negative (<40)': 0, 'No data': 0 };
  games.forEach(([, m]) => {
    const r = m.review_score_pct ?? m.rv;
    if (r == null) { reviewBuckets['No data']++; return; }
    if (r >= 95) reviewBuckets['Overwhelmingly Positive (95-100)']++;
    else if (r >= 80) reviewBuckets['Very Positive (80-94)']++;
    else if (r >= 70) reviewBuckets['Mostly Positive (70-79)']++;
    else if (r >= 40) reviewBuckets['Mixed (40-69)']++;
    else reviewBuckets['Negative (<40)']++;
  });

  // Price distribution
  const priceBuckets = { 'Free': 0, '$0.01-4.99': 0, '$5-9.99': 0, '$10-19.99': 0, '$20-39.99': 0, '$40+': 0, 'Unknown': 0 };
  games.forEach(([, m]) => {
    const p = m.price;
    if (p == null) { priceBuckets['Unknown']++; return; }
    if (p === 0) priceBuckets['Free']++;
    else if (p < 5) priceBuckets['$0.01-4.99']++;
    else if (p < 10) priceBuckets['$5-9.99']++;
    else if (p < 20) priceBuckets['$10-19.99']++;
    else if (p < 40) priceBuckets['$20-39.99']++;
    else priceBuckets['$40+']++;
  });

  // Rating distribution
  const ratingDist = [0, 0, 0, 0, 0];
  allHist.forEach(hist => hist.forEach(r => { if (r.rating >= 1 && r.rating <= 5) ratingDist[r.rating - 1]++; }));

  // Hours distribution
  const hoursBuckets = { 'Casual (<5h)': 0, 'Regular (5-50h)': 0, 'Dedicated (50-200h)': 0, 'Hardcore (200h+)': 0 };
  allHist.forEach(hist => hist.forEach(r => {
    const h = r.hours;
    if (h < 5) hoursBuckets['Casual (<5h)']++;
    else if (h < 50) hoursBuckets['Regular (5-50h)']++;
    else if (h < 200) hoursBuckets['Dedicated (50-200h)']++;
    else hoursBuckets['Hardcore (200h+)']++;
  }));

  const topRated = games.map(([n,m]) => [n,{...m,_rv:m.review_score_pct??m.rv}]).filter(([,m]) => m._rv != null && m._rv >= 70).sort((a,b) => b[1]._rv - a[1]._rv).slice(0, 10);

  const recCount = {};
  allRecs.forEach(recs => recs.forEach(r => { recCount[r.n] = (recCount[r.n] || 0) + 1; }));
  const mostRecommended = Object.entries(recCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const gameHours = {};
  allHist.forEach(hist => hist.forEach(r => { gameHours[r.game] = (gameHours[r.game] || 0) + r.hours; }));
  const mostPlayed = Object.entries(gameHours).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const totalHoursAll = allHist.reduce((s, h) => s + h.reduce((ss, r) => ss + r.hours, 0), 0);
  const avgHoursPerUser = totalHoursAll / allHist.length;
  const avgGamesPerUser = allHist.reduce((s, h) => s + h.length, 0) / allHist.length;
  const avgRating = ratingDist.reduce((s, v, i) => s + (i + 1) * v, 0) / ratingDist.reduce((s, v) => s + v, 0);
  const gamesWithImg = games.filter(([, m]) => m.img || m.cover_image_url).length;
  const coveragePct = Math.round(gamesWithImg / games.length * 100);

  const genreReview = {}, genreReviewCount = {};
  games.forEach(([, m]) => {
    const _gr = m.genres || m.g; const _rv2 = m.review_score_pct ?? m.rv; if (!_gr || _rv2 == null) return;
    _gr.split(',').forEach(g => {
      const t = g.trim();
      genreReview[t] = (genreReview[t] || 0) + _rv2;
      genreReviewCount[t] = (genreReviewCount[t] || 0) + 1;
    });
  });
  const genreAvgReview = Object.entries(genreReview)
    .map(([g, s]) => ([g, s / genreReviewCount[g]]))
    .sort((a, b) => b[1] - a[1]).slice(0, 12);

  const genrePrice = {}, genrePriceCount = {};
  games.forEach(([, m]) => {
    const _gp = m.genres || m.g; if (!_gp || m.price == null) return;
    _gp.split(',').forEach(g => {
      const t = g.trim();
      genrePrice[t] = (genrePrice[t] || 0) + m.price;
      genrePriceCount[t] = (genrePriceCount[t] || 0) + 1;
    });
  });
  const genreAvgPrice = Object.entries(genrePrice)
    .filter(([g]) => genrePriceCount[g] >= 5)
    .map(([g, s]) => ([g, +(s / genrePriceCount[g]).toFixed(2)]))
    .sort((a, b) => b[1] - a[1]).slice(0, 10);

  /* ── Render helpers ── */
  const PALETTE = ['#e8ff47', '#4f8ef7', '#3ecf8e', '#f5a623', '#e05252', '#9b7fe8', '#2dd4bf', '#f472b6', '#fb923c', '#a3e635', '#38bdf8', '#c084fc', '#f87171', '#34d399'];
  const ACCENT = '#e8ff47', BLUE = '#4f8ef7', GREEN = '#3ecf8e', AMBER = '#f5a623', RED = '#e05252', TEAL = '#2dd4bf';

  function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toLocaleString(); }

  function barChart(entries, maxVal, colorFn, labelClass = '') {
    return `<div class="bar-chart">${entries.map(([label, val], i) => {
      const pct = Math.round((val / maxVal) * 100);
      const color = typeof colorFn === 'function' ? colorFn(i) : colorFn;
      const dispVal = typeof val === 'number' && val < 1000 ? (val % 1 !== 0 ? val.toFixed(1) : val) : fmt(val);
      return `<div class="bar-row"><div class="bar-row-label ${labelClass}" title="${esc(label)}">${esc(label)}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div><div class="bar-row-val">${dispVal}</div></div>`;
    }).join('')}</div>`;
  }

  function donut(slices) {
    const total = slices.reduce((s, x) => s + x.value, 0);
    let angle = -Math.PI / 2;
    const cx = 60, cy = 60, R = 52, r = 28;
    let paths = '';
    slices.forEach(sl => {
      const theta = (sl.value / total) * Math.PI * 2;
      const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
      const x2 = cx + R * Math.cos(angle + theta), y2 = cy + R * Math.sin(angle + theta);
      const ix1 = cx + r * Math.cos(angle + theta), iy1 = cy + r * Math.sin(angle + theta);
      const ix2 = cx + r * Math.cos(angle), iy2 = cy + r * Math.sin(angle);
      const large = theta > Math.PI ? 1 : 0;
      paths += `<path d="M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix1},${iy1} A${r},${r} 0 ${large},0 ${ix2},${iy2} Z" fill="${sl.color}" opacity=".9"/>`;
      angle += theta;
    });
    const legend = slices.map(sl => `<div class="donut-legend-item"><div class="donut-legend-dot" style="background:${sl.color}"></div><span>${esc(sl.label)}: <strong style="color:var(--text)">${fmt(sl.value)}</strong></span></div>`).join('');
    return `<div class="donut-wrap"><svg viewBox="0 0 120 120" width="120" height="120" style="flex-shrink:0">${paths}</svg><div class="donut-legend">${legend}</div></div>`;
  }

  function ratingBar() {
    const max = Math.max(...ratingDist);
    const stars = ['1★', '2★', '3★', '4★', '5★'];
    const colors = [RED, AMBER, '#f5c842', GREEN, ACCENT];
    return `<div class="rating-dist">${ratingDist.map((v, i) => {
      const h = Math.round((v / max) * 72);
      return `<div class="rd-bar-wrap"><div class="rd-bar" style="height:${h}px;background:${colors[i]}"></div><div class="rd-label">${stars[i]}</div></div>`;
    }).join('')}</div>`;
  }

  function tagCloud() {
    const max = topTags[0][1];
    return `<div class="tag-cloud">${topTags.map(([tag, cnt], i) => {
      const size = 10 + Math.round((cnt / max) * 10);
      const opacity = (0.5 + (cnt / max) * 0.5).toFixed(2);
      const color = PALETTE[i % PALETTE.length];
      return `<span class="tc-tag" style="font-size:${size}px;padding:${size > 15 ? '5px 14px' : '3px 10px'};color:${color};border-color:${color}22;opacity:${opacity}">${esc(tag)}</span>`;
    }).join('')}</div>`;
  }

  /* ── Compose ── */
  const maxGenre = topGenres.length ? topGenres[0][1] : 1;
  const reviewColors = { 'Overwhelmingly Positive (95-100)': ACCENT, 'Very Positive (80-94)': GREEN, 'Mostly Positive (70-79)': TEAL, 'Mixed (40-69)': AMBER, 'Negative (<40)': RED, 'No data': '#333' };
  const priceColors = { 'Free': GREEN, '$0.01-4.99': TEAL, '$5-9.99': BLUE, '$10-19.99': AMBER, '$20-39.99': ACCENT, '$40+': RED, 'Unknown': '#333' };
  const priceSlices = Object.entries(priceBuckets).filter(([, v]) => v > 0).map(([l, v]) => ({ label: l, value: v, color: priceColors[l] }));
  const hoursIcons = { 'Casual (<5h)': '🌱', 'Regular (5-50h)': '🎮', 'Dedicated (50-200h)': '🔥', 'Hardcore (200h+)': '💀' };
  const hoursColors = { 'Casual (<5h)': GREEN, 'Regular (5-50h)': BLUE, 'Dedicated (50-200h)': AMBER, 'Hardcore (200h+)': RED };
  const maxRec = mostRecommended[0]?.[1] || 1;
  const maxGenreRev = genreAvgReview[0]?.[1] || 100;
  const maxGenrePrice = genreAvgPrice[0]?.[1] || 1;
  const lbRankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';

  document.getElementById('analytics-content').innerHTML = `
  <div class="kpi-row">
    <div class="kpi-box"><div class="kpi-val">${fmt(totalHoursAll)}</div><div class="kpi-label">Total Hours Played</div><div class="kpi-delta">across all users</div></div>
    <div class="kpi-box"><div class="kpi-val">${avgHoursPerUser.toFixed(0)}h</div><div class="kpi-label">Avg Hours / User</div></div>
    <div class="kpi-box"><div class="kpi-val">${avgGamesPerUser.toFixed(1)}</div><div class="kpi-label">Avg Games / User</div></div>
    <div class="kpi-box"><div class="kpi-val">${avgRating.toFixed(2)}★</div><div class="kpi-label">Avg Rating Given</div></div>
    <div class="kpi-box"><div class="kpi-val">${coveragePct}%</div><div class="kpi-label">Cover Art Coverage</div></div>
  </div>
  <div class="analytics-grid">
    <div class="an-card"><div class="an-card-title"><span class="an-icon">🎮</span> Top Genres by Game Count</div>${barChart(topGenres.slice(0, 12), maxGenre, i => PALETTE[i % PALETTE.length])}</div>
    <div class="an-card"><div class="an-card-title"><span class="an-icon">⭐</span> Player Rating Distribution</div>${ratingBar()}<div class="an-card-subtitle">Implicit ratings from hours played (1-5 stars).</div><div style="height:16px"></div><div class="an-card-title"><span class="an-icon">🏷️</span> Price Breakdown</div>${donut(priceSlices)}</div>
  </div>
  <div class="analytics-grid">
    <div class="an-card"><div class="an-card-title"><span class="an-icon">👍</span> Review Score Tiers</div><div class="review-tiers">${Object.entries(reviewBuckets).map(([label, val]) => { const pct = Math.round((val / games.length) * 100); const color = reviewColors[label] || '#555'; return `<div class="rt-row"><div class="rt-dot" style="background:${color}"></div><div class="rt-label">${esc(label.replace(/ \(.*\)/, ''))}</div><div class="rt-track"><div class="rt-fill" style="width:${pct}%;background:${color}"></div></div><div class="rt-val">${pct}%</div></div>`; }).join('')}</div></div>
    <div class="an-card"><div class="an-card-title"><span class="an-icon">⏱️</span> Playtime Commitment</div><div class="pt-buckets">${Object.entries(hoursBuckets).map(([label, val]) => `<div class="pt-bucket"><div class="pt-bucket-icon">${hoursIcons[label]}</div><div class="pt-bucket-val" style="color:${hoursColors[label]}">${fmt(val)}</div><div class="pt-bucket-label">${esc(label)}</div></div>`).join('')}</div><div class="an-card-subtitle" style="margin-top:16px">Sessions by hours invested across all users.</div></div>
  </div>
  <div class="analytics-grid three">
    <div class="an-card"><div class="an-card-title"><span class="an-icon">🏆</span> Most Recommended Games</div><div class="leaderboard">${mostRecommended.map(([name, cnt], i) => { const m = GAMES_META[name] || {}; const img = m.img || m.cover_image_url; return `<div class="lb-row" onclick="openModal('${name.replace(/'/g, "\\'").replace(/\\/g, '\\\\')}',null)"><div class="lb-rank ${lbRankClass(i)}">${i + 1}</div>${img ? `<img class="lb-img" src="${img}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="lb-img"></div>'}<div class="lb-name" title="${esc(name)}">${esc(name)}</div><div class="lb-score">${fmt(cnt)}</div></div>`; }).join('')}</div></div>
    <div class="an-card"><div class="an-card-title"><span class="an-icon">🕹️</span> Most Hours Logged</div><div class="leaderboard">${mostPlayed.map(([name, hrs], i) => { const m = GAMES_META[name] || {}; const img = m.img || m.cover_image_url; return `<div class="lb-row" onclick="openModal('${name.replace(/'/g, "\\'").replace(/\\/g, '\\\\')}',null)"><div class="lb-rank ${lbRankClass(i)}">${i + 1}</div>${img ? `<img class="lb-img" src="${img}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="lb-img"></div>'}<div class="lb-name" title="${esc(name)}">${esc(name)}</div><div class="lb-score" style="font-size:14px;color:var(--amber)">${fmt(hrs)}h</div></div>`; }).join('')}</div></div>
    <div class="an-card"><div class="an-card-title"><span class="an-icon">🌟</span> Highest Rated Games</div><div class="leaderboard">${topRated.slice(0, 10).map(([name, m], i) => { const img = m.img || m.cover_image_url; return `<div class="lb-row" onclick="openModal('${name.replace(/'/g, "\\'").replace(/\\/g, '\\\\')}',null)"><div class="lb-rank ${lbRankClass(i)}">${i + 1}</div>${img ? `<img class="lb-img" src="${img}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="lb-img"></div>'}<div class="lb-name" title="${esc(name)}">${esc(name)}</div><div class="lb-score" style="font-size:14px;color:var(--green)">${m._rv ?? m.rv}%</div></div>`; }).join('')}</div></div>
  </div>
  <div class="analytics-grid">
    <div class="an-card"><div class="an-card-title"><span class="an-icon">📈</span> Genre Avg Review Score</div>${barChart(genreAvgReview, 100, i => PALETTE[i % PALETTE.length])}<div class="an-card-subtitle">Average Steam review score (%) per genre.</div></div>
    <div class="an-card"><div class="an-card-title"><span class="an-icon">💰</span> Genre Avg Price (USD)</div>${barChart(genreAvgPrice, maxGenrePrice, i => PALETTE[(i + 4) % PALETTE.length])}<div class="an-card-subtitle">Average price per genre across all games.</div></div>
  </div>
  <div class="analytics-grid">
    <div class="an-card"><div class="an-card-title"><span class="an-icon">☁️</span> Top 30 Steam Tags</div>${tagCloud()}<div class="an-card-subtitle">Size = frequency. Click a tag to filter games on Pick page.</div></div>
    <div class="an-card"><div class="an-card-title"><span class="an-icon">🔁</span> Most Recommended (bar)</div>${barChart(mostRecommended.slice(0, 10).map(([n, c]) => [n.length > 22 ? n.slice(0, 20) + '...' : n, c]), maxRec, i => PALETTE[i % PALETTE.length], 'sm')}<div class="an-card-subtitle">Games appearing in the most users' top-10 lists.</div></div>
  </div>`;

  document.querySelectorAll('.tc-tag').forEach(el => {
    el.addEventListener('click', () => {
      goTo('pick');
      const genre = topGenres.map(x => x[0]).find(g => el.textContent.trim().toLowerCase() === g.toLowerCase());
      if (genre) filterGenre(genre);
    });
  });

  document.getElementById('analytics-status').textContent = `${fmt(games.length)} games analysed`;
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('browse-grid').innerHTML = `<div style="grid-column:1/-1;padding:60px 20px;text-align:center;"><div class="spinner"></div><p style="color:var(--text3);font-size:13px;">Loading games...</p></div>`;
  loadData();
});
