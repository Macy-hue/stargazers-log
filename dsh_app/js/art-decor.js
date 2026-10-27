/* MOMENTO — layouts, decorative layers and final composition. */
(function () {
  'use strict';

  const engine = window.MomentoArt;
  const U = engine._utils;
  const D = engine._draw;
  const { STYLES } = window.MOMENTO_PRESETS;
  const W = engine.W;
  const H = engine.H;
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = U.clamp;
  const rgba = U.rgba;
  const mulberry32 = U.mulberry32;
  const hashString = U.hashString;
  const rrPath = U.rrPath;

  const LAYOUT_RECIPES = {
    scatter: {
      4: [
        { cx: 0.27, cy: 0.16, w: 0.40, rot: -5.5, z: 1 },
        { cx: 0.73, cy: 0.34, w: 0.43, rot: 5.0, z: 2 },
        { cx: 0.29, cy: 0.59, w: 0.42, rot: 3.6, z: 3 },
        { cx: 0.74, cy: 0.82, w: 0.38, rot: -4.2, z: 4 }
      ],
      5: [
        { cx: 0.26, cy: 0.10, w: 0.355, rot: -6.4, z: 2 },
        { cx: 0.73, cy: 0.28, w: 0.405, rot: 5.2, z: 1 },
        { cx: 0.50, cy: 0.47, w: 0.365, rot: -2.4, z: 3 },
        { cx: 0.27, cy: 0.68, w: 0.385, rot: 4.8, z: 4 },
        { cx: 0.74, cy: 0.88, w: 0.35, rot: -4.5, z: 5 }
      ]
    },
    salon: {
      4: [
        { cx: 0.29, cy: 0.16, w: 0.37, rot: -1.3, z: 1 },
        { cx: 0.71, cy: 0.20, w: 0.37, rot: 1.5, z: 2 },
        { cx: 0.29, cy: 0.64, w: 0.37, rot: 1.2, z: 3 },
        { cx: 0.71, cy: 0.68, w: 0.37, rot: -1.6, z: 4 }
      ],
      5: [
        { cx: 0.29, cy: 0.10, w: 0.35, rot: -1.4, z: 1 },
        { cx: 0.71, cy: 0.14, w: 0.35, rot: 1.5, z: 2 },
        { cx: 0.29, cy: 0.46, w: 0.35, rot: 1.2, z: 3 },
        { cx: 0.71, cy: 0.50, w: 0.35, rot: -1.5, z: 4 },
        { cx: 0.50, cy: 0.80, w: 0.52, ratio: 0.78, rot: -0.8, z: 5 }
      ]
    },
    column: {
      4: [
        { cx: 0.47, cy: 0.08, w: 0.34, rot: -4.2, z: 1 },
        { cx: 0.53, cy: 0.33, w: 0.34, rot: 3.4, z: 2 },
        { cx: 0.46, cy: 0.58, w: 0.34, rot: -2.6, z: 3 },
        { cx: 0.52, cy: 0.83, w: 0.34, rot: 4.0, z: 4 }
      ],
      5: [
        { cx: 0.47, cy: 0.07, w: 0.285, rot: -4.5, z: 1 },
        { cx: 0.53, cy: 0.28, w: 0.285, rot: 3.6, z: 2 },
        { cx: 0.48, cy: 0.49, w: 0.285, rot: -2.4, z: 3 },
        { cx: 0.53, cy: 0.70, w: 0.285, rot: 4.4, z: 4 },
        { cx: 0.49, cy: 0.91, w: 0.285, rot: -3.0, z: 5 }
      ]
    }
  };

  const ROT_FACTOR = {
    japanese: 1.12,
    american: 0.78,
    gothic: 0.88,
    french: 1.02
  };

  const NOTE_ANCHORS = {
    scatter: {
      4: { xf: 0.79, yf: 0.54, wf: 0.272, rot: 4.5 },
      5: { xf: 0.18, yf: 0.47, wf: 0.242, rot: -4.5 }
    },
    salon: {
      4: { xf: 0.50, yf: 0.44, wf: 0.33, rot: -1.2 },
      5: { xf: 0.865, yf: 0.775, wf: 0.18, rot: 3.5 }
    },
    column: {
      4: { xf: 0.795, yf: 0.47, wf: 0.255, rot: 5.8 },
      5: { xf: 0.19, yf: 0.59, wf: 0.235, rot: -5.2 }
    }
  };

  function styleFactor(id) {
    return ROT_FACTOR[id] || 1;
  }

  function buildLayout(styleId, layoutId, count, seed, top, bottom) {
    const target = count >= 5 ? 5 : 4;
    const recipes = LAYOUT_RECIPES[layoutId][target];
    const rng = mulberry32(hashString(styleId + layoutId + seed + target));
    const factor = styleFactor(styleId);
    const margin = 34;
    return recipes.map((r, i) => {
      const w = r.w * W;
      const h = w * (r.ratio == null ? 1.22 : r.ratio);
      let cx = clamp(r.cx * W, w / 2 + margin, W - w / 2 - margin);
      let cy = top + r.cy * (bottom - top);
      cy = clamp(cy, top + h / 2 + 4, bottom - h / 2 - 4);
      cx = clamp(cx, w / 2 + margin, W - w / 2 - margin);
      const rot = (r.rot * factor + (rng() - 0.5) * 1.1) * DEG;
      return {
        cx, cy, w, h, rot,
        z: r.z == null ? i : r.z,
        index: i,
        photo: null
      };
    });
  }

  function noteAnchor(layoutId, target, styleId) {
    const a = NOTE_ANCHORS[layoutId][target];
    const xf = a.xf;
    const w = a.wf * W;
    return {
      xf,
      yf: a.yf,
      cx: clamp(xf * W, w / 2 + 26, W - w / 2 - 26),
      cy: a.yf * H,
      w,
      rot: a.rot
    };
  }

  /* ------------------------------------------------------------------ */
  /* extra drawn objects                                                 */
  /* ------------------------------------------------------------------ */

  function drawSmiley(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(255,248,230,.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-r * 0.34, -r * 0.18, r * 0.09, 0, TAU);
    ctx.arc(r * 0.34, -r * 0.18, r * 0.09, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, r * 0.05, r * 0.48, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawStarburst(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const rad = i % 2 ? r * 0.36 : r;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawLightning(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-3, -34);
    ctx.lineTo(18, -34);
    ctx.lineTo(4, -4);
    ctx.lineTo(22, -4);
    ctx.lineTo(-12, 40);
    ctx.lineTo(-2, 8);
    ctx.lineTo(-20, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCheckerStrip(ctx, x, y, w, h, rot, colorA, colorB) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const cell = h / 2;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < Math.ceil(w / cell); col++) {
        ctx.fillStyle = (row + col) % 2 ? colorA : colorB;
        ctx.fillRect(-w / 2 + col * cell, -h / 2 + row * cell, cell, cell);
      }
    }
    ctx.restore();
  }

  function drawInkBranch(ctx, x, y, len, angle, depth, color, alpha, rng) {
    if (depth <= 0 || len < 7) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, depth * 1.35);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.35, -len * 0.05, len, 0);
    ctx.stroke();
    // leaves
    const leafCount = depth > 2 ? 3 : 2;
    for (let i = 0; i < leafCount; i++) {
      const lx = len * (0.32 + i * 0.24);
      const side = i % 2 ? 1 : -1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(lx, side * 8, len * 0.12, len * 0.045, side * 0.6, 0, TAU);
      ctx.fill();
    }
    drawInkBranch(ctx, len * 0.62, 0, len * 0.58, -0.42, depth - 1, color, alpha * 0.88, rng);
    drawInkBranch(ctx, len * 0.48, 0, len * 0.44, 0.48, depth - 1, color, alpha * 0.8, rng);
    ctx.restore();
  }

  function drawLavender(ctx, x, y, len, rot, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = '#6d7e66';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, len);
    ctx.quadraticCurveTo(-8, len * 0.45, 0, 0);
    ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      const yy = -len * 0.08 + t * len * 0.45;
      ctx.fillStyle = i % 2 ? color : U.mixHex(color, '#ffffff', 0.12);
      ctx.beginPath();
      ctx.ellipse(-9 + (i % 3) * 3, yy, 9, 5, -0.5, 0, TAU);
      ctx.ellipse(9 - (i % 3) * 3, yy + 8, 9, 5, 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRose(ctx, x, y, r, petal, leaf, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    // leaves
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.ellipse(-r * 0.9, r * 0.8, r * 0.68, r * 0.24, -0.55, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r * 0.9, r * 0.95, r * 0.72, r * 0.24, 0.55, 0, TAU);
    ctx.fill();
    // outer petals
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7;
      ctx.fillStyle = i % 2 ? U.mixHex(petal, '#ffffff', 0.14) : petal;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46, r * 0.54, r * 0.36, a, 0, TAU);
      ctx.fill();
    }
    // inner spiral
    ctx.strokeStyle = U.mixHex(petal, '#6d3f3f', 0.2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 38; i++) {
      const a = i * 0.42;
      const rr = r * 0.06 + i * r * 0.011;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = U.mixHex(petal, '#ffffff', 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawMoth(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-23, -4, 24, 16, -0.45, 0, TAU);
    ctx.ellipse(23, -4, 24, 16, 0.45, 0, TAU);
    ctx.ellipse(-8, -2, 8, 18, -0.1, 0, TAU);
    ctx.ellipse(8, -2, 8, 18, 0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(238,224,196,.55)';
    ctx.beginPath();
    ctx.arc(-20, -7, 5, 0, TAU);
    ctx.arc(20, -7, 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 14);
    ctx.moveTo(-3, -18);
    ctx.quadraticCurveTo(-12, -32, -19, -26);
    ctx.moveTo(3, -18);
    ctx.quadraticCurveTo(12, -32, 19, -26);
    ctx.stroke();
    ctx.restore();
  }

  function drawButterfly(ctx, x, y, s, colorA, colorB) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = colorA;
    ctx.beginPath();
    ctx.ellipse(-18, -10, 19, 13, -0.6, 0, TAU);
    ctx.ellipse(18, -10, 19, 13, 0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = colorB;
    ctx.beginPath();
    ctx.ellipse(-13, 10, 14, 10, 0.5, 0, TAU);
    ctx.ellipse(13, 10, 14, 10, -0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4b3b32';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 22, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4b3b32';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -20);
    ctx.quadraticCurveTo(-8, -30, -13, -28);
    ctx.moveTo(2, -20);
    ctx.quadraticCurveTo(8, -30, 13, -28);
    ctx.stroke();
    ctx.restore();
  }

  function drawRibbonBow(ctx, x, y, w, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.08);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    const edge = 'rgba(119,66,76,.38)';
    const light = U.mixHex(color, '#ffffff', 0.3);
    const dark = U.mixHex(color, '#7e4652', 0.22);

    // left loop
    ctx.fillStyle = color;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(-w * 0.34, -w * 0.10, w * 0.45, w * 0.25, -0.34, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // right loop
    ctx.beginPath();
    ctx.ellipse(w * 0.34, -w * 0.10, w * 0.45, w * 0.25, 0.34, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // inner folds
    ctx.strokeStyle = 'rgba(255,247,240,.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(-w * 0.34, -w * 0.10, w * 0.31, w * 0.13, -0.34, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(w * 0.34, -w * 0.10, w * 0.31, w * 0.13, 0.34, 0, TAU);
    ctx.stroke();

    // tails
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-w * 0.07, w * 0.08);
    ctx.bezierCurveTo(-w * 0.30, w * 0.35, -w * 0.42, w * 0.66, -w * 0.55, w * 0.88);
    ctx.lineTo(-w * 0.28, w * 0.78);
    ctx.lineTo(-w * 0.18, w * 0.92);
    ctx.bezierCurveTo(-w * 0.12, w * 0.58, -w * 0.02, w * 0.34, w * 0.06, w * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.07, w * 0.08);
    ctx.bezierCurveTo(w * 0.30, w * 0.38, w * 0.30, w * 0.66, w * 0.43, w * 0.86);
    ctx.lineTo(w * 0.18, w * 0.76);
    ctx.lineTo(w * 0.08, w * 0.90);
    ctx.bezierCurveTo(w * 0.05, w * 0.56, -w * 0.01, w * 0.32, -w * 0.06, w * 0.14);
    ctx.closePath();
    ctx.fill();

    // knot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, w * 0.06, w * 0.14, w * 0.17, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = light;
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    ctx.ellipse(-w * 0.03, w * 0.02, w * 0.055, w * 0.08, -0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawVerticalText(ctx, text, x, y, size, font, color, alpha, step) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.font = size + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = Array.from(text);
    let yy = y;
    for (const ch of chars) {
      ctx.fillText(ch, x, yy);
      yy += (step == null ? size * 1.6 : step);
    }
    ctx.restore();
  }

  function drawDashedOutline(ctx, item, color, inset) {
    if (!item) return;
    const grow = inset == null ? 15 : inset;
    ctx.save();
    ctx.translate(item.cx, item.cy);
    ctx.rotate(item.rot);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2;
    ctx.setLineDash([16, 12]);
    rrPath(ctx, -item.w / 2 - grow, -item.h / 2 - grow, item.w + grow * 2, item.h + grow * 2, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawLabel(ctx, text, x, y, rot, style, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = '600 17px ' + engine.FONTS.sans;
    const w = ctx.measureText(text).width + 34;
    const h = 38;
    U.fillRR(ctx, -w / 2, -h / 2, w, h, 5, 'rgba(255,250,240,.38)');
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    U.trackedText(ctx, text, 0, 1, 1.8, 'center');
    ctx.restore();
  }

  function drawDateSeal(ctx, x, y, r, style) {
    const p = style.palette;
    const now = new Date();
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = style.id === 'gothic' ? '#b9a88d' : rgba(p.ink, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r - 6, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = style.id === 'gothic' ? '#cbb997' : rgba(p.ink, 0.7);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 18px ' + engine.FONTS.type;
    ctx.fillText(months[now.getMonth()] + ' ' + now.getDate(), 0, -7);
    ctx.font = '11px ' + engine.FONTS.type;
    ctx.fillText(String(now.getFullYear()), 0, 14);
    ctx.restore();
  }

  function drawPearls(ctx, points, color, alpha) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (const pt of points) {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 3.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* background decorations                                              */
  /* ------------------------------------------------------------------ */

  function drawBackDecor(ctx, style, rng) {
    const p = style.palette;
    const F = engine.FONTS;

    if (style.id === 'japanese') {
      U.radialGlow(ctx, W * 0.24, H * 0.2, 260, 'rgba(255,233,194,.28)', 'rgba(255,233,194,0)');
      // fine grid
      ctx.save();
      ctx.globalAlpha = 0.055;
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 1;
      for (let x = 50; x < 380; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, 250);
        ctx.lineTo(x, 600);
        ctx.stroke();
      }
      for (let y = 250; y < 600; y += 44) {
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(380, y);
        ctx.stroke();
      }
      ctx.restore();
      // vertical margin note
      drawVerticalText(ctx, '日常の記録', 74, 1030, 30, F.song, p.inkSoft, 0.55, 44);
      // petals
      for (let i = 0; i < 14; i++) {
        ctx.save();
        ctx.translate(100 + rng() * 1120, 320 + rng() * 2200);
        ctx.rotate(rng() * TAU);
        ctx.globalAlpha = 0.14 + rng() * 0.12;
        ctx.fillStyle = i % 3 ? '#d99572' : '#b9c5ae';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8 + rng() * 8, 3 + rng() * 3, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      U.drawSparkle(ctx, W * 0.9, H * 0.4, 12, p.accent, 0.35);
      U.drawSparkle(ctx, W * 0.08, H * 0.58, 8, p.accent, 0.3);
    }

    if (style.id === 'american') {
      drawStarburst(ctx, W * 0.82, H * 0.58, 230, p.accent, 0.055);
      drawStarburst(ctx, W * 0.15, H * 0.91, 160, p.second, 0.05);
      ctx.save();
      ctx.translate(W * 0.1, H * 0.24);
      ctx.rotate(-8 * DEG);
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = p.accent;
      ctx.font = '700 150px ' + F.serif;
      ctx.fillText('EST. 2026', 0, 0);
      ctx.restore();
      // halftone corner
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = p.ink;
      for (let y = 2050; y < 2620; y += 22) {
        for (let x = 840; x < 1260; x += 22) {
          ctx.beginPath();
          ctx.arc(x + (y % 44 ? 8 : 0), y, 2.6, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      drawCheckerStrip(ctx, 90, 720, 200, 30, -5 * DEG, p.ink, 'rgba(255,248,232,.55)');
    }

    if (style.id === 'gothic') {
      // moon ring
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#e1d5bd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W * 0.24, H * 0.13, 196, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#e7dcc7';
      ctx.beginPath();
      ctx.arc(W * 0.24, H * 0.13, 186, 0, TAU);
      ctx.fill();
      ctx.restore();
      // pointed arch
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#d4c4a6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.2, H * 0.3);
      ctx.quadraticCurveTo(W * 0.2, H * 0.07, W * 0.5, H * 0.065);
      ctx.quadraticCurveTo(W * 0.8, H * 0.07, W * 0.8, H * 0.3);
      ctx.stroke();
      ctx.restore();
      drawInkBranch(ctx, 60, H * 0.82, 260, -0.5, 4, '#d6c7ab', 0.26, rng);
      drawInkBranch(ctx, W - 40, H * 0.33, 250, Math.PI * 0.72, 4, '#d6c7ab', 0.22, rng);
      drawMoth(ctx, W * 0.16, H * 0.3, 1.5, '#ddcfb4', 0.32);
      D.drawLaceStrip(ctx, W / 2, 84, W * 0.82, 44, '#d8c8aa', 0.14, 0);
      D.drawLaceStrip(ctx, W / 2, H - 90, W * 0.86, 44, '#d8c8aa', 0.12, 0);
      drawVerticalText(ctx, 'MEMENTO MORI', 64, 960, 24, F.copper, '#cdbb9e', 0.35, 35);
    }

    if (style.id === 'french') {
      D.drawLaceStrip(ctx, W / 2, 58, W * 0.88, 46, '#fffbf4', 0.46, 0);
      D.drawLaceStrip(ctx, W / 2, H - 62, W * 0.82, 40, '#fffbf4', 0.35, 0);
      // botanical stems
      drawLavender(ctx, W * 0.08, H * 0.38, 240, 0.12, '#a79bb4', 0.3);
      drawLavender(ctx, W * 0.94, H * 0.61, 270, -0.18, '#a79bb4', 0.28);
      drawRose(ctx, W * 0.08, H * 0.88, 56, '#d7a3aa', '#9eae99', 0.25);
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = p.second;
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.arc(W * 0.5, H * 0.22, 120 + i * 48, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(W * 0.16, H * 0.13);
      ctx.rotate(-6 * DEG);
      ctx.globalAlpha = 0.18;
      ctx.font = 'italic 38px ' + F.hand;
      ctx.fillStyle = p.ink;
      ctx.fillText('le temps suspendu', 0, 0);
      ctx.restore();
    }

    // shared soft paper dots
    ctx.save();
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = 0.08 + rng() * 0.08;
      ctx.fillStyle = i % 2 ? p.accent : p.second;
      ctx.beginPath();
      ctx.arc(60 + rng() * (W - 120), 300 + rng() * (H - 600), 2 + rng() * 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* foreground decorations                                              */
  /* ------------------------------------------------------------------ */

  function drawFrontDecor(ctx, style, items, rng, safeTop, safeBottom) {
    const p = style.palette;
    const F = engine.FONTS;

    if (style.id === 'japanese') {
      U.drawSparkle(ctx, W * 0.72, H * 0.13, 13, p.accent, 0.55);
      U.drawSparkle(ctx, W * 0.18, H * 0.33, 9, p.second, 0.55);
      D.drawCoffeeCup(ctx, W * 0.845, H * 0.185, 0.72, 7 * DEG, 0.94);
      D.drawToast(ctx, W * 0.155, H * 0.755, 0.9, -6 * DEG, 0.95);
      D.drawStrawberry(ctx, W * 0.86, H * 0.91, 0.8, 9 * DEG, 0.9);
      U.drawHeart(ctx, W * 0.23, H * 0.28, 11, p.accent, 0.45);
      drawLabel(ctx, 'A LITTLE JOY', W * 0.76, H * 0.71, 5 * DEG, style, rgba(p.ink, 0.55), 0.8);
      U.drawArrow(ctx, [[W * 0.7, H * 0.7], [W * 0.77, H * 0.73], [W * 0.74, H * 0.77]], rgba(p.accent, 0.45), 3);
      ctx.save();
      ctx.translate(W * 0.085, H * 0.38);
      ctx.rotate(-5 * DEG);
      ctx.globalAlpha = 0.65;
      ctx.font = 'italic 27px ' + F.hand;
      ctx.fillStyle = p.inkSoft;
      ctx.fillText('morning, slowly', 0, 0);
      ctx.restore();
      drawDateSeal(ctx, W * 0.9, H * 0.79, 55, style);
    }

    if (style.id === 'american') {
      drawSmiley(ctx, W * 0.17, H * 0.28, 48, p.accent);
      drawStarburst(ctx, W * 0.84, H * 0.16, 68, p.third, 0.82);
      drawLightning(ctx, W * 0.14, H * 0.6, 1.45, p.second, 0.72);
      D.drawTicketStub(ctx, W * 0.845, H * 0.905, 225, 110, -7 * DEG, 0.94);
      drawLabel(ctx, 'GOOD TIMES', W * 0.17, H * 0.78, -4 * DEG, style, rgba(p.accent, 0.85), 0.9);
      U.drawArrow(ctx, [[W * 0.22, H * 0.38], [W * 0.29, H * 0.44], [W * 0.25, H * 0.49]], rgba(p.second, 0.55), 3);
      U.drawHeart(ctx, W * 0.8, H * 0.35, 10, p.accent, 0.55);
      U.drawSparkle(ctx, W * 0.89, H * 0.7, 11, p.third, 0.8);
      drawCheckerStrip(ctx, W * 0.12, H * 0.86, 170, 26, 10 * DEG, p.accent, 'rgba(255,248,232,.7)');
      drawDateSeal(ctx, W * 0.84, H * 0.675, 48, style);
    }

    if (style.id === 'gothic') {
      D.drawRaven(ctx, W * 0.82, H * 0.925, 1.22, '#12100e', 0.96);
      drawMoth(ctx, W * 0.16, H * 0.24, 1.55, '#d7c8ad', 0.62);
      drawInkBranch(ctx, W * 0.05, H * 0.58, 210, 0.18, 3, '#d8c8ab', 0.28, rng);
      // crescent
      ctx.save();
      ctx.translate(W * 0.82, H * 0.12);
      ctx.fillStyle = '#d9cab1';
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, TAU);
      ctx.arc(10, -5, 23, 0, TAU, true);
      ctx.fill();
      ctx.restore();
      // tiny cross marks
      ctx.save();
      ctx.strokeStyle = 'rgba(219,203,178,.45)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const x = 90 + rng() * 1140;
        const y = 380 + rng() * 2100;
        ctx.beginPath();
        ctx.moveTo(x - 7, y);
        ctx.lineTo(x + 7, y);
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x, y + 7);
        ctx.stroke();
      }
      ctx.restore();
      drawLabel(ctx, 'NOCTURNE', W * 0.81, H * 0.665, 6 * DEG, style, 'rgba(222,206,180,.68)', 0.82);
    }

    if (style.id === 'french') {
      drawRose(ctx, W * 0.135, H * 0.86, 62, '#d8a1aa', '#94a68f', 0.88);
      drawLavender(ctx, W * 0.87, H * 0.13, 230, 0.2, '#a48eb8', 0.82);
      drawLavender(ctx, W * 0.11, H * 0.53, 180, -0.2, '#a48eb8', 0.7);
      D.drawStamp(ctx, W * 0.855, H * 0.73, 68, 7 * DEG, style, 0.9);
      drawButterfly(ctx, W * 0.7, H * 0.12, 1, '#d7a3ad', '#aebcc6');
      drawRibbonBow(ctx, W * 0.73, H * 0.51, 40, '#d8a9b0', 0.7);
      U.drawHeart(ctx, W * 0.84, H * 0.52, 9, p.accent, 0.45);
      drawPearls(ctx, [[W * 0.22, H * 0.33], [W * 0.25, H * 0.35], [W * 0.28, H * 0.38], [W * 0.31, H * 0.4]], '#fff8ee', 0.55);
      ctx.save();
      ctx.translate(W * 0.82, H * 0.57);
      ctx.rotate(-7 * DEG);
      ctx.globalAlpha = 0.7;
      ctx.font = 'italic 34px ' + F.hand;
      ctx.fillStyle = p.ink;
      ctx.fillText('avec amour', 0, 0);
      ctx.restore();
      drawLabel(ctx, 'SOUVENIR', W * 0.18, H * 0.72, -4 * DEG, style, rgba(p.ink, 0.55), 0.82);
      drawDateSeal(ctx, W * 0.18, H * 0.95, 50, style);
    }
  }

  /* ------------------------------------------------------------------ */
  /* finishing touches                                                   */
  /* ------------------------------------------------------------------ */

  function drawFinishing(ctx, style, state) {
    const p = style.palette;
    if (state.safeArea !== false) {
      const top = ctx.createLinearGradient(0, 0, 0, 480);
      top.addColorStop(0, style.id === 'gothic' ? 'rgba(0,0,0,.35)' : 'rgba(30,20,12,.18)');
      top.addColorStop(1, 'rgba(30,20,12,0)');
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, 480);
      const bottom = ctx.createLinearGradient(0, H - 280, 0, H);
      bottom.addColorStop(0, 'rgba(20,14,9,0)');
      bottom.addColorStop(1, style.id === 'gothic' ? 'rgba(0,0,0,.4)' : 'rgba(30,20,12,.2)');
      ctx.fillStyle = bottom;
      ctx.fillRect(0, H - 280, W, 280);
    }

    // grain
    const grain = U.drawGrain();
    const pat = ctx.createPattern(grain, 'repeat');
    ctx.save();
    ctx.globalAlpha = style.id === 'gothic' ? 0.34 : 0.42;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // a last breath of warm light
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    U.radialGlow(ctx, W * 0.82, H * 0.05, W * 0.8, style.id === 'gothic' ? 'rgba(210,205,186,.08)' : 'rgba(255,230,190,.12)', 'rgba(255,230,190,0)');
    ctx.restore();

    // thin deckled edge
    ctx.save();
    ctx.strokeStyle = style.id === 'gothic' ? 'rgba(225,210,184,.1)' : rgba(p.ink, 0.08);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(18, 18, W - 36, H - 36);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* main render                                                         */
  /* ------------------------------------------------------------------ */

  function rotatedBounds(item, pad) {
    const p = pad || 6;
    const cos = Math.abs(Math.cos(item.rot));
    const sin = Math.abs(Math.sin(item.rot));
    const hw = (item.w * cos + item.h * sin) / 2 + p;
    const hh = (item.w * sin + item.h * cos) / 2 + p;
    return {
      left: item.cx - hw,
      right: item.cx + hw,
      top: item.cy - hh,
      bottom: item.cy + hh
    };
  }

  function overlaps(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function markCaptionVisibility(items, na) {
    const ordered = items.filter((it) => it.photo).sort((a, b) => (a.z - b.z) || (a.index - b.index));
    const noteRect = {
      left: na.cx - na.w / 2 - 16,
      right: na.cx + na.w / 2 + 16,
      top: na.cy - 140,
      bottom: na.cy + 140
    };
    ordered.forEach((item, index) => {
      item.captionHidden = false;
      const band = {
        left: item.cx - item.w * 0.52,
        right: item.cx + item.w * 0.52,
        top: item.cy + item.h * 0.32,
        bottom: item.cy + item.h * 0.54
      };
      const later = ordered.slice(index + 1);
      if (later.some((other) => overlaps(band, rotatedBounds(other, 4)))) {
        item.captionHidden = true;
      }
      if (overlaps(band, noteRect)) item.captionHidden = true;
    });
  }

  function renderWallpaper(ctx, state) {
    const style = STYLES[state.styleId] || STYLES.japanese;
    const photos = state.photos || [];
    const count = photos.length;
    const target = count >= 5 ? 5 : 4;
    const safeTop = state.safeArea === false ? 160 : 470;
    const safeBottom = state.safeArea === false ? 2740 : 2580;
    const layout = buildLayout(style.id, state.layoutId, count, state.seed, safeTop, safeBottom);
    const rng = mulberry32(hashString(style.id + state.layoutId + state.seed + count + 'v4'));
    const items = layout.map((it, i) => Object.assign({}, it, {
      photo: photos[i] || null,
      index: i
    }));
    const na = noteAnchor(state.layoutId, target, style.id);
    markCaptionVisibility(items, na);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    D.drawBackground(ctx, style, rng);
    D.drawScraps(ctx, style, rng, { top: safeTop, bottom: safeBottom });
    drawBackDecor(ctx, style, rng);

    // ghost frames first, then real photos according to z
    const ghosts = items.filter((it) => !it.photo);
    ghosts.forEach((it) => D.drawPhoto(ctx, it, style, it.index, rng));
    const real = items.filter((it) => it.photo).sort((a, b) => (a.z - b.z) || (a.index - b.index));
    const outlineColor = style.id === 'gothic'
      ? 'rgba(218,201,173,.48)'
      : (style.id === 'american' ? rgba(style.palette.accent, 0.55) : rgba(style.palette.accent, 0.55));
    real.forEach((it, index) => {
      D.drawPhoto(ctx, it, style, it.index, rng);
      // Draw the dashed marker directly after its photo, so later snapshots
      // can tuck over it like real paper instead of cutting a line across them.
      if (index === real.length - 1) drawDashedOutline(ctx, it, outlineColor, 14);
    });

    drawFrontDecor(ctx, style, items, rng, safeTop, safeBottom);

    if (state.showNote !== false) {
      D.drawNote(ctx, style, state.note, na, rng);
    }

    // post-note accents
    if (style.id === 'french') {
      U.drawSparkle(ctx, W * 0.9, H * 0.32, 9, pColor(style, 'accent'), 0.4);
    }

    drawFinishing(ctx, style, state);
    ctx.restore();

    return { items, target, safeTop, safeBottom };
  }

  function pColor(style, key) {
    return style.palette[key];
  }

  window.MomentoArt.renderWallpaper = renderWallpaper;
  window.MomentoArt.buildLayout = buildLayout;
  window.MomentoArt.noteAnchor = noteAnchor;
})();
