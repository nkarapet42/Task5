// ── Professional Album Cover Generator ───────────────────────────────────────
const CoverCanvas = (() => {

  // Mulberry32 seeded RNG
  function mkRng(seed) {
    let s = seed >>> 0;
    return () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hsl(h, s, l, a = 1) {
    return `hsla(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%,${a})`;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── Background styles ──────────────────────────────────────────────────────
  function drawBg(ctx, size, rand) {
    const style = Math.floor(rand() * 7);
    const h1 = rand() * 360;
    const h2 = h1 + 40 + rand() * 150;
    const h3 = h2 + 40 + rand() * 80;

    if (style === 0) {
      // Deep diagonal gradient
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0,   hsl(h1, 80, 12));
      g.addColorStop(0.4, hsl(h2, 75, 20));
      g.addColorStop(1,   hsl(h3, 70, 8));
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      addNoise(ctx, size, rand, 0.04);

    } else if (style === 1) {
      // Radial glow
      const g = ctx.createRadialGradient(size*0.4, size*0.35, size*0.05, size*0.5, size*0.5, size*0.9);
      g.addColorStop(0,   hsl(h1, 90, 55));
      g.addColorStop(0.35,hsl(h2, 80, 22));
      g.addColorStop(1,   hsl(h3, 60, 5));
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      addNoise(ctx, size, rand, 0.03);

    } else if (style === 2) {
      // Layered color blocks (Mondrian-ish)
      ctx.fillStyle = hsl(h1, 50, 10);
      ctx.fillRect(0, 0, size, size);
      const blockCount = 4 + Math.floor(rand() * 4);
      for (let i = 0; i < blockCount; i++) {
        const bx = rand() * size * 0.8;
        const by = rand() * size * 0.8;
        const bw = size * (0.2 + rand() * 0.6);
        const bh = size * (0.2 + rand() * 0.6);
        ctx.fillStyle = hsl(h1 + rand() * 120, 60 + rand() * 30, 15 + rand() * 35, 0.7 + rand() * 0.3);
        ctx.fillRect(bx, by, bw, bh);
      }
      addNoise(ctx, size, rand, 0.05);

    } else if (style === 3) {
      // Aurora / wave bands
      ctx.fillStyle = hsl(h3, 60, 5);
      ctx.fillRect(0, 0, size, size);
      for (let band = 0; band < 8; band++) {
        const yBase = (band / 8) * size + rand() * 30 - 15;
        const path = new Path2D();
        path.moveTo(0, size);
        path.lineTo(0, yBase);
        for (let x = 0; x <= size; x += size / 20) {
          const y = yBase + Math.sin((x / size) * Math.PI * (2 + rand() * 3) + band) * (size * 0.08);
          path.lineTo(x, y);
        }
        path.lineTo(size, size);
        path.closePath();
        ctx.fillStyle = hsl(h1 + band * 12, 80, 30 + band * 4, 0.15 + rand() * 0.12);
        ctx.fill(path);
      }

    } else if (style === 4) {
      // Geometric — concentric shapes
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, hsl(h1, 70, 8));
      g.addColorStop(1, hsl(h2, 65, 15));
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      const cx = size / 2, cy = size * 0.42;
      const steps = 6 + Math.floor(rand() * 5);
      for (let i = steps; i >= 0; i--) {
        const r = (i / steps) * size * 0.65;
        ctx.beginPath();
        const sides = 3 + Math.floor(rand() * 4);
        for (let s = 0; s < sides; s++) {
          const angle = (s / sides) * Math.PI * 2 - Math.PI / 2 + i * 0.15;
          s === 0 ? ctx.moveTo(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r)
                  : ctx.lineTo(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r);
        }
        ctx.closePath();
        ctx.strokeStyle = hsl(h1 + i*15, 75, 40 + i*3, 0.25);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      addNoise(ctx, size, rand, 0.03);

    } else if (style === 5) {
      // Halftone dots
      ctx.fillStyle = hsl(h1, 60, 8);
      ctx.fillRect(0, 0, size, size);
      const dotGrid = 18;
      const cell = size / dotGrid;
      for (let row = 0; row < dotGrid; row++) {
        for (let col = 0; col < dotGrid; col++) {
          const dx = col * cell + cell / 2;
          const dy = row * cell + cell / 2;
          const dist = Math.hypot(dx - size/2, dy - size*0.4) / (size * 0.7);
          const r = (cell * 0.48) * (1 - dist * 0.6);
          if (r < 1) continue;
          ctx.beginPath();
          ctx.arc(dx, dy, r, 0, Math.PI * 2);
          ctx.fillStyle = hsl(h2 + dist * 60, 70, 35 + dist * 20, 0.6 + dist * 0.3);
          ctx.fill();
        }
      }

    } else {
      // Double exposure style — two overlapping radial gradients
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, size, size);
      const g1 = ctx.createRadialGradient(size*0.3, size*0.3, 0, size*0.3, size*0.3, size*0.7);
      g1.addColorStop(0, hsl(h1, 90, 50, 0.9));
      g1.addColorStop(1, hsl(h1, 80, 10, 0));
      ctx.fillStyle = g1; ctx.fillRect(0, 0, size, size);
      const g2 = ctx.createRadialGradient(size*0.7, size*0.65, 0, size*0.7, size*0.65, size*0.65);
      g2.addColorStop(0, hsl(h3, 90, 45, 0.85));
      g2.addColorStop(1, hsl(h3, 70, 8, 0));
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = g2; ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
      addNoise(ctx, size, rand, 0.04);
    }
  }

  function addNoise(ctx, size, rand, amount) {
    // Lightweight grain using tiny random rects
    ctx.save();
    ctx.globalAlpha = amount;
    for (let i = 0; i < size * size * 0.004; i++) {
      const x = rand() * size, y = rand() * size;
      const v = rand() * 255 | 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();
  }

  // ── Decorative elements ────────────────────────────────────────────────────
  function drawDecoration(ctx, size, rand) {
    const type = Math.floor(rand() * 4);
    ctx.save();
    ctx.globalAlpha = 0.12 + rand() * 0.1;

    if (type === 0) {
      // Thin horizontal lines
      const count = 3 + Math.floor(rand() * 5);
      for (let i = 0; i < count; i++) {
        const y = rand() * size * 0.55;
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(size, y);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = rand() < 0.3 ? 2 : 0.5;
        ctx.stroke();
      }
    } else if (type === 1) {
      // Corner bracket
      const margin = size * 0.06;
      const len = size * 0.12;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      [[margin, margin, 1, 1],[size-margin, margin, -1, 1]].forEach(([x, y, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(x + dx*len, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy*len);
        ctx.stroke();
      });
    } else if (type === 2) {
      // Circle ring
      ctx.beginPath();
      ctx.arc(size/2, size*0.38, size*0.3, 0, Math.PI*2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // type 3 = no decoration
    ctx.restore();
  }

  // ── Text rendering ─────────────────────────────────────────────────────────
  function drawText(ctx, size, title, artist, rand) {
    // Dark gradient overlay for readability
    const overlay = ctx.createLinearGradient(0, size * 0.42, 0, size);
    overlay.addColorStop(0, 'rgba(0,0,0,0)');
    overlay.addColorStop(0.35, 'rgba(0,0,0,0.55)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, size, size);

    const margin = size * 0.07;
    const bottomPad = size * 0.06;
    const layoutStyle = Math.floor(rand() * 3);

    if (layoutStyle === 0) {
      // Classic: big title, small artist below
      const titleSize = clampFont(size / 8.5, 13, 24);
      const artistSize = clampFont(size / 13, 10, 16);

      // Artist line (smaller, top of text block)
      ctx.font = `400 ${artistSize}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
      ctx.letterSpacing = '0.12em';
      ctx.fillText(artist.toUpperCase(), margin, size - bottomPad - titleSize * 1.5 - artistSize * 0.3);

      // Title (bold, larger)
      ctx.font = `700 ${titleSize}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.letterSpacing = '0em';
      wrapText(ctx, title, margin, size - bottomPad, size - margin * 2, titleSize * 1.18, 2);

    } else if (layoutStyle === 1) {
      // Stacked: artist upper left small, title big centered-ish
      const titleSize = clampFont(size / 7.5, 14, 26);
      const artistSize = clampFont(size / 14, 9, 15);

      ctx.font = `300 ${artistSize}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
      ctx.fillText(artist, margin, size - bottomPad - titleSize * 2.6);

      ctx.font = `800 ${titleSize}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 12;
      wrapText(ctx, title.toUpperCase(), margin, size - bottomPad, size - margin * 2, titleSize * 1.2, 2);

    } else {
      // Minimal: only title, very large, artist tiny at very bottom
      const titleSize = clampFont(size / 7, 15, 28);
      const artistSize = clampFont(size / 16, 9, 14);

      ctx.font = `900 ${titleSize}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 14;
      wrapText(ctx, title, margin, size - bottomPad - artistSize * 2, size - margin * 2, titleSize * 1.15, 2);

      ctx.font = `300 ${artistSize}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(artist.toUpperCase(), margin, size - bottomPad * 0.5);
    }

    ctx.shadowBlur = 0;
    ctx.letterSpacing = '0em';
  }

  function clampFont(size, min, max) { return Math.max(min, Math.min(max, size)); }

  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = text.split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = word;
        if (lines.length >= maxLines) break;
      } else { line = test; }
    }
    if (line && lines.length < maxLines) lines.push(line);
    const startY = y - (lines.length - 1) * lineH;
    lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineH));
  }

  // ── Public draw function ───────────────────────────────────────────────────
  function drawCover(canvas, title, artist, audioSeed) {
    const size = canvas.width;
    const ctx = canvas.getContext('2d');
    const rand = mkRng(Number(audioSeed) & 0x7FFFFFFF);

    ctx.clearRect(0, 0, size, size);
    drawBg(ctx, size, rand);
    drawDecoration(ctx, size, rand);
    drawText(ctx, size, title, artist, rand);
  }

  return { drawCover };
})();
