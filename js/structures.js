// Unique non-tiling structures: house, garage, driveway.
// Corners are snapped to the 2ft grid (multiples of 5px).
// Approximate positions below — use the coordinate display + zone editor to refine,
// then hit "Export Map" and paste back here.

const STRUCT_VERSION = 2;

// ─── Default structure definitions ───────────────────────────
// All points in world-pixel space (954×972), snapped to 5px (1ft) grid.
// Calibrated via zone editor + export 2026-06-13. Scale: 5px = 1ft.
const DEFAULT_STRUCTURES = [
  {
    id: 'driveway',
    label: 'Driveway',
    type: 'driveway',
    // 40px wide = 8ft, runs from road (y=40) south to garage (y=425)
    points: [[870, 40], [910, 40], [910, 425], [870, 425]]
  },
  {
    id: 'house',
    label: 'House',
    type: 'house',
    // L-shaped footprint calibrated from satellite
    points: [
      [800, 360], [760, 360], [760, 390], [710, 390],
      [710, 240], [840, 240], [840, 320], [800, 320]
    ]
  },
  {
    id: 'garage',
    label: 'Garage',
    type: 'garage',
    // 65px wide × 115px deep = ~13ft × 23ft
    points: [[855, 425], [920, 425], [920, 540], [855, 540]]
  }
];

// ─── Style per structure type ─────────────────────────────────
const STRUCT_STYLES = {
  house: {
    fill:        '#b5a898',   // warm grey roof
    ridgeFill:   '#8a7d74',   // darker ridge
    border:      '#6b5e55',
    labelColor:  '#fff'
  },
  garage: {
    fill:        '#a89888',
    doorFill:    '#c0b4a8',
    border:      '#6b5e55',
    labelColor:  '#fff'
  },
  driveway: {
    fill:        '#c0b8a8',   // gravel
    border:      '#a0988a',
    labelColor:  '#555'
  }
};

// ─── Persistence ─────────────────────────────────────────────

function loadStructures() {
  try {
    const raw = localStorage.getItem('yardsim_structures');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === STRUCT_VERSION) return parsed.data;
    }
  } catch (e) {
    console.warn('Could not load structures:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STRUCTURES));
}

function saveStructures(structs) {
  localStorage.setItem('yardsim_structures',
    JSON.stringify({ version: STRUCT_VERSION, data: structs }));
}

// ─── Rendering ───────────────────────────────────────────────

function drawStructures(ctx, structures, zoom) {
  // Draw driveways first (lowest layer), then buildings on top
  const order = ['driveway', 'garage', 'house'];
  order.forEach(type => {
    structures.filter(s => s.type === type).forEach(s => _drawStructure(ctx, s, zoom));
  });
}

function _drawStructure(ctx, s, zoom) {
  const style = STRUCT_STYLES[s.type] || { fill: '#999', border: '#666', labelColor: '#fff' };
  const pts   = s.points;
  if (!pts || pts.length < 3) return;

  // ── Base fill ──
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = style.fill;
  ctx.fill();

  // ── Type-specific details ──
  const bb = getBoundingBox(pts);
  if (s.type === 'house')    _houseDetails(ctx, bb, style, zoom);
  if (s.type === 'garage')   _garageDetails(ctx, bb, style, zoom);
  if (s.type === 'driveway') _drivewayDetails(ctx, bb, style, zoom);

  // ── Border ──
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.strokeStyle = style.border;
  ctx.lineWidth   = Math.max(0.5, 1.5 / zoom);
  ctx.stroke();

  // ── Drop shadow (south/east edge) ──
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle   = '#000';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.shadowColor  = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur   = 4 / zoom;
  ctx.shadowOffsetX = 2 / zoom;
  ctx.shadowOffsetY = 2 / zoom;
  ctx.fill();
  ctx.restore();

  // ── Label ──
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const fontSize = Math.max(3, 9 / zoom);
  ctx.save();
  ctx.font      = `bold ${fontSize}px 'Fredoka One', sans-serif`;
  ctx.fillStyle = style.labelColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = 2 / zoom;
  ctx.fillText(s.label, cx, cy);
  ctx.restore();
}

function _houseDetails(ctx, bb, style, zoom) {
  const w = bb.maxX - bb.minX;
  const h = bb.maxY - bb.minY;
  // Ridge line down the long axis
  if (w >= h) {
    // Wide house — horizontal ridge
    const mid = bb.minY + h / 2;
    ctx.strokeStyle = style.ridgeFill;
    ctx.lineWidth   = Math.max(0.5, 2 / zoom);
    ctx.beginPath();
    ctx.moveTo(bb.minX + w * 0.1, mid);
    ctx.lineTo(bb.maxX - w * 0.1, mid);
    ctx.stroke();
    // Roof slope shading (north half lighter)
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(bb.minX, bb.minY, w, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(bb.minX, mid, w, h / 2);
  } else {
    // Tall house — vertical ridge
    const mid = bb.minX + w / 2;
    ctx.strokeStyle = style.ridgeFill;
    ctx.lineWidth   = Math.max(0.5, 2 / zoom);
    ctx.beginPath();
    ctx.moveTo(mid, bb.minY + h * 0.1);
    ctx.lineTo(mid, bb.maxY - h * 0.1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(bb.minX, bb.minY, w / 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(mid, bb.minY, w / 2, h);
  }
}

function _garageDetails(ctx, bb, style, zoom) {
  const w  = bb.maxX - bb.minX;
  const h  = bb.maxY - bb.minY;
  // Garage door on the south face (3 panels)
  const doorH = Math.min(h * 0.35, 8);
  const doorY = bb.maxY - doorH;
  ctx.fillStyle = style.doorFill;
  ctx.fillRect(bb.minX + 1, doorY, w - 2, doorH);
  // Panel lines
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth   = Math.max(0.3, 0.5 / zoom);
  const pCount = 3;
  for (let i = 1; i < pCount; i++) {
    const px = bb.minX + (w / pCount) * i;
    ctx.beginPath();
    ctx.moveTo(px, doorY);
    ctx.lineTo(px, bb.maxY);
    ctx.stroke();
  }
  // Horizontal panel dividers
  const rowH = doorH / 2;
  ctx.beginPath();
  ctx.moveTo(bb.minX, doorY + rowH);
  ctx.lineTo(bb.maxX, doorY + rowH);
  ctx.stroke();
}

function _drivewayDetails(ctx, bb, style, zoom) {
  const w = bb.maxX - bb.minX;
  const h = bb.maxY - bb.minY;
  // Subtle gravel texture (two faint parallel tracks)
  const trackInset = w * 0.25;
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth   = Math.max(0.5, 1.5 / zoom);
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  // Left track
  ctx.beginPath();
  ctx.moveTo(bb.minX + trackInset, bb.minY);
  ctx.lineTo(bb.minX + trackInset, bb.maxY);
  ctx.stroke();
  // Right track
  ctx.beginPath();
  ctx.moveTo(bb.maxX - trackInset, bb.minY);
  ctx.lineTo(bb.maxX - trackInset, bb.maxY);
  ctx.stroke();
  ctx.setLineDash([]);
}
