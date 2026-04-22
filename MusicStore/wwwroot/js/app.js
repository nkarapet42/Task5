// ── State ────────────────────────────────────────────────────────────────────
const state = {
  locale: 'en-US',
  seed: 42n,
  likesPerSong: 3.0,
  view: 'table',
  currentPage: 1,
  pageSize: 10,
  galleryPage: 1,
  galleryLoading: false,
  galleryExhausted: false,
  expandedIndex: null,
  playingIndex: null,
  playingAudio: null,
  playingDetail: null,
  playStartTime: null,
  lyricsInterval: null,
  locales: []
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const elLocale     = document.getElementById('locale-select');
const elSeed       = document.getElementById('seed-input');
const elRandSeed   = document.getElementById('rand-seed-btn');
const elLikes      = document.getElementById('likes-slider');
const elLikesVal   = document.getElementById('likes-val');
const elViewTable  = document.getElementById('view-table-btn');
const elViewGal    = document.getElementById('view-gallery-btn');
const elTableView  = document.getElementById('table-view');
const elGalView    = document.getElementById('gallery-view');
const elTbody      = document.getElementById('song-tbody');
const elPagination = document.getElementById('pagination');
const elExportBtn  = document.getElementById('export-btn');

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildQuery(extra = {}) {
  return new URLSearchParams({
    locale: state.locale,
    seed: state.seed.toString(),
    likesPerSong: state.likesPerSong,
    ...extra
  });
}

async function fetchPage(page) {
  const r = await fetch(`/api/songs/page?${buildQuery({ page, pageSize: state.pageSize })}`);
  return r.json();
}

async function fetchDetail(recordIndex) {
  const r = await fetch(`/api/songs/detail?${buildQuery({ recordIndex, pageSize: state.pageSize })}`);
  return r.json();
}

function likesHtml(count) {
  let d = '';
  for (let i = 0; i < 10; i++)
    d += `<span class="like-dot${i < count ? '' : ' empty'}"></span>`;
  return `<span class="likes-dots" title="${count} likes">${d}</span>`;
}

function randomBigInt64() {
  const hi = BigInt(Math.floor(Math.random() * 0x80000000));
  const lo = BigInt(Math.floor(Math.random() * 0x100000000));
  const v = (hi << 32n) | lo;
  return Math.random() < 0.5 ? -v : v;
}

const I64_MIN = -9223372036854775808n;
const I64_MAX =  9223372036854775807n;

function parseSeedInput(raw) {
  const s = (raw ?? '').trim();
  if (!/^[-]?\d+$/.test(s)) return null;

  let v;
  try {
    v = BigInt(s);
  } catch {
    return null;
  }

  if (v < I64_MIN) return I64_MIN;
  if (v > I64_MAX) return I64_MAX;
  return v;
}

// ── Table View ────────────────────────────────────────────────────────────────
async function loadTablePage(page) {
  elTbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px">
    <span class="spinner"></span> Loading…</td></tr>`;
  elPagination.innerHTML = '';

  const data = await fetchPage(page);
  state.currentPage = page;
  state.expandedIndex = null;
  stopMusic();

  renderTableRows(data.records);
  renderPagination();
}

function renderTableRows(records) {
  elTbody.innerHTML = '';
  for (const rec of records) {
    const tr = document.createElement('tr');
    tr.dataset.index = rec.index;
    tr.innerHTML = `
      <td class="idx-cell">${rec.index}</td>
      <td>${esc(rec.title)}</td>
      <td>${esc(rec.artist)}</td>
      <td>${esc(rec.album)}</td>
      <td><span class="genre-badge">${esc(rec.genre)}</span></td>
      <td>${likesHtml(rec.likes)}</td>`;
    tr.addEventListener('click', () => toggleExpand(rec.index, tr));
    elTbody.appendChild(tr);
  }
}

async function toggleExpand(recordIndex, tr) {
  const existing = elTbody.querySelector('.expanded-row');
  if (existing) {
    existing.remove();
    stopMusic();
    if (state.expandedIndex === recordIndex) {
      state.expandedIndex = null;
      return;
    }
  }
  state.expandedIndex = recordIndex;

  // Skeleton placeholder
  const loadRow = document.createElement('tr');
  loadRow.className = 'expanded-row';
  loadRow.innerHTML = `<td colspan="6"><div class="expand-skeleton">
    <div class="skel-cover"></div>
    <div class="skel-lines"><div></div><div></div><div></div></div>
  </div></td>`;
  tr.insertAdjacentElement('afterend', loadRow);

  const detail = await fetchDetail(recordIndex);

  const expandRow = document.createElement('tr');
  expandRow.className = 'expanded-row';
  const cid = `cover-${recordIndex}`;
  expandRow.innerHTML = `
    <td colspan="6">
      <div class="expanded-content">
        <div class="cover-wrap">
          <canvas id="${cid}" width="220" height="220"></canvas>
        </div>
        <div class="detail-info">
          <div class="detail-header">
            <div>
              <h3>${esc(detail.title)}</h3>
              <div class="artist-sub">${esc(detail.artist)} · <em>${esc(detail.album)}</em> · <span class="genre-badge">${esc(detail.genre)}</span></div>
              <p class="review">"${esc(detail.reviewText)}"</p>
              <div class="likes-row">${likesHtml(detail.likes)}</div>
            </div>
            <button class="play-btn" id="play-btn-${recordIndex}" title="Play preview">▶</button>
          </div>
          <div class="lyrics-container" id="lyrics-${recordIndex}">
            ${detail.lyrics.map((l,i) =>
              `<div class="lyric-line" data-time="${l.timeSeconds}" data-idx="${i}">${esc(l.text)}</div>`
            ).join('')}
          </div>
        </div>
      </div>
    </td>`;

  loadRow.replaceWith(expandRow);

  // Draw cover
  const canvas = document.getElementById(cid);
  const coverSeed = state.seed ^ (BigInt(recordIndex) * 2654435761n);
  CoverCanvas.drawCover(canvas, detail.title, detail.artist, coverSeed);

  // Play button
  const playBtn = document.getElementById(`play-btn-${recordIndex}`);
  playBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (state.playingIndex === recordIndex) {
      stopMusic();
    } else {
      stopMusic();
      startMusic(recordIndex, detail, playBtn);
    }
  });
}

async function startMusic(recordIndex, detail, playBtn) {
  state.playingIndex  = recordIndex;
  state.playingDetail = detail;
  state.playStartTime = performance.now() / 1000;
  playBtn.textContent = '⏹';
  playBtn.classList.add('playing');

  const src = `/api/songs/audio?${buildQuery({ recordIndex, pageSize: state.pageSize })}`;
  const audio = new Audio(src);
  state.playingAudio = audio;

  audio.addEventListener('ended', () => {
    if (state.playingIndex === recordIndex) {
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
      state.playingIndex = null;
      state.playingAudio = null;
      stopLyricsScroll();
    }
  });

  audio.addEventListener('error', () => {
    if (state.playingIndex === recordIndex) {
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
      state.playingIndex = null;
      state.playingAudio = null;
      stopLyricsScroll();
      alert('Audio preview failed to load.');
    }
  });

  try {
    await audio.play();
    startLyricsScroll(recordIndex, detail);
  } catch {
    playBtn.textContent = '▶';
    playBtn.classList.remove('playing');
    state.playingIndex = null;
    state.playingAudio = null;
    stopLyricsScroll();
  }
}

function stopMusic() {
  if (state.playingIndex !== null) {
    if (state.playingAudio) {
      state.playingAudio.pause();
      state.playingAudio.src = '';
      state.playingAudio = null;
    }
    const btn = document.getElementById(`play-btn-${state.playingIndex}`);
    if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
    state.playingIndex = null;
  }
  stopLyricsScroll();
}

// ── Lyrics scrolling ──────────────────────────────────────────────────────────
function startLyricsScroll(recordIndex, detail) {
  stopLyricsScroll();
  if (!detail.lyrics || detail.lyrics.length === 0) return;

  const container = document.getElementById(`lyrics-${recordIndex}`);
  if (!container) return;

  const startedAt = performance.now() / 1000;

  state.lyricsInterval = setInterval(() => {
    const elapsed = performance.now() / 1000 - startedAt;
    const lines = container.querySelectorAll('.lyric-line');

    let activeIdx = -1;
    lines.forEach((line, i) => {
      const t = parseFloat(line.dataset.time);
      if (elapsed >= t) activeIdx = i;
    });

    lines.forEach((line, i) => {
      line.classList.toggle('lyric-active',   i === activeIdx);
      line.classList.toggle('lyric-past',     i < activeIdx);
      line.classList.toggle('lyric-upcoming', i > activeIdx);
    });

    // Auto-scroll lyrics container
    if (activeIdx >= 0) {
      const activeLine = lines[activeIdx];
      if (activeLine) {
        const lineTop    = activeLine.offsetTop;
        const targetScroll = lineTop - container.clientHeight / 2 + activeLine.clientHeight / 2;
        container.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
    }
  }, 120);
}

function stopLyricsScroll() {
  if (state.lyricsInterval) {
    clearInterval(state.lyricsInterval);
    state.lyricsInterval = null;
  }
}

function renderPagination() {
  elPagination.innerHTML = '';
  const page = state.currentPage;
  const maxPages = 50;

  const prev = document.createElement('button');
  prev.textContent = '← Prev';
  prev.disabled = page <= 1;
  prev.addEventListener('click', () => loadTablePage(page - 1));
  elPagination.appendChild(prev);

  // Page number buttons (window of 5)
  const start = Math.max(1, page - 2);
  const end   = Math.min(maxPages, start + 4);
  for (let p = start; p <= end; p++) {
    const btn = document.createElement('button');
    btn.textContent = p;
    if (p === page) btn.classList.add('current-page');
    btn.addEventListener('click', () => loadTablePage(p));
    elPagination.appendChild(btn);
  }

  const next = document.createElement('button');
  next.textContent = 'Next →';
  next.disabled = page >= maxPages;
  next.addEventListener('click', () => loadTablePage(page + 1));
  elPagination.appendChild(next);
}

// ── Gallery View ──────────────────────────────────────────────────────────────
function resetGallery() {
  state.galleryPage      = 1;
  state.galleryExhausted = false;
  state.galleryLoading   = false;
  elGalView.innerHTML    = `<div id="gallery-loader" class="gallery-loader-cell">
    <span class="spinner"></span> Loading…</div>`;
  if (state.view === 'gallery') loadGalleryPage();
}

async function loadGalleryPage() {
  if (state.galleryLoading || state.galleryExhausted) return;
  state.galleryLoading = true;

  const loader = document.getElementById('gallery-loader');
  if (loader) loader.innerHTML = `<span class="spinner"></span> Loading…`;

  const data = await fetchPage(state.galleryPage);
  state.galleryPage++;
  state.galleryLoading = false;

  if (!data.records || data.records.length === 0) {
    state.galleryExhausted = true;
    if (loader) loader.textContent = 'End of catalogue.';
    return;
  }

  if (loader) loader.remove();
  for (const rec of data.records) {
    elGalView.insertBefore(buildGalleryCard(rec), document.getElementById('gallery-loader'));
  }

  const newLoader = document.createElement('div');
  newLoader.id        = 'gallery-loader';
  newLoader.className = 'gallery-loader-cell';
  elGalView.appendChild(newLoader);
  observeGalleryLoader();
}

function buildGalleryCard(rec) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  const cid = `gcard-${rec.index}`;
  card.innerHTML = `
    <div class="card-cover-wrap">
      <canvas id="${cid}" width="240" height="240"></canvas>
      <div class="card-play-overlay">▶</div>
    </div>
    <div class="card-body">
      <div class="card-index">#${rec.index}</div>
      <div class="card-title">${esc(rec.title)}</div>
      <div class="card-artist">${esc(rec.artist)}</div>
      <div class="card-meta">
        <span class="genre-badge small">${esc(rec.genre)}</span>
        <span class="card-likes">♥ ${rec.likes}</span>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    const canvas = document.getElementById(cid);
    if (canvas) {
      const approxSeed = BigInt(state.seed) ^ BigInt(rec.index) * 2654435761n;
      CoverCanvas.drawCover(canvas, rec.title, rec.artist, approxSeed);
    }
  });
  return card;
}

const galleryObserver = new IntersectionObserver(entries => {
  for (const e of entries)
    if (e.isIntersecting && state.view === 'gallery' && !state.galleryLoading)
      loadGalleryPage();
}, { rootMargin: '400px' });

function observeGalleryLoader() {
  const loader = document.getElementById('gallery-loader');
  if (loader) galleryObserver.observe(loader);
}

// ── Export (client-side WAV → ZIP via JSZip) ──────────────────────────────────
async function doExport() {
  elExportBtn.disabled   = true;
  elExportBtn.textContent = '⏳ Exporting…';

  try {
    const response = await fetch(`/api/songs/export-zip?${buildQuery({ page: state.currentPage, pageSize: state.pageSize })}`);
    if (!response.ok) throw new Error(`Export failed (${response.status})`);

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `musicstore-page${state.currentPage}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export failed:', err);
    alert('Export failed. See console for details.');
  }

  elExportBtn.disabled    = false;
  elExportBtn.textContent = '⬇ Export ZIP';
}

// ── View switching ────────────────────────────────────────────────────────────
function switchView(view) {
  state.view = view;
  if (view === 'table') {
    elTableView.classList.remove('hidden');
    elGalView.classList.add('hidden');
    elViewTable.classList.add('active');
    elViewGal.classList.remove('active');
  } else {
    elTableView.classList.add('hidden');
    elGalView.classList.remove('hidden');
    elViewGal.classList.add('active');
    elViewTable.classList.remove('active');
    observeGalleryLoader();
  }
}

// ── Parameter change ──────────────────────────────────────────────────────────
function onParamsChanged() {
  stopMusic();
  if (state.view === 'table') loadTablePage(1);
  resetGallery();
}

// ── Event listeners ───────────────────────────────────────────────────────────
elLocale.addEventListener('change',  () => { state.locale = elLocale.value; onParamsChanged(); });
elSeed.addEventListener('input',     () => {
  const parsed = parseSeedInput(elSeed.value);
  if (parsed === null) return;
  state.seed = parsed;
  if (elSeed.value.trim() !== parsed.toString()) {
    elSeed.value = parsed.toString();
  }
  onParamsChanged();
});
elRandSeed.addEventListener('click', () => {
  const r = randomBigInt64(); state.seed = r; elSeed.value = r.toString(); onParamsChanged();
});
elLikes.addEventListener('input', () => {
  state.likesPerSong = parseFloat(elLikes.value);
  elLikesVal.textContent = state.likesPerSong.toFixed(1);
  onParamsChanged();
});
elViewTable.addEventListener('click', () => switchView('table'));
elViewGal.addEventListener('click',   () => switchView('gallery'));
elExportBtn.addEventListener('click', doExport);

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const localesData = await (await fetch('/api/songs/locales')).json();
  state.locales = localesData;
  elLocale.innerHTML = localesData
    .map(l => `<option value="${l.locale}">${l.displayName}</option>`)
    .join('');
  elLocale.value    = state.locale;
  elSeed.value      = state.seed.toString();
  elLikes.value     = state.likesPerSong;
  elLikesVal.textContent = state.likesPerSong.toFixed(1);

  switchView('table');
  await loadTablePage(1);
  resetGallery();
}

init();
