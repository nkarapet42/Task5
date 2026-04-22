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

async function fetchExportManifest(page) {
  const r = await fetch(`/api/songs/export-manifest?${buildQuery({ page, pageSize: state.pageSize })}`);
  return r.json();
}

function likesHtml(count) {
  let d = '';
  for (let i = 0; i < 10; i++)
    d += `<span class="like-dot${i < count ? '' : ' empty'}"></span>`;
  return `<span class="likes-dots" title="${count} likes">${d}</span>`;
}

function randomBigInt64() {
  return (BigInt(Math.floor(Math.random()*0x100000000)) << 32n)
       | BigInt(Math.floor(Math.random()*0x100000000));
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
  CoverCanvas.drawCover(canvas, detail.title, detail.artist, detail.audioSeed);

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

function startMusic(recordIndex, detail, playBtn) {
  state.playingIndex  = recordIndex;
  state.playingDetail = detail;
  state.playStartTime = Tone.now();
  playBtn.textContent = '⏹';
  playBtn.classList.add('playing');

  AudioEngine.play(detail.audioSeed, () => {
    if (state.playingIndex === recordIndex) {
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
      state.playingIndex = null;
      stopLyricsScroll();
    }
  });

  startLyricsScroll(recordIndex, detail);
}

function stopMusic() {
  if (state.playingIndex !== null) {
    AudioEngine.stop();
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
    const manifest = await fetchExportManifest(state.currentPage);
    const zip = new JSZip();

    for (const song of manifest) {
      // Render audio offline using OfflineAudioContext (WAV-like PCM)
      const wavData = await renderAudioToWav(song.audioSeed, song.durationSeconds);
      zip.file(song.fileName.replace(/\.wav$/, '') + '.wav', wavData);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
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

async function renderAudioToWav(audioSeed, durationSeconds) {
  const sampleRate = 44100;
  const duration   = Math.max(2, Math.min(durationSeconds + 1, 45));
  const offCtx     = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);

  // Use a stripped-down version of the audio engine for offline rendering
  const rand = mkRngExport(audioSeed);

  const SCALES_EXP = {
    major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10],
    pentatonic:[0,2,4,7,9]
  };
  const scaleNames = Object.keys(SCALES_EXP);
  const scale = SCALES_EXP[scaleNames[Math.floor(rand() * scaleNames.length)]];
  const rootMidi = 48 + Math.floor(rand() * 12);
  const bpm = 80 + Math.floor(rand() * 60);
  const beatDur = 60 / bpm;
  const numBars = 20, beatsPerBar = 4, totalBeats = numBars * beatsPerBar;

  const masterGain = offCtx.createGain();
  masterGain.gain.value = 0.55;
  masterGain.connect(offCtx.destination);

  function midiHz(m) { return 440 * Math.pow(2, (m-69)/12); }

  function osc(type, freq, gainVal, t, dur) {
    const o = offCtx.createOscillator();
    const g = offCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainVal, t + 0.02);
    g.gain.setValueAtTime(gainVal, t + dur - 0.04);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + dur + 0.01);
  }

  const PROGS = [[0,5,3,4],[0,3,4,0],[0,4,5,3]];
  const prog  = PROGS[Math.floor(rand() * PROGS.length)];

  for (let bar = 0; bar < numBars; bar++) {
    const deg = prog[bar % prog.length];
    for (let beat = 0; beat < beatsPerBar; beat++) {
      const t = bar * beatsPerBar * beatDur + beat * beatDur + 0.05;
      // Chord pad
      if (beat === 0) {
        [0,2,4].forEach(d => {
          const midi = rootMidi + scale[(deg+d) % scale.length];
          osc('sine', midiHz(midi), 0.1, t, beatDur * beatsPerBar * 0.9);
        });
      }
      // Bass
      if ((beat === 0 || beat === 2) && rand() < 0.8) {
        const midi = rootMidi + scale[deg % scale.length] - 12;
        osc('sawtooth', midiHz(midi), 0.15, t, beatDur * 0.6);
      }
      // Melody
      if (rand() < 0.45) {
        const si = Math.floor(rand() * scale.length);
        osc('triangle', midiHz(rootMidi + scale[si] + 12), 0.07, t, beatDur * 0.35);
      }
      // Kick
      if (beat % 2 === 0) {
        const ko = offCtx.createOscillator();
        const kg = offCtx.createGain();
        ko.frequency.setValueAtTime(150, t);
        ko.frequency.exponentialRampToValueAtTime(40, t+0.12);
        kg.gain.setValueAtTime(0.7, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t+0.25);
        ko.connect(kg); kg.connect(masterGain);
        ko.start(t); ko.stop(t+0.3);
      }
    }
  }

  const rendered = await offCtx.startRendering();
  return audioBufferToWav(rendered);
}

function mkRngExport(seed) {
  let s = (Number(seed) & 0x7FFFFFFF) >>> 0 || 1;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate  = buffer.sampleRate;
  const numSamples  = buffer.length;
  const bytesPerSample = 2;
  const dataSize = numChannels * numSamples * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  writeStr(0, 'RIFF');
  view.setUint32(4,  36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return ab;
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
  try { state.seed = BigInt(elSeed.value.trim() || '0'); onParamsChanged(); } catch(e){}
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
