/* MOMENTO — canvas artwork engine. All rendering happens on the device. */
(function () {
  'use strict';

  const W = 1320;
  const H = 2868;
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const { STYLES } = window.MOMENTO_PRESETS;

  const FONTS = {
    serif: '"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif',
    song: '"Songti SC","STSong","SimSun",serif',
    hand: '"Snell Roundhand","Segoe Script","Bradley Hand","Segoe Print","Ink Free",cursive',
    copper: '"Baskerville","Palatino Linotype",Palatino,Georgia,serif',
    type: '"Courier New","American Typewriter","Courier",monospace',
    sans: '"Avenir Next","Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'
  };

  const CAPTION_FONT = {
    japanese: 'italic 30px ' + FONTS.hand,
    american: '700 26px ' + FONTS.type,
    gothic: 'italic 31px ' + FONTS.copper,
    french: 'italic 33px ' + FONTS.hand
  };

  /* ------------------------------------------------------------------ */
  /* small utilities                                                     */
  /* ------------------------------------------------------------------ */

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rgba(hex, alpha) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    const n = parseInt(c, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function mixHex(a, b, t) {
    const p = (h) => {
      const c = h.replace('#', '');
      const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const ca = p(a);
    const cb = p(b);
    const out = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
    return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function rrPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function fillRR(ctx, x, y, w, h, r, fill) {
    rrPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function ellipsePath(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU);
  }

  function scallopPath(ctx, x, y, w, h, radius) {
    const nx = Math.max(3, Math.round(w / (radius * 2)));
    const ny = Math.max(3, Math.round(h / (radius * 2)));
    const sx = w / nx;
    const sy = h / ny;
    const rx = sx / 2;
    const ry = sy / 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < nx; i++) {
      ctx.arc(x + sx * i + rx, y, rx, Math.PI, 0, true);
    }
    for (let i = 0; i < ny; i++) {
      ctx.arc(x + w, y + sy * i + ry, ry, -Math.PI / 2, Math.PI / 2, false);
    }
    for (let i = 0; i < nx; i++) {
      ctx.arc(x + w - sx * i - rx, y + h, rx, 0, Math.PI, false);
    }
    for (let i = 0; i < ny; i++) {
      ctx.arc(x, y + h - sy * i - ry, ry, Math.PI / 2, Math.PI * 1.5, false);
    }
    ctx.closePath();
  }

  function tornPath(ctx, x, y, w, h, rng, jitter) {
    const j = jitter || 4;
    const stepX = Math.max(10, w / Math.round(w / 22));
    const stepY = Math.max(10, h / Math.round(h / 22));
    ctx.beginPath();
    ctx.moveTo(x + (rng() - 0.5) * j, y + (rng() - 0.5) * j);
    for (let px = x + stepX; px < x + w; px += stepX) {
      ctx.lineTo(px, y + (rng() - 0.5) * j);
    }
    ctx.lineTo(x + w, y + (rng() - 0.5) * j);
    for (let py = y + stepY; py < y + h; py += stepY) {
      ctx.lineTo(x + w + (rng() - 0.5) * j, py);
    }
    ctx.lineTo(x + w, y + h);
    for (let px = x + w - stepX; px > x; px -= stepX) {
      ctx.lineTo(px, y + h + (rng() - 0.5) * j);
    }
    ctx.lineTo(x, y + h);
    for (let py = y + h - stepY; py > y; py -= stepY) {
      ctx.lineTo(x + (rng() - 0.5) * j, py);
    }
    ctx.closePath();
  }

  function trackedText(ctx, text, x, y, spacing, align) {
    const chars = Array.from(text);
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
    let cursor = x;
    if (align === 'center') cursor = x - total / 2;
    if (align === 'right') cursor = x - total;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cursor, y);
      cursor += widths[i] + spacing;
    }
    return total;
  }

  function tokenize(text) {
    return text.match(/[A-Za-z0-9_'’\-.,!?&+:/]+|\s+|./g) || [];
  }

  function wrapText(ctx, text, maxWidth) {
    const tokens = tokenize(text);
    const lines = [];
    let line = '';
    for (const token of tokens) {
      if (token === '\n') {
        lines.push(line.trim());
        line = '';
        continue;
      }
      const candidate = line + token;
      if (ctx.measureText(candidate.trim()).width > maxWidth && line.trim()) {
        lines.push(line.trim());
        line = token.trimStart();
      } else {
        line = candidate;
      }
      if (ctx.measureText(line.trim()).width > maxWidth && line.trim().length > 1) {
        const chars = Array.from(line.trim());
        let part = '';
        for (const ch of chars) {
          if (ctx.measureText(part + ch).width > maxWidth && part) {
            lines.push(part);
            part = ch;
          } else {
            part += ch;
          }
        }
        line = part;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function drawCover(ctx, source, x, y, w, h, focusX, focusY) {
    const sw = source.width || source.videoWidth;
    const sh = source.height || source.videoHeight;
    if (!sw || !sh || w <= 0 || h <= 0) return;
    const sourceRatio = sw / sh;
    const targetRatio = w / h;
    let cw;
    let ch;
    let cx;
    let cy;
    if (sourceRatio > targetRatio) {
      ch = sh;
      cw = ch * targetRatio;
      cx = (sw - cw) * (focusX == null ? 0.5 : focusX);
      cy = 0;
    } else {
      cw = sw;
      ch = cw / targetRatio;
      cx = 0;
      cy = (sh - ch) * (focusY == null ? 0.5 : focusY);
    }
    ctx.drawImage(source, cx, cy, cw, ch, x, y, w, h);
  }

  function radialGlow(ctx, x, y, r, inner, outer) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawSparkle(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
    ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
    ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
    ctx.fill();
    ctx.restore();
  }

  function drawHeart(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0.9);
    ctx.bezierCurveTo(-1.35, 0.05, -0.75, -0.95, 0, -0.4);
    ctx.bezierCurveTo(0.75, -0.95, 1.35, 0.05, 0, 0.9);
    ctx.fill();
    ctx.restore();
  }

  function drawDash(ctx, x1, y1, x2, y2, color, width, dash) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || [10, 12]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawArrow(ctx, points, color, width) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = Math.atan2(points[points.length - 1][1] - points[points.length - 2][1], points[points.length - 1][0] - points[points.length - 2][0]);
    const tx = points[points.length - 1][0];
    const ty = points[points.length - 1][1];
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - Math.cos(a - 0.55) * 24, ty - Math.sin(a - 0.55) * 24);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - Math.cos(a + 0.55) * 24, ty - Math.sin(a + 0.55) * 24);
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* paper background                                                    */
  /* ------------------------------------------------------------------ */

  function drawBackground(ctx, style, rng) {
    const p = style.palette;
    const g = ctx.createLinearGradient(0, 0, W * 0.9, H);
    g.addColorStop(0, p.paperLight);
    g.addColorStop(0.42, p.paper);
    g.addColorStop(1, p.paperDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (style.id === 'japanese') {
      radialGlow(ctx, W * 0.88, H * 0.1, W * 0.9, 'rgba(255, 236, 199, .6)', 'rgba(255, 236, 199, 0)');
      radialGlow(ctx, W * 0.18, H * 0.75, W * 0.72, 'rgba(255, 255, 255, .16)', 'rgba(255, 255, 255, 0)');
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#d99572';
      ctx.beginPath();
      ctx.arc(W * 0.82, H * 0.17, W * 0.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (style.id === 'american') {
      radialGlow(ctx, W * 0.82, H * 0.08, W * 0.8, 'rgba(255, 232, 181, .38)', 'rgba(255, 232, 181, 0)');
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = p.ink;
      for (let y = 0; y < H; y += 26) {
        for (let x = 0; x < W; x += 26) {
          ctx.beginPath();
          ctx.arc(x + (y % 52 === 0 ? 0 : 13), y, 1.7, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.save();
      ctx.translate(W * 0.12, H * 0.12);
      ctx.rotate(-10 * DEG);
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = p.accent;
      ctx.font = '700 230px ' + FONTS.serif;
      ctx.fillText('SUMMER', 0, 0);
      ctx.restore();
    }

    if (style.id === 'gothic') {
      radialGlow(ctx, W * 0.27, H * 0.12, W * 0.58, 'rgba(230, 224, 206, .26)', 'rgba(230, 224, 206, 0)');
      radialGlow(ctx, W * 0.76, H * 0.49, W * 0.7, 'rgba(10, 9, 8, .45)', 'rgba(10, 9, 8, 0)');
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#d7c9ad';
      ctx.lineWidth = 2;
      for (let i = 0; i < 22; i++) {
        const x = rng() * W;
        const y = H * 0.3 + rng() * H * 0.7;
        ctx.beginPath();
        ctx.arc(x, y, 1 + rng() * 3, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (style.id === 'french') {
      radialGlow(ctx, W * 0.76, H * 0.06, W * 0.9, 'rgba(255, 250, 240, .55)', 'rgba(255, 250, 240, 0)');
      radialGlow(ctx, W * 0.1, H * 0.6, W * 0.55, 'rgba(230, 183, 189, .18)', 'rgba(230, 183, 189, 0)');
      ctx.save();
      ctx.globalAlpha = 0.055;
      ctx.fillStyle = '#fffdf8';
      for (let i = 0; i < 7; i++) {
        const x = 80 + i * 190;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 120, H);
        ctx.lineTo(x + 260, H);
        ctx.lineTo(x + 140, 0);
        ctx.fill();
      }
      ctx.restore();
    }

    // paper fibres
    const fiberCount = 1600;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < fiberCount; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const len = 4 + rng() * 34;
      const a = (rng() - 0.5) * 0.55;
      ctx.strokeStyle = rng() > 0.52
        ? rgba(style.id === 'gothic' ? '#efe4cf' : '#ffffff', 0.025 + rng() * 0.04)
        : rgba(style.id === 'gothic' ? '#0d0c0a' : p.ink, 0.018 + rng() * 0.028);
      ctx.lineWidth = 0.6 + rng() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.35);
      ctx.stroke();
    }
    ctx.restore();

    // flecks
    ctx.save();
    for (let i = 0; i < 900; i++) {
      const x = rng() * W;
      const y = rng() * H;
      ctx.fillStyle = rng() > 0.5
        ? rgba(style.id === 'gothic' ? '#d8c9ae' : p.ink, 0.02 + rng() * 0.05)
        : rgba(style.id === 'gothic' ? '#050505' : '#ffffff', 0.03 + rng() * 0.06);
      ctx.beginPath();
      ctx.arc(x, y, 0.5 + rng() * 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // soft stains
    for (let i = 0; i < 3; i++) {
      const x = (0.18 + rng() * 0.7) * W;
      const y = (0.1 + rng() * 0.8) * H;
      const r = 100 + rng() * 220;
      radialGlow(ctx, x, y, r, rgba(style.id === 'gothic' ? '#c4ae86' : p.inkSoft, 0.035), rgba(style.id === 'gothic' ? '#c4ae86' : p.inkSoft, 0));
    }

    // centre fold
    const fold = ctx.createLinearGradient(W * 0.5 - 46, 0, W * 0.5 + 46, 0);
    fold.addColorStop(0, 'rgba(40,30,20,0)');
    fold.addColorStop(0.5, style.id === 'gothic' ? 'rgba(255,245,225,.03)' : 'rgba(70,50,30,.055)');
    fold.addColorStop(1, 'rgba(40,30,20,0)');
    ctx.fillStyle = fold;
    ctx.fillRect(W * 0.5 - 46, 0, 92, H);

    // edge vignette
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.48, W * 0.22, W * 0.5, H * 0.48, H * 0.66);
    vg.addColorStop(0, 'rgba(20,14,8,0)');
    vg.addColorStop(0.74, style.id === 'gothic' ? 'rgba(8,7,6,.22)' : 'rgba(58,39,22,.04)');
    vg.addColorStop(1, style.id === 'gothic' ? 'rgba(4,4,4,.66)' : 'rgba(58,39,22,.24)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------------ */
  /* paper scraps and tape                                               */
  /* ------------------------------------------------------------------ */

  function drawGingham(ctx, w, h, colorA, colorB, cell, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colorB;
    for (let x = 0; x < w; x += cell * 2) ctx.fillRect(x, 0, cell, h);
    for (let y = 0; y < h; y += cell * 2) ctx.fillRect(0, y, w, cell);
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#ffffff';
    for (let x = cell; x < w; x += cell * 2) ctx.fillRect(x, 0, cell, h);
    for (let y = cell; y < h; y += cell * 2) ctx.fillRect(0, y, w, cell);
    ctx.restore();
  }

  function drawTinyFlower(ctx, x, y, r, petal, center, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = petal;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.cos(i * TAU / 5) * r * 0.7, Math.sin(i * TAU / 5) * r * 0.7, r * 0.55, r * 0.4, i * TAU / 5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = center;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawScraps(ctx, style, rng, safe) {
    const p = style.palette;
    const sets = {
      japanese: [
        { x: 0.07, y: 0.21, w: 0.26, h: 0.075, rot: -11, color: '#d9be9a' },
        { x: 0.76, y: 0.34, w: 0.25, h: 0.09, rot: 7, color: '#e7c4ae' },
        { x: 0.04, y: 0.66, w: 0.19, h: 0.13, rot: 6, color: '#b7c4b1' },
        { x: 0.82, y: 0.87, w: 0.25, h: 0.085, rot: -8, color: '#e7d3b8' },
        { x: 0.36, y: 0.93, w: 0.23, h: 0.06, rot: 2, color: '#ddb79f' }
      ],
      american: [
        { x: 0.05, y: 0.19, w: 0.28, h: 0.08, rot: -7, color: '#c85542' },
        { x: 0.73, y: 0.26, w: 0.25, h: 0.13, rot: 9, color: '#b9c7bf', gingham: true },
        { x: 0.04, y: 0.71, w: 0.28, h: 0.12, rot: -3, color: '#f0e2c5' },
        { x: 0.74, y: 0.84, w: 0.24, h: 0.1, rot: 5, color: '#e2b75e' },
        { x: 0.33, y: 0.94, w: 0.3, h: 0.055, rot: -1, color: '#d8c09c' }
      ],
      gothic: [
        { x: 0.04, y: 0.18, w: 0.28, h: 0.12, rot: -6, color: '#b7a486' },
        { x: 0.72, y: 0.22, w: 0.26, h: 0.1, rot: 8, color: '#4b4238' },
        { x: 0.02, y: 0.7, w: 0.24, h: 0.15, rot: 4, color: '#5a2f2c' },
        { x: 0.79, y: 0.82, w: 0.22, h: 0.12, rot: -9, color: '#a99576' },
        { x: 0.38, y: 0.95, w: 0.3, h: 0.05, rot: 1, color: '#211f1c' }
      ],
      french: [
        { x: 0.06, y: 0.2, w: 0.26, h: 0.09, rot: -8, color: '#d9b9bd' },
        { x: 0.72, y: 0.3, w: 0.26, h: 0.15, rot: 7, color: '#e8d8c7', floral: true },
        { x: 0.03, y: 0.68, w: 0.2, h: 0.12, rot: 5, color: '#b9c4cc' },
        { x: 0.8, y: 0.86, w: 0.24, h: 0.09, rot: -6, color: '#e3c9cb' },
        { x: 0.37, y: 0.93, w: 0.25, h: 0.055, rot: 2, color: '#d8c5b5' }
      ]
    };
    const list = sets[style.id];
    for (const s of list) {
      const w = s.w * W;
      const h = s.h * H;
      const cx = s.x * W + w / 2;
      const cy = s.y * H + h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.rot * DEG);
      ctx.shadowColor = 'rgba(30,20,12,.2)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 10;
      tornPath(ctx, -w / 2, -h / 2, w, h, rng, 5);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.clip();
      if (s.gingham) drawGingham(ctx, w, h, '#e8ddc4', s.color, 22, 0.55);
      if (s.floral) {
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 8; i++) {
          drawTinyFlower(ctx, -w / 2 + 25 + rng() * (w - 50), -h / 2 + 20 + rng() * (h - 40), 13 + rng() * 8, '#9fabb7', '#f6e8d4', 0.85);
        }
      }
      if (style.id === 'japanese') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#fffaf0';
        for (let x = -w / 2 + 12; x < w / 2; x += 26) {
          for (let y = -h / 2 + 10; y < h / 2; y += 22) {
            ctx.beginPath();
            ctx.arc(x + (y % 44 === 0 ? 8 : 0), y, 1.5, 0, TAU);
            ctx.fill();
          }
        }
      }
      if (style.id === 'gothic') {
        const paleScrap = s.color === '#b7a486' || s.color === '#a99576';
        const printInk = paleScrap ? 'rgba(57,43,32,.34)' : 'rgba(220,207,184,.27)';
        ctx.save();
        ctx.strokeStyle = printInk;
        ctx.fillStyle = printInk;
        ctx.lineWidth = 1.5;
        // a faded botanical plate, so parchment scraps never read as empty UI cards
        for (let b = 0; b < 2; b++) {
          const bx = -w * 0.16 + b * w * 0.3;
          const by = h * 0.3;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.bezierCurveTo(bx - w * 0.03, by - h * 0.12, bx + w * 0.08, by - h * 0.24, bx + w * 0.02, by - h * 0.38);
          ctx.stroke();
          for (let l = 0; l < 4; l++) {
            const ly = by - h * (0.08 + l * 0.07);
            const dir = l % 2 ? 1 : -1;
            ctx.beginPath();
            ctx.ellipse(bx + dir * w * 0.035, ly, w * 0.055, h * 0.018, dir * 0.5, 0, TAU);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 0.4;
        ctx.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
        ctx.globalAlpha = 0.55;
        ctx.font = 'italic 21px ' + FONTS.copper;
        ctx.textAlign = 'center';
        ctx.fillText('ex libris', 0, h / 2 - 20);
        ctx.restore();
      }
      if (style.id === 'american' && !s.gingham) {
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = '#fff7e8';
        ctx.lineWidth = 3;
        for (let i = -h; i < w; i += 18) {
          ctx.beginPath();
          ctx.moveTo(i, -h / 2);
          ctx.lineTo(i + h, h / 2);
          ctx.stroke();
        }
      }
      // a slightly lighter torn edge
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 1.5;
      tornPath(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, rng, 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  function tapePath(ctx, w, h, rng) {
    const x = -w / 2;
    const y = -h / 2;
    const zig = 8;
    ctx.beginPath();
    ctx.moveTo(x, y + rng() * 4);
    ctx.lineTo(x + zig, y + 2 + rng() * 3);
    ctx.lineTo(x, y + h * 0.35);
    ctx.lineTo(x + zig * 0.8, y + h * 0.65);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h - rng() * 3);
    ctx.lineTo(x + w - zig * 0.8, y + h * 0.68);
    ctx.lineTo(x + w, y + h * 0.34);
    ctx.lineTo(x + w - zig, y + 2);
    ctx.closePath();
  }

  function drawTape(ctx, x, y, w, h, rot, style, rng, opts) {
    const p = style.palette;
    const options = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = options.alpha == null ? 1 : options.alpha;
    ctx.shadowColor = 'rgba(35,24,15,.18)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    tapePath(ctx, w, h, rng);
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    tapePath(ctx, w, h, rng);
    ctx.clip();

    if (style.id === 'japanese') {
      ctx.fillStyle = options.color || p.tape;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = 'rgba(255,250,242,.6)';
      for (let px = -w / 2 + 14; px < w / 2; px += 32) {
        for (let py = -h / 2 + 12; py < h / 2; py += 24) {
          ctx.beginPath();
          ctx.arc(px + (py % 48 === 0 ? 7 : 0), py, 2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.strokeStyle = 'rgba(255,250,242,.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h * 0.25);
      ctx.lineTo(w / 2, -h * 0.25);
      ctx.stroke();
    } else if (style.id === 'american') {
      ctx.fillStyle = options.color || '#f3e5c9';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.save();
      ctx.rotate(-38 * DEG);
      ctx.fillStyle = options.stripe || p.accent;
      for (let px = -w * 1.5; px < w * 1.5; px += 36) {
        ctx.fillRect(px, -h * 1.4, 18, h * 2.8);
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,245,225,.42)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
    } else if (style.id === 'gothic') {
      ctx.fillStyle = options.color || '#121110';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(225,211,185,.36)';
      ctx.lineWidth = 1.2;
      for (let px = -w / 2 + 12; px < w / 2; px += 22) {
        ctx.beginPath();
        ctx.arc(px, -h / 2 + 6, 8, 0, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, h / 2 - 6, 8, Math.PI, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, 0, 2, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#b7a78e';
      for (let px = -w / 2 + 18; px < w / 2; px += 44) {
        ctx.beginPath();
        ctx.arc(px, -h * 0.18, 1.4, 0, TAU);
        ctx.arc(px + 22, h * 0.18, 1.4, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = options.color || p.tape;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      // floral toile
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 7; i++) {
        const fx = -w / 2 + 20 + rng() * (w - 40);
        const fy = -h / 2 + 14 + rng() * (h - 28);
        drawTinyFlower(ctx, fx, fy, 7 + rng() * 4, i % 2 ? '#8d9dab' : '#b56d77', '#f9eadf', 0.8);
        ctx.strokeStyle = 'rgba(112,133,145,.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, fy + 7);
        ctx.quadraticCurveTo(fx + 8, fy + 16, fx + 2, fy + 23);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#fffaf2';
      ctx.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
    }

    // translucent fibre + bright edge
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 20; i++) {
      const yy = -h / 2 + rng() * h;
      ctx.fillRect(-w / 2 + rng() * w * 0.7, yy, 20 + rng() * 60, 1);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* polaroid frames                                                     */
  /* ------------------------------------------------------------------ */

  function frameShape(ctx, style, w, h) {
    if (style.id === 'french') {
      scallopPath(ctx, -w / 2, -h / 2, w, h, 17);
    } else if (style.id === 'gothic') {
      tornPath(ctx, -w / 2, -h / 2, w, h, mulberry32(hashString(w.toFixed(0) + h.toFixed(0))), 2.5);
    } else if (style.id === 'american') {
      rrPath(ctx, -w / 2, -h / 2, w, h, w * 0.025);
    } else {
      rrPath(ctx, -w / 2, -h / 2, w, h, 4);
    }
  }

  function drawPhoto(ctx, item, style, index, rng) {
    const p = style.palette;
    const w = item.w;
    const h = item.h;
    ctx.save();
    ctx.translate(item.cx, item.cy);
    ctx.rotate(item.rot);

    // paper drop shadow
    ctx.save();
    ctx.shadowColor = style.id === 'gothic' ? 'rgba(0,0,0,.75)' : 'rgba(39,25,14,.3)';
    ctx.shadowBlur = style.id === 'gothic' ? 30 : 24;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 16;
    frameShape(ctx, style, w, h);
    ctx.fillStyle = p.frame;
    ctx.fill();
    ctx.restore();

    // outer edge detail
    ctx.save();
    frameShape(ctx, style, w, h);
    ctx.strokeStyle = style.id === 'gothic' ? 'rgba(199,180,148,.28)' : rgba(p.frameEdge, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    if (style.id === 'gothic') {
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#d9c7a7';
      ctx.lineWidth = 1;
      frameShape(ctx, style, w - 8, h - 8);
      ctx.stroke();
    }
    ctx.restore();

    const padX = w * 0.055;
    const padTop = w * 0.052;
    const captionH = Math.max(74, h * 0.145);
    const innerX = -w / 2 + padX;
    const innerY = -h / 2 + padTop;
    const innerW = w - padX * 2;
    const innerH = h - padTop - captionH;
    const radius = style.id === 'american' ? w * 0.018 : (style.id === 'french' ? 4 : 1);

    // photo
    ctx.save();
    rrPath(ctx, innerX, innerY, innerW, innerH, radius);
    ctx.clip();
    ctx.fillStyle = style.id === 'gothic' ? '#0a0a09' : '#d8c9b4';
    ctx.fillRect(innerX, innerY, innerW, innerH);
    if (item.photo && item.photo.source) {
      drawCover(ctx, item.photo.source, innerX, innerY, innerW, innerH, item.photo.focusX, item.photo.focusY);
      // photographic grade
      if (style.id === 'japanese') {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = 'rgba(255,196,134,.16)';
        ctx.fillRect(innerX, innerY, innerW, innerH);
      } else if (style.id === 'american') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(210,164,112,.13)';
        ctx.fillRect(innerX, innerY, innerW, innerH);
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = 'rgba(255,224,177,.18)';
        ctx.fillRect(innerX, innerY, innerW, innerH);
      } else if (style.id === 'gothic') {
        ctx.globalCompositeOperation = 'saturation';
        ctx.fillStyle = 'rgba(108,110,110,.72)';
        ctx.fillRect(innerX, innerY, innerW, innerH);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(48,55,59,.22)';
        ctx.fillRect(innerX, innerY, innerW, innerH);
      } else {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = 'rgba(255,172,172,.16)';
        ctx.fillRect(innerX, innerY, innerW, innerH);
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255,242,223,.09)';
        ctx.fillRect(innerX, innerY, innerW, innerH);
      }
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // ghost / film leader
      ctx.fillStyle = style.id === 'gothic' ? '#171614' : rgba(p.paperDeep, 0.55);
      ctx.fillRect(innerX, innerY, innerW, innerH);
      ctx.strokeStyle = rgba(p.inkSoft, 0.32);
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 12]);
      ctx.strokeRect(innerX + 10, innerY + 10, innerW - 20, innerH - 20);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = p.inkSoft;
      ctx.lineWidth = 2.4;
      const ix = innerX + innerW / 2;
      const iy = innerY + innerH / 2;
      ctx.beginPath();
      ctx.moveTo(ix - 30, iy + 22);
      ctx.lineTo(ix - 6, iy - 10);
      ctx.lineTo(ix + 8, iy + 5);
      ctx.lineTo(ix + 22, iy - 8);
      ctx.lineTo(ix + 42, iy + 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ix - 30, iy - 22, 12, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = p.inkSoft;
      ctx.font = '600 22px ' + FONTS.sans;
      ctx.textAlign = 'center';
      trackedText(ctx, 'YOUR PHOTO ' + String(index + 1).padStart(2, '0'), ix, iy + 78, 2, 'center');
    }
    ctx.restore();

    // inner hairline
    ctx.save();
    rrPath(ctx, innerX, innerY, innerW, innerH, radius);
    ctx.strokeStyle = style.id === 'gothic' ? 'rgba(222,207,181,.23)' : 'rgba(255,255,255,.6)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // caption — hidden when a later photo or the note lays over this strip
    if (!item.captionHidden) {
      const caption = style.captions[index % style.captions.length];
      ctx.save();
      ctx.fillStyle = style.id === 'gothic' ? rgba(p.ink, 0.82) : rgba(p.ink, 0.78);
      ctx.font = CAPTION_FONT[style.id];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const capY = h / 2 - captionH * 0.48;
      ctx.fillText(caption, 0, capY);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = p.accent;
      ctx.beginPath();
      ctx.arc(-w / 2 + padX + 5, capY, 3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // washi tape, in local coordinates
    const tapeW = Math.min(w * 0.46, 210);
    const tapeH = 52;
    if (index % 3 !== 2) {
      drawTape(ctx, -w / 2 + tapeW * 0.38, -h / 2 + 18, tapeW, tapeH, -38 * DEG, style, rng, {});
    }
    if (index % 2 === 1) {
      drawTape(ctx, w / 2 - tapeW * 0.32, h / 2 - 22, tapeW * 0.8, tapeH * 0.86, 34 * DEG, style, rng, {});
    }

    // paper clip on one frame
    if (index === 0 && style.id !== 'gothic') {
      drawPaperClip(ctx, w / 2 - 24, -h / 2 + 8, 0.68, p.inkSoft);
    }

    // corner wear
    if (style.id === 'japanese' || style.id === 'american') {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = p.inkSoft;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 8, h / 2 - 30);
      ctx.lineTo(-w / 2 + 28, h / 2 - 18);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawPaperClip(ctx, x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-22 * DEG);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-11, 28);
    ctx.lineTo(-11, -14);
    ctx.arc(0, -14, 11, Math.PI, 0);
    ctx.lineTo(11, 17);
    ctx.arc(0, 17, 11, 0, Math.PI);
    ctx.lineTo(-4, 17);
    ctx.lineTo(-4, -9);
    ctx.arc(0, -9, 4, Math.PI, 0);
    ctx.lineTo(4, 28);
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* note card                                                           */
  /* ------------------------------------------------------------------ */

  function measureNote(ctx, style, text, width) {
    const family = style.id === 'gothic'
      ? FONTS.copper
      : (style.id === 'french' || style.id === 'american' ? FONTS.hand : FONTS.song);
    const fontFor = (size) => (style.id === 'gothic' ? 'italic ' : '') + size + 'px ' + family;
    let size = Math.min(47, Math.max(32, width * 0.105));
    let lines = [];
    for (; size >= 27; size -= 2) {
      ctx.font = fontFor(size);
      lines = wrapText(ctx, text, width - 62);
      if (lines.length <= 3) break;
    }
    const lineH = size * 1.28;
    return { size, lines, lineH, font: fontFor(size) };
  }

  function drawNote(ctx, style, note, anchor, rng) {
    if (!anchor) return;
    const p = style.palette;
    const text = (note || style.defaultNote).trim();
    if (!text) return;
    const width = anchor.w;
    ctx.save();
    ctx.translate(anchor.cx, anchor.cy);
    ctx.rotate(anchor.rot * DEG);

    const measured = measureNote(ctx, style, text, width);
    const headerH = style.id === 'american' ? 58 : 44;
    const footerH = 40;
    const padBottom = 18;
    const height = Math.max(178, headerH + measured.lines.length * measured.lineH + footerH + padBottom + 24);
    const w = width;
    const h = height;

    // shadow
    ctx.save();
    ctx.shadowColor = 'rgba(35,24,14,.28)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 12;
    if (style.id === 'french') {
      scallopPath(ctx, -w / 2, -h / 2, w, h, 13);
    } else {
      tornPath(ctx, -w / 2, -h / 2, w, h, rng, 3);
    }
    ctx.fillStyle = p.note;
    ctx.fill();
    ctx.restore();

    // paper tint / rules
    ctx.save();
    if (style.id === 'french') {
      scallopPath(ctx, -w / 2, -h / 2, w, h, 13);
    } else {
      tornPath(ctx, -w / 2, -h / 2, w, h, mulberry32(hashString(style.id + text)), 3);
    }
    ctx.clip();

    if (style.id === 'american') {
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(91,118,131,.28)';
      ctx.lineWidth = 2;
      for (let y = -h / 2 + 96; y < h / 2 - 50; y += 34) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 18, y);
        ctx.lineTo(w / 2 - 18, y);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(p.accent, 0.8);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 22, -h / 2 + 58);
      ctx.lineTo(w / 2 - 22, -h / 2 + 58);
      ctx.stroke();
    } else if (style.id === 'gothic') {
      ctx.fillStyle = 'rgba(255,246,226,.09)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(85,62,44,.38)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2 + 15, -h / 2 + 15, w - 30, h - 30);
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 24, -h / 2 + 34);
      ctx.lineTo(w / 2 - 24, -h / 2 + 34);
      ctx.stroke();
    } else if (style.id === 'french') {
      ctx.strokeStyle = 'rgba(180,111,119,.24)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 24, h / 2 - 32 - i * 11);
        ctx.quadraticCurveTo(0, h / 2 - 38 - i * 11, w / 2 - 24, h / 2 - 32 - i * 11);
        ctx.stroke();
      }
      drawTinyFlower(ctx, w / 2 - 48, -h / 2 + 44, 11, '#c98b93', '#f9e5dc', 0.7);
      drawTinyFlower(ctx, w / 2 - 28, -h / 2 + 58, 7, '#8f9eac', '#f9e5dc', 0.55);
    } else {
      ctx.strokeStyle = 'rgba(98,72,44,.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 6]);
      ctx.strokeRect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28);
      ctx.setLineDash([]);
    }

    // header
    ctx.fillStyle = style.id === 'gothic' ? 'rgba(237,227,207,.75)' : rgba(p.ink, 0.62);
    ctx.font = (style.id === 'american' ? '700 18px ' + FONTS.type : '500 18px ' + FONTS.sans);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const headerLabel = style.id === 'american'
      ? (w < 300 ? 'FIELD NOTES' : 'FIELD NOTES / VOL. 01')
      : (style.id === 'gothic'
        ? (w < 320 ? 'EX LIBRIS' : 'EX LIBRIS · PRIVATE')
        : (style.id === 'french' ? 'UN PETIT MOT' : 'MEMO / TODAY'));
    trackedText(ctx, headerLabel, -w / 2 + 28, -h / 2 + 30, style.id === 'american' ? 1.5 : 2.0, 'left');

    // note text
    ctx.fillStyle = style.id === 'gothic' ? '#3d3025' : p.ink;
    ctx.font = measured.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const startY = -h / 2 + headerH + 22 + measured.lineH * 0.48;
    for (let i = 0; i < measured.lines.length; i++) {
      ctx.fillText(measured.lines[i], -w / 2 + 30, startY + i * measured.lineH);
    }

    // date
    const now = new Date();
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const dateStr = String(now.getDate()).padStart(2, '0') + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
    ctx.fillStyle = style.id === 'gothic' ? 'rgba(55,42,31,.7)' : rgba(p.inkSoft, 0.82);
    ctx.font = (style.id === 'american' ? '700 17px ' + FONTS.type : 'italic 18px ' + FONTS.copper);
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, w / 2 - 28, h / 2 - 25);

    if (style.id === 'japanese') {
      ctx.textAlign = 'left';
      ctx.font = '18px ' + FONTS.song;
      ctx.fillStyle = rgba(p.inkSoft, 0.65);
      ctx.fillText('留在这页', -w / 2 + 28, h / 2 - 25);
    }

    ctx.restore();

    // tape on top
    drawTape(ctx, 0, -h / 2 + 2, 138, 38, -4 * DEG, style, rng, { alpha: 0.92 });
    // pin / seal
    if (style.id === 'gothic') {
      drawWaxSeal(ctx, w / 2 - 20, -h / 2 + 20, 31, rng);
    }
    if (style.id === 'french') {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = p.second;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-w / 2 + 36, h / 2 - 32, 17, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = p.second;
      ctx.font = 'italic 15px ' + FONTS.copper;
      ctx.textAlign = 'center';
      ctx.fillText('PARIS', -w / 2 + 36, h / 2 - 27);
      ctx.restore();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* small drawn objects                                                 */
  /* ------------------------------------------------------------------ */

  function drawCoffeeCup(ctx, x, y, s, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = 'rgba(74,59,46,.13)';
    ctx.beginPath();
    ctx.ellipse(8, 38, 54, 18, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#7e5f4b';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#fff8e8';
    ctx.beginPath();
    ctx.ellipse(0, 18, 45, 16, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7e8cf';
    ctx.beginPath();
    ctx.moveTo(-40, -15);
    ctx.quadraticCurveTo(-34, 30, 0, 32);
    ctx.quadraticCurveTo(34, 30, 40, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#7e5f4b';
    ctx.beginPath();
    ctx.arc(42, 4, 16, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = '#8a5c43';
    ctx.beginPath();
    ctx.ellipse(0, -15, 40, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d9b28e';
    ctx.beginPath();
    ctx.ellipse(-7, -17, 16, 4, -0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#9d7a5f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-19, -40);
    ctx.bezierCurveTo(-28, -58, -9, -62, -16, -83);
    ctx.moveTo(9, -40);
    ctx.bezierCurveTo(2, -55, 19, -62, 11, -82);
    ctx.stroke();
    ctx.restore();
  }

  function drawToast(ctx, x, y, s, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = 'rgba(74,59,46,.1)';
    ctx.beginPath();
    ctx.ellipse(4, 43, 55, 14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#9b6b45';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#e8c187';
    ctx.beginPath();
    ctx.moveTo(-42, 30);
    ctx.quadraticCurveTo(-52, 12, -44, -18);
    ctx.quadraticCurveTo(-36, -50, 0, -48);
    ctx.quadraticCurveTo(36, -50, 44, -18);
    ctx.quadraticCurveTo(52, 12, 42, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f9e7bd';
    ctx.beginPath();
    ctx.ellipse(0, -4, 26, 20, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8a43f';
    ctx.beginPath();
    ctx.arc(0, -2, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f6cf68';
    ctx.beginPath();
    ctx.arc(-2, -4, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawStrawberry(ctx, x, y, s, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = '#d96762';
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.bezierCurveTo(-34, 10, -32, -18, 0, -22);
    ctx.bezierCurveTo(32, -18, 34, 10, 0, 36);
    ctx.fill();
    ctx.fillStyle = '#f6e2bc';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 15, Math.sin(a) * 12 + 3, 1.7, 3, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#72855f';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(-12 + i * 6, -23, 8, 3.5, -0.5 + i * 0.22, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#72855f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(0, -39);
    ctx.stroke();
    ctx.restore();
  }

  function drawWaxSeal(ctx, x, y, r, rng) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#7b2424';
    ctx.beginPath();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      const rad = r * (0.87 + rng() * 0.2);
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,214,186,.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.66, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(245,221,197,.74)';
    ctx.font = 'italic 26px ' + FONTS.copper;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', 0, 1);
    ctx.restore();
  }

  function drawRaven(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha == null ? 1 : alpha;

    // winter branch
    ctx.strokeStyle = 'rgba(201,184,154,.38)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-112, 88);
    ctx.quadraticCurveTo(-10, 62, 112, 78);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(34, 68);
    ctx.lineTo(53, 91);
    ctx.moveTo(58, 69);
    ctx.lineTo(78, 88);
    ctx.moveTo(-72, 76);
    ctx.lineTo(-92, 95);
    ctx.stroke();

    // long tail feathers
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-12, 26);
    ctx.bezierCurveTo(-42, 56, -70, 82, -103, 96);
    ctx.lineTo(-84, 78);
    ctx.lineTo(-59, 72);
    ctx.bezierCurveTo(-38, 52, -22, 42, -4, 38);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.moveTo(-22, -18);
    ctx.bezierCurveTo(-38, 6, -31, 40, -6, 53);
    ctx.bezierCurveTo(14, 58, 29, 38, 28, 13);
    ctx.bezierCurveTo(28, -2, 18, -15, 8, -20);
    ctx.bezierCurveTo(0, -30, -14, -29, -22, -18);
    ctx.closePath();
    ctx.fill();

    // head + neck
    ctx.beginPath();
    ctx.moveTo(8, -19);
    ctx.bezierCurveTo(8, -38, 19, -50, 34, -50);
    ctx.bezierCurveTo(48, -50, 55, -41, 53, -31);
    ctx.bezierCurveTo(51, -22, 43, -17, 33, -17);
    ctx.bezierCurveTo(23, -16, 16, -15, 8, -19);
    ctx.closePath();
    ctx.fill();

    // long dagger beak
    ctx.beginPath();
    ctx.moveTo(44, -43);
    ctx.lineTo(87, -34);
    ctx.lineTo(45, -27);
    ctx.closePath();
    ctx.fill();

    // folded wing with feather points
    ctx.globalAlpha = (alpha == null ? 1 : alpha) * 0.96;
    ctx.beginPath();
    ctx.moveTo(2, -14);
    ctx.bezierCurveTo(-17, 7, -18, 34, 1, 47);
    ctx.lineTo(4, 37);
    ctx.lineTo(9, 45);
    ctx.lineTo(11, 31);
    ctx.lineTo(17, 38);
    ctx.bezierCurveTo(22, 25, 20, 4, 14, -9);
    ctx.closePath();
    ctx.fill();

    // folded-feather lines
    ctx.globalAlpha = (alpha == null ? 1 : alpha) * 0.35;
    ctx.strokeStyle = 'rgba(230,219,199,.5)';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-4 + i * 5, 22 + i * 2, 15 - i * 2, -1.2, 1.7);
      ctx.stroke();
    }

    // a sliver of warm rim light so the silhouette reads on dark paper too
    ctx.globalAlpha = (alpha == null ? 1 : alpha) * 0.3;
    ctx.strokeStyle = 'rgba(233,221,199,.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(15, -47);
    ctx.bezierCurveTo(32, -54, 51, -46, 52, -31);
    ctx.moveTo(-28, 10);
    ctx.bezierCurveTo(-34, 30, -22, 46, -4, 51);
    ctx.stroke();

    // eye
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = 'rgba(229,217,191,.8)';
    ctx.beginPath();
    ctx.arc(36, -38, 2.2, 0, TAU);
    ctx.fill();

    // legs
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-2, 51);
    ctx.lineTo(-7, 80);
    ctx.lineTo(-16, 84);
    ctx.moveTo(11, 50);
    ctx.lineTo(14, 79);
    ctx.lineTo(25, 82);
    ctx.stroke();
    ctx.restore();
  }

  function drawLaceStrip(ctx, x, y, w, h, color, alpha, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    const r = h * 0.25;
    // Two rows of scalloped lace, drawn as line work rather than cut-outs so
    // the layer can safely sit over photographs and paper.
    for (let px = -w / 2 + r; px < w / 2; px += r * 2) {
      ctx.beginPath();
      ctx.arc(px, -h * 0.2, r, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, h * 0.2, r, Math.PI, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, 0, r * 0.16, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawTicket(ctx, x, y, w, h, rot, style, alpha) {
    const p = style.palette;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.shadowColor = 'rgba(40,25,15,.2)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    fillRR(ctx, -w / 2, -h / 2, w, h, 4, '#f5e4bf');
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18);
    ctx.setLineDash([]);
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 16px ' + FONTS.type;
    trackedText(ctx, 'ADMIT ONE', 0, -14, 2, 'center');
    ctx.font = '700 29px ' + FONTS.serif;
    ctx.fillText('MOMENTO', 0, 14);
    ctx.font = '12px ' + FONTS.type;
    ctx.fillText('NO. 042  ·  KEEP THIS STUB', 0, 34);
    ctx.restore();
  }

  function drawStamp(ctx, x, y, size, rot, style, alpha) {
    const p = style.palette;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = '#f7ecd8';
    ctx.beginPath();
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rr = size * (i % 2 ? 0.84 : 0.94);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    // tiny landscape
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.68, 0, TAU);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, -size, 0, size);
    sky.addColorStop(0, '#dfe8e3');
    sky.addColorStop(1, '#d9b9a1');
    ctx.fillStyle = sky;
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.fillStyle = '#788577';
    ctx.beginPath();
    ctx.moveTo(-size, size * 0.3);
    ctx.lineTo(-size * 0.3, -size * 0.1);
    ctx.lineTo(size * 0.2, size * 0.24);
    ctx.lineTo(size, -size * 0.16);
    ctx.lineTo(size, size);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c76f62';
    ctx.beginPath();
    ctx.arc(size * 0.42, -size * 0.4, size * 0.13, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = p.ink;
    ctx.font = '700 12px ' + FONTS.type;
    ctx.textAlign = 'center';
    ctx.fillText('LA POSTE', 0, size * 0.76);
    ctx.restore();
  }

  function drawTicketStub(ctx, x, y, w, h, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = '#efd7a9';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#9e5b46';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14);
    ctx.fillStyle = '#9e5b46';
    ctx.font = '700 13px ' + FONTS.type;
    ctx.textAlign = 'center';
    trackedText(ctx, 'ADMIT ONE', 0, -6, 2, 'center');
    ctx.font = '700 24px ' + FONTS.serif;
    ctx.fillText('MOMENTO', 0, 24);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-w / 2 + 12, -h / 2 + 16 + i * 20, 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* demo photographs (generated locally, no external assets)            */
  /* ------------------------------------------------------------------ */

  let grainPatternCanvas = null;

  function getGrainCanvas() {
    if (grainPatternCanvas) return grainPatternCanvas;
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 300;
    const g = c.getContext('2d');
    const img = g.createImageData(300, 300);
    const rng = mulberry32(982451653);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rng() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 20;
    }
    g.putImageData(img, 0, 0);
    grainPatternCanvas = c;
    return c;
  }

  function addPhotoFinish(ctx, rng, warmth) {
    // soft leak
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    radialGlow(ctx, 980, 100, 700, 'rgba(255,225,173,.24)', 'rgba(255,225,173,0)');
    ctx.restore();
    // vignette
    const vg = ctx.createRadialGradient(600, 720, 260, 600, 720, 980);
    vg.addColorStop(0, 'rgba(30,20,10,0)');
    vg.addColorStop(1, 'rgba(25,16,9,.36)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 1200, 1500);
    // grain
    ctx.save();
    const pat = ctx.createPattern(getGrainCanvas(), 'repeat');
    ctx.globalAlpha = 0.5;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, 1200, 1500);
    ctx.restore();
    // subtle warm veil
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = warmth || 'rgba(255,214,163,.18)';
    ctx.fillRect(0, 0, 1200, 1500);
    ctx.restore();
  }

  function makeDemoPhoto(kind) {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 1500;
    const ctx = c.getContext('2d');
    const rng = mulberry32(hashString('demo-' + kind));

    if (kind === 'window') {
      let g = ctx.createLinearGradient(0, 0, 1200, 1500);
      g.addColorStop(0, '#c9b79f');
      g.addColorStop(0.55, '#dfcfb8');
      g.addColorStop(1, '#a88e73');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1200, 1500);
      // window light
      ctx.save();
      ctx.filter = 'blur(18px)';
      ctx.fillStyle = 'rgba(246,234,210,.88)';
      ctx.fillRect(140, 130, 540, 850);
      ctx.fillStyle = 'rgba(157,177,174,.35)';
      ctx.fillRect(160, 150, 500, 810);
      ctx.restore();
      // window frame
      ctx.strokeStyle = 'rgba(92,70,52,.55)';
      ctx.lineWidth = 22;
      ctx.strokeRect(140, 130, 540, 850);
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(410, 130);
      ctx.lineTo(410, 980);
      ctx.moveTo(140, 555);
      ctx.lineTo(680, 555);
      ctx.stroke();
      // curtain
      ctx.save();
      ctx.filter = 'blur(7px)';
      ctx.fillStyle = 'rgba(236,224,205,.72)';
      ctx.beginPath();
      ctx.moveTo(700, 70);
      ctx.bezierCurveTo(620, 400, 780, 700, 690, 1120);
      ctx.lineTo(880, 1120);
      ctx.bezierCurveTo(810, 720, 900, 380, 860, 70);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // sun patch
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,226,171,.42)';
      ctx.beginPath();
      ctx.moveTo(680, 200);
      ctx.lineTo(1200, 560);
      ctx.lineTo(1200, 1150);
      ctx.lineTo(360, 1250);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // plant silhouette
      ctx.save();
      ctx.translate(880, 1050);
      ctx.fillStyle = 'rgba(55,66,48,.55)';
      ctx.strokeStyle = 'rgba(55,66,48,.5)';
      ctx.lineWidth = 8;
      for (let i = 0; i < 9; i++) {
        const a = -2.5 + i * 0.34;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -100 - i * 10, 28, 90, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 300);
      ctx.stroke();
      ctx.restore();
      // table
      ctx.fillStyle = 'rgba(126,94,66,.5)';
      ctx.fillRect(0, 1320, 1200, 180);
      addPhotoFinish(ctx, rng, 'rgba(255,206,151,.28)');
    }

    if (kind === 'sea') {
      let g = ctx.createLinearGradient(0, 0, 0, 900);
      g.addColorStop(0, '#c9d9d8');
      g.addColorStop(0.55, '#e9ddc8');
      g.addColorStop(1, '#f1d6ad');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1200, 900);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      radialGlow(ctx, 760, 630, 360, 'rgba(255,239,198,.85)', 'rgba(255,239,198,0)');
      ctx.restore();
      ctx.fillStyle = 'rgba(248,230,193,.92)';
      ctx.beginPath();
      ctx.arc(760, 650, 82, 0, TAU);
      ctx.fill();
      g = ctx.createLinearGradient(0, 850, 0, 1500);
      g.addColorStop(0, '#7b9a97');
      g.addColorStop(0.45, '#557b7b');
      g.addColorStop(1, '#2f4f55');
      ctx.fillStyle = g;
      ctx.fillRect(0, 850, 1200, 650);
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#f8e8c9';
      ctx.lineWidth = 4;
      for (let i = 0; i < 20; i++) {
        const y = 900 + i * 29;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(300, y - 12 - i, 750, y + 16, 1200, y - 4);
        ctx.stroke();
      }
      ctx.restore();
      // sailboat
      ctx.fillStyle = 'rgba(58,65,62,.78)';
      ctx.beginPath();
      ctx.moveTo(930, 842);
      ctx.lineTo(930, 746);
      ctx.lineTo(1004, 832);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(935, 846);
      ctx.lineTo(1024, 846);
      ctx.lineTo(1008, 866);
      ctx.lineTo(950, 866);
      ctx.closePath();
      ctx.fill();
      // birds
      ctx.strokeStyle = 'rgba(67,75,71,.55)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const bx = 210 + i * 55;
        const by = 330 + i * 25;
        ctx.beginPath();
        ctx.moveTo(bx - 12, by);
        ctx.quadraticCurveTo(bx, by - 10, bx + 8, by - 1);
        ctx.quadraticCurveTo(bx + 16, by - 10, bx + 28, by);
        ctx.stroke();
      }
      addPhotoFinish(ctx, rng, 'rgba(255,205,145,.2)');
    }

    if (kind === 'cafe') {
      let g = ctx.createRadialGradient(520, 500, 100, 600, 750, 1100);
      g.addColorStop(0, '#dcc7a8');
      g.addColorStop(1, '#9b7a59');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1200, 1500);
      // light
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,236,196,.28)';
      ctx.beginPath();
      ctx.ellipse(760, 340, 520, 260, -0.6, 0, TAU);
      ctx.fill();
      ctx.restore();
      // napkin
      ctx.save();
      ctx.translate(580, 850);
      ctx.rotate(-0.12);
      ctx.fillStyle = 'rgba(243,232,211,.75)';
      ctx.fillRect(-260, -200, 520, 430);
      ctx.strokeStyle = 'rgba(176,143,108,.4)';
      ctx.lineWidth = 4;
      ctx.strokeRect(-245, -185, 490, 400);
      ctx.restore();
      // plate
      ctx.fillStyle = 'rgba(245,237,222,.95)';
      ctx.beginPath();
      ctx.ellipse(550, 700, 290, 280, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(147,114,83,.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(550, 700, 255, 245, 0, 0, TAU);
      ctx.stroke();
      // croissant
      ctx.save();
      ctx.translate(480, 640);
      ctx.rotate(-0.22);
      ctx.fillStyle = '#d69745';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 96 - i * 12, 160 - i * 18, 0.7, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(144,87,35,.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.rotate(0.34);
      }
      ctx.restore();
      // cup
      ctx.save();
      ctx.translate(770, 660);
      ctx.fillStyle = '#f3e7d0';
      ctx.beginPath();
      ctx.ellipse(0, 20, 150, 142, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(135,103,73,.4)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#7a5238';
      ctx.beginPath();
      ctx.ellipse(0, 15, 112, 104, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(247,228,194,.45)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(-18, 6, 64, 3.6, 5.8);
      ctx.stroke();
      ctx.fillStyle = 'rgba(239,222,193,.22)';
      ctx.beginPath();
      ctx.ellipse(-30, -20, 55, 24, -0.5, 0, TAU);
      ctx.fill();
      ctx.restore();
      // spoon
      ctx.save();
      ctx.translate(950, 900);
      ctx.rotate(0.5);
      ctx.fillStyle = 'rgba(90,85,77,.75)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 27, 62, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(-6, 50, 12, 300);
      ctx.restore();
      addPhotoFinish(ctx, rng, 'rgba(255,208,151,.3)');
    }

    if (kind === 'flowers') {
      let g = ctx.createLinearGradient(0, 0, 0, 1500);
      g.addColorStop(0, '#77816a');
      g.addColorStop(0.55, '#8f9677');
      g.addColorStop(1, '#545f4e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1200, 1500);
      // bokeh
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 28; i++) {
        const x = rng() * 1200;
        const y = rng() * 950;
        radialGlow(ctx, x, y, 40 + rng() * 130, 'rgba(245,230,186,' + (0.03 + rng() * 0.1) + ')', 'rgba(245,230,186,0)');
      }
      ctx.restore();
      // stems
      ctx.strokeStyle = 'rgba(50,67,49,.5)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 85; i++) {
        const x = 40 + rng() * 1120;
        const y = 450 + rng() * 1050;
        const bending = (rng() - 0.5) * 100;
        ctx.beginPath();
        ctx.moveTo(x, 1500);
        ctx.quadraticCurveTo(x + bending * 0.4, y + 100, x + bending, y);
        ctx.stroke();
      }
      // blooms
      const colors = ['#e7d7b1', '#d9a6a4', '#eee4d2', '#c7b17b', '#b8c1a7'];
      for (let i = 0; i < 58; i++) {
        const x = 40 + rng() * 1120;
        const y = 380 + rng() * 1050;
        const r = 10 + rng() * 22;
        drawTinyFlower(ctx, x, y, r, colors[i % colors.length], '#c08e58', 0.72 + rng() * 0.25);
      }
      // foreground blur stems
      ctx.save();
      ctx.filter = 'blur(9px)';
      ctx.strokeStyle = 'rgba(39,54,38,.45)';
      ctx.lineWidth = 10;
      for (let i = 0; i < 9; i++) {
        const x = 80 + rng() * 1040;
        ctx.beginPath();
        ctx.moveTo(x, 1500);
        ctx.quadraticCurveTo(x + 80, 1150, x + (rng() - 0.5) * 240, 900);
        ctx.stroke();
      }
      ctx.restore();
      addPhotoFinish(ctx, rng, 'rgba(255,216,166,.16)');
    }

    if (kind === 'city') {
      let g = ctx.createLinearGradient(0, 0, 0, 1100);
      g.addColorStop(0, '#5e6277');
      g.addColorStop(0.45, '#ad7d74');
      g.addColorStop(0.7, '#e1a477');
      g.addColorStop(1, '#e6bd8d');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1200, 1500);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      radialGlow(ctx, 360, 730, 430, 'rgba(255,205,138,.5)', 'rgba(255,205,138,0)');
      ctx.restore();
      // far buildings
      ctx.fillStyle = 'rgba(72,68,78,.55)';
      for (let i = 0; i < 14; i++) {
        const w = 55 + rng() * 95;
        const h = 160 + rng() * 380;
        ctx.fillRect(i * 92 - 20, 980 - h, w, h + 300);
      }
      // near buildings
      ctx.fillStyle = 'rgba(40,38,45,.9)';
      for (let i = 0; i < 10; i++) {
        const w = 100 + rng() * 150;
        const h = 220 + rng() * 520;
        const x = i * 135 - 70;
        ctx.fillRect(x, 1120 - h, w, h + 400);
        // windows
        ctx.fillStyle = 'rgba(238,188,116,.55)';
        for (let wy = 1140 - h; wy < 1120; wy += 38) {
          for (let wx = x + 18; wx < x + w - 18; wx += 30) {
            if (rng() > 0.45) ctx.fillRect(wx, wy, 10, 16);
          }
        }
        ctx.fillStyle = 'rgba(40,38,45,.9)';
      }
      // street glow
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      radialGlow(ctx, 920, 1240, 260, 'rgba(255,183,100,.45)', 'rgba(255,183,100,0)');
      ctx.restore();
      // birds
      ctx.strokeStyle = 'rgba(36,32,38,.8)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const bx = 220 + rng() * 760;
        const by = 220 + rng() * 330;
        ctx.beginPath();
        ctx.moveTo(bx - 12, by);
        ctx.quadraticCurveTo(bx, by - 9, bx + 8, by);
        ctx.quadraticCurveTo(bx + 15, by - 9, bx + 26, by);
        ctx.stroke();
      }
      addPhotoFinish(ctx, rng, 'rgba(255,187,123,.22)');
    }

    return {
      source: c,
      width: c.width,
      height: c.height,
      thumb: c.toDataURL('image/jpeg', 0.76),
      name: '示例照片',
      demo: true
    };
  }

  function makeDemoPhotos() {
    return ['window', 'sea', 'cafe', 'flowers', 'city'].map((kind, i) => {
      const p = makeDemoPhoto(kind);
      p.name = '示例照片 ' + String(i + 1).padStart(2, '0');
      return p;
    });
  }

  // Expose the engine. UI and decoration code is appended below.
  window.MomentoArt = {
    W,
    H,
    FONTS,
    makeDemoPhotos,
    _utils: {
      clamp, hashString, mulberry32, rgba, mixHex, rrPath, fillRR, ellipsePath,
      scallopPath, tornPath, trackedText, wrapText, drawCover, radialGlow,
      drawSparkle, drawHeart, drawDash, drawArrow, drawGrain: getGrainCanvas
    },
    _draw: {
      drawBackground, drawScraps, drawTape, drawPhoto, drawNote,
      drawCoffeeCup, drawToast, drawStrawberry, drawWaxSeal, drawRaven,
      drawLaceStrip, drawTicket, drawTicketStub, drawStamp, drawTinyFlower,
      drawGingham, addPhotoFinish
    }
  };
})();
