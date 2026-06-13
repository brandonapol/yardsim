// Top-down cartoon plant sprites — drawn procedurally, centered at (0,0).
// Called inside the viewport transform; all sizes are in world pixels.

// ─── Template & color lookup ──────────────────────────────────

const SPRITE_TEMPLATE = {
  tomato:'fruiting',  cherry_tomato:'fruiting', pepper:'fruiting',
  potato:'potato',    sweet_potato:'potato',
  zucchini:'bigleaf', cucumber:'bigleaf',
  green_bean:'vine',  pole_bean:'vine', snap_pea:'vine',
  sunflower:'sunflower',
  marigold:'flower',  nasturtium:'flower',
  strawberry:'strawberry',
  lettuce:'rosette',  spinach:'rosette', kale:'rosette',
  chard:'rosette',    arugula:'rosette',
  basil:'herb',       dill:'herb', cilantro:'herb', chives:'herb',
  carrot:'root',      radish:'root', beet:'root',
};

const SPRITE_COLORS = {
  tomato:        { l1:'#3d7828', l2:'#2c5c1c', fruit:'#e62222' },
  cherry_tomato: { l1:'#3d7828', l2:'#2c5c1c', fruit:'#e62222' },
  pepper:        { l1:'#3c7830', l2:'#2c5c20', fruit:'#f08018' },
  potato:        { l1:'#4a7830', l2:'#385c20', fruit:'#f0eef0' },
  sweet_potato:  { l1:'#486828', l2:'#364e18', fruit:'#d884bc' },
  zucchini:      { l1:'#3a7020', l2:'#284e18', fruit:'#8ab832', vein:'#204010' },
  cucumber:      { l1:'#3a7020', l2:'#284e18', fruit:'#4a7028', vein:'#1e3e10' },
  green_bean:    { l1:'#3a7828', l2:'#2a5c1c', fruit:'#5a8830' },
  pole_bean:     { l1:'#3a7828', l2:'#2a5c1c', fruit:'#5a8830' },
  snap_pea:      { l1:'#4a8830', l2:'#386020', fruit:'#7aaa38' },
  sunflower:     { l1:'#366018', petal:'#f8c020', center:'#6b3010' },
  marigold:      { l1:'#386018', petal:'#f86020', center:'#f8b828' },
  nasturtium:    { l1:'#4a8030', petal:'#f84820', center:'#f8b028' },
  strawberry:    { l1:'#3a7820', l2:'#285c18', fruit:'#e82848' },
  lettuce:       { l1:'#90cc50', l2:'#68a030', inner:'#d0f090' },
  spinach:       { l1:'#3a7830', l2:'#2a5820', inner:'#58a040' },
  kale:          { l1:'#2a5c28', l2:'#1c4020', inner:'#3a7038' },
  chard:         { l1:'#3a6828', l2:'#284e1c', inner:'#5a9038', stem_c:'#e82028' },
  arugula:       { l1:'#4a7828', l2:'#385818', inner:'#6a9840' },
  basil:         { l1:'#2a7820', l2:'#1c5818' },
  dill:          { l1:'#7aaa40', l2:'#5a8830' },
  cilantro:      { l1:'#4a8828', l2:'#386018' },
  chives:        { l1:'#2a6828', l2:'#1e4c1e' },
  carrot:        { l1:'#5a9838', l2:'#3a7020', root:'#e87018' },
  radish:        { l1:'#3a7828', l2:'#285c1c', root:'#e83058' },
  beet:          { l1:'#504898', l2:'#382868', root:'#901868' },
};

// ─── Public entry point ───────────────────────────────────────

// Draw an opaque plant sprite centered at (0,0) within radius r.
function drawPlantSprite(ctx, cat, r, isSelected) {
  const c = SPRITE_COLORS[cat.id] || { l1:'#4a8030', l2:'#326020' };
  const pr = r * 0.8; // plant visuals use 80% of radius

  ctx.save();

  // Soil base — always opaque
  _drawSoilBase(ctx, r, isSelected);

  // Plant body
  const tmpl = SPRITE_TEMPLATE[cat.id] || 'herb';
  switch (tmpl) {
    case 'rosette':    _drawRosette(ctx, pr, c); break;
    case 'herb':       _drawHerb(ctx, pr, c); break;
    case 'fruiting':   _drawFruiting(ctx, pr, c); break;
    case 'potato':     _drawPotato(ctx, pr, c); break;
    case 'bigleaf':    _drawBigLeaf(ctx, pr, c); break;
    case 'vine':       _drawVine(ctx, pr, c); break;
    case 'sunflower':  _drawSunflower(ctx, pr, c); break;
    case 'flower':     _drawFlower(ctx, pr, c); break;
    case 'strawberry': _drawStrawberry(ctx, pr, c); break;
    case 'root':       _drawRoot(ctx, pr, c); break;
    default:           _drawHerb(ctx, pr, c); break;
  }

  ctx.restore();
}

// ─── Soil base ────────────────────────────────────────────────

function _drawSoilBase(ctx, r, isSelected) {
  // Soft drop shadow
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur    = r * 0.5;
  ctx.shadowOffsetX = r * 0.06;
  ctx.shadowOffsetY = r * 0.1;

  const g = ctx.createRadialGradient(-r * 0.22, -r * 0.22, 0, 0, 0, r);
  g.addColorStop(0,   '#a07858');
  g.addColorStop(0.6, '#7a5238');
  g.addColorStop(1,   '#4e2e18');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Selection ring
  if (isSelected) {
    ctx.strokeStyle = '#ffdc50';
    ctx.lineWidth   = r * 0.15;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.08, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ─── Rosette (lettuce, spinach, kale, chard, arugula) ────────

function _drawRosette(ctx, r, c) {
  const n = 8;
  // Outer leaves
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i / n) * Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? c.l1 : c.l2;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.52, r * 0.22, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mid-rib vein
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth   = r * 0.05;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r * 0.95);
    ctx.stroke();
    ctx.restore();
  }
  // Bright center heart
  const cg = ctx.createRadialGradient(-r * 0.05, -r * 0.05, 0, 0, 0, r * 0.28);
  cg.addColorStop(0, c.inner || c.l1);
  cg.addColorStop(1, c.l1);
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Dense herb (basil, dill, cilantro, chives) ───────────────

function _drawHerb(ctx, r, c) {
  const positions = [
    [0, 0, r*0.30],       [r*0.25,-r*0.22,r*0.24], [-r*0.25,-r*0.22,r*0.24],
    [r*0.32, r*0.18,r*0.22], [-r*0.32, r*0.18,r*0.22],
    [0,-r*0.38,r*0.26],   [r*0.18, r*0.32,r*0.20], [-r*0.18, r*0.32,r*0.20],
  ];
  positions.forEach(([hx, hy, hr], i) => {
    if (Math.hypot(hx, hy) > r * 0.92) return;
    ctx.fillStyle = i % 2 === 0 ? c.l1 : (c.l2 || c.l1);
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(hx - hr * 0.3, hy - hr * 0.3, hr * 0.38, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ─── Fruiting plant (tomato, pepper) ─────────────────────────

function _drawFruiting(ctx, r, c) {
  // Foliage blobs
  [[0,0], [r*.24,-r*.22], [-r*.24,-r*.22], [r*.3,r*.18], [-r*.3,r*.18], [0,r*.3]
  ].forEach(([fx, fy], i) => {
    if (Math.hypot(fx, fy) > r * 0.88) return;
    ctx.fillStyle = i % 2 === 0 ? c.l1 : c.l2;
    ctx.beginPath();
    ctx.arc(fx, fy, r * 0.31, 0, Math.PI * 2);
    ctx.fill();
  });
  // Fruit
  [[r*.1,-r*.14], [-r*.18,r*.08], [r*.24,r*.18], [-r*.1,-r*.27], [r*.16,r*.08]
  ].forEach(([fx, fy]) => {
    if (Math.hypot(fx, fy) > r * 0.75) return;
    ctx.fillStyle = c.fruit;
    ctx.beginPath();
    ctx.arc(fx, fy, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(fx + r*.03, fy + r*.03, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(fx - r*.04, fy - r*.04, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ─── Potato/sweet potato ─────────────────────────────────────

function _drawPotato(ctx, r, c) {
  // Bushy leaves
  [[0,0], [r*.22,-r*.2], [-r*.22,-r*.2], [r*.28,r*.18], [-r*.28,r*.18], [0,r*.3]
  ].forEach(([bx, by], i) => {
    if (Math.hypot(bx, by) > r * 0.9) return;
    ctx.fillStyle = i % 2 === 0 ? c.l1 : c.l2;
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  });
  // Small flowers (5 petals each)
  [[r*.1,-r*.1], [-r*.14,r*.05], [r*.2,r*.2]].forEach(([fx, fy]) => {
    if (Math.hypot(fx, fy) > r * 0.82) return;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.fillStyle = c.fruit || '#f0eef0';
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a)*r*.07, fy + Math.sin(a)*r*.07, r*.05, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = '#f8e030';
    ctx.beginPath();
    ctx.arc(fx, fy, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ─── Big leaf (zucchini, cucumber) ───────────────────────────

function _drawBigLeaf(ctx, r, c) {
  // Three large leaves
  [
    { dx: r*.05,  dy:-r*.08, rx:r*.55, ry:r*.44, rot: 0.2 },
    { dx:-r*.2,   dy: r*.14, rx:r*.46, ry:r*.37, rot:-1.2 },
    { dx: r*.22,  dy: r*.2,  rx:r*.38, ry:r*.30, rot: 0.85 },
  ].forEach(({ dx, dy, rx, ry, rot }, i) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(rot);
    ctx.fillStyle = i === 0 ? c.l1 : c.l2;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c.vein || 'rgba(255,255,255,0.18)';
    ctx.lineWidth   = r * 0.04;
    ctx.beginPath();
    ctx.moveTo(0, -ry * 0.8);
    ctx.lineTo(0, ry * 0.8);
    ctx.moveTo(0, 0);
    ctx.lineTo(rx * 0.6, -ry * 0.4);
    ctx.moveTo(0, 0);
    ctx.lineTo(-rx * 0.6, -ry * 0.4);
    ctx.stroke();
    ctx.restore();
  });
  // Fruit
  ctx.save();
  ctx.translate(r * 0.05, r * 0.1);
  ctx.rotate(0.5);
  ctx.fillStyle = c.fruit || c.l1;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.11, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.ellipse(-r*.04, -r*.08, r*.04, r*.1, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// ─── Vine/bean ────────────────────────────────────────────────

function _drawVine(ctx, r, c) {
  // Spiral vine stem
  ctx.strokeStyle = c.l2 || c.l1;
  ctx.lineWidth   = r * 0.07;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.44, -Math.PI / 2, Math.PI * 1.3);
  ctx.stroke();

  // Leaves
  [-0.5, 0.5, 1.5, 2.5].forEach((a, i) => {
    const lx = Math.cos(a) * r * 0.44;
    const ly = Math.sin(a) * r * 0.44;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = i % 2 === 0 ? c.l1 : c.l2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Pods
  [0.0, 1.1, 2.1].forEach(a => {
    const px = Math.cos(a) * r * 0.44 + Math.cos(a + Math.PI * 0.5) * r * 0.16;
    const py = Math.sin(a) * r * 0.44 + Math.sin(a + Math.PI * 0.5) * r * 0.16;
    if (Math.hypot(px, py) > r * 0.82) return;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a + 0.2);
    ctx.fillStyle = c.fruit || c.l1;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.07, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ─── Sunflower ────────────────────────────────────────────────

function _drawSunflower(ctx, r, c) {
  const n = 14;
  // Petals
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i / n) * Math.PI * 2);
    ctx.fillStyle = c.petal;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.66, r * 0.17, r * 0.37, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c89010';
    ctx.lineWidth   = r * 0.02;
    ctx.stroke();
    ctx.restore();
  }
  // Inner (lighter) petal layer
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i / n) * Math.PI * 2 + Math.PI / n);
    ctx.fillStyle = '#fad040';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.52, r * 0.12, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Center disc
  const dg = ctx.createRadialGradient(-r * .06, -r * .06, 0, 0, 0, r * 0.36);
  dg.addColorStop(0, '#8b5012');
  dg.addColorStop(1, '#4b2008');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  // Seed dots
  if (r > 5) {
    ctx.fillStyle = '#3b1808';
    for (let ring = 1; ring <= 2; ring++) {
      const dotCount = ring * 7;
      for (let i = 0; i < dotCount; i++) {
        const a  = (i / dotCount) * Math.PI * 2;
        const dr = ring * r * 0.1;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * dr, Math.sin(a) * dr, r * 0.032, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ─── Daisy flower (marigold, nasturtium) ─────────────────────

function _drawFlower(ctx, r, c) {
  // Two petal layers
  for (let layer = 0; layer < 2; layer++) {
    const n = 10 - layer * 2;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate((i / n) * Math.PI * 2 + layer * Math.PI / n);
      ctx.fillStyle = c.petal;
      ctx.globalAlpha = layer === 0 ? 1 : 0.82;
      ctx.beginPath();
      ctx.ellipse(0, -r * (0.58 - layer * 0.14), r * 0.20, r * (0.30 - layer * 0.04), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  // Center
  const cg = ctx.createRadialGradient(-r * .07, -r * .07, 0, 0, 0, r * 0.22);
  cg.addColorStop(0, '#f8e840');
  cg.addColorStop(1, c.center || '#c89010');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // One leaf poking out
  ctx.save();
  ctx.rotate(0.8);
  ctx.fillStyle = c.l1;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.62, r * 0.18, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Strawberry ───────────────────────────────────────────────

function _drawStrawberry(ctx, r, c) {
  // Trifoliate leaves (3 groups of 3 leaflets)
  for (let g = 0; g < 3; g++) {
    const base = (g / 3) * Math.PI * 2 - Math.PI / 2;
    for (let j = -1; j <= 1; j++) {
      ctx.save();
      ctx.rotate(base + j * 0.36);
      ctx.fillStyle = j === 0 ? c.l1 : (c.l2 || c.l1);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.48, r * 0.17, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  // Berries
  [[r*.1, r*.08], [-r*.12, r*.16], [r*.2,-r*.06]].forEach(([bx, by]) => {
    if (Math.hypot(bx, by) > r * 0.78) return;
    ctx.fillStyle = c.fruit;
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.beginPath();
    ctx.arc(bx - r*.05, by - r*.05, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
    // Seeds
    ctx.fillStyle = '#f8d060';
    for (let k = 0; k < 5; k++) {
      const sa = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(bx + Math.cos(sa)*r*.09, by + Math.sin(sa)*r*.09, r * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// ─── Root top (carrot, radish, beet) ─────────────────────────

function _drawRoot(ctx, r, c) {
  // Ferny / leafy tops
  const stems = 5;
  for (let i = 0; i < stems; i++) {
    const spread = ((i / (stems - 1)) - 0.5) * r * 0.7;
    const angle  = spread * 0.8;
    ctx.save();
    ctx.translate(spread * 0.3, r * 0.08);
    ctx.rotate(angle * 0.5 - Math.PI * 0.5);
    // Main stem
    ctx.strokeStyle = c.l1;
    ctx.lineWidth   = r * 0.07;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.1, -r * 0.38, spread * 0.2, -r * 0.7);
    ctx.stroke();
    // Side leaflets
    ctx.fillStyle = i % 2 === 0 ? c.l1 : (c.l2 || c.l1);
    [-0.4, 0.4].forEach(side => {
      ctx.save();
      ctx.translate(spread * 0.08, -r * 0.38);
      ctx.rotate(side * 1.4);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.14, r * 0.07, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }
  // Root color peeking at base
  const rg = ctx.createRadialGradient(0, r*.15, 0, 0, r*.18, r*.22);
  rg.addColorStop(0, c.root);
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(0, r * 0.18, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}
