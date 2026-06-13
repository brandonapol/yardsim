// Procedural cartoon terrain renderer.
// Scale: 5 px/ft. TILE_SIZE = 5px = 1ft per tile (snaps to placement grid).
// Drawing is in world space — viewport transform is already applied by caller.

const TILE_SIZE = 5; // world px per tile (2ft × 2.5px/ft)

const TILE_EXTERIOR = 0;
const TILE_GRASS    = 1;
const TILE_SOIL     = 2;

const GRASS_COLORS = ['#527e3c', '#5a8842', '#628e4a', '#4e7836', '#6a9652', '#578542'];
const SOIL_COLORS  = ['#8b5e3c', '#7a5030', '#986848', '#6e4828', '#8a5a36'];
const EXT_COLORS   = ['#2e4824', '#253c1c', '#334f28', '#2a421f', '#2d4720'];

// ─── Custom painted tiles (user overrides zone-based type) ────
// key: "tx,ty"  value: TILE_GRASS | TILE_SOIL
let _customTiles = {};

function setCustomTile(tx, ty, type) {
  const key = `${tx},${ty}`;
  if (type === null) {
    delete _customTiles[key];
  } else {
    _customTiles[key] = type;
  }
  _typeCache.delete(key); // invalidate cached entry for this cell
}

function clearCustomTile(tx, ty) { setCustomTile(tx, ty, null); }

function getCustomTiles() { return { ..._customTiles }; }

function loadCustomTiles(data) {
  _customTiles = data || {};
  _typeCache.clear();
}

// ─── Zone-based type cache ────────────────────────────────────
let _typeCache = new Map();
let _cacheTag  = '';

function _zoneTag(zones) {
  return zones.property.points.flat().join(',') + '|' + zones.gardens.length;
}

function invalidateTerrainCache() {
  _typeCache.clear();
  _cacheTag = '';
}

function _getType(tx, ty, zones) {
  const key = `${tx},${ty}`;

  const tag = _zoneTag(zones);
  if (tag !== _cacheTag) { _typeCache.clear(); _cacheTag = tag; }
  if (_typeCache.has(key)) return _typeCache.get(key);

  // Custom override wins over zone-based calculation
  if (Object.prototype.hasOwnProperty.call(_customTiles, key)) {
    const t = _customTiles[key];
    _typeCache.set(key, t);
    return t;
  }

  const cx = (tx + 0.5) * TILE_SIZE;
  const cy = (ty + 0.5) * TILE_SIZE;
  let type = TILE_EXTERIOR;
  if (pointInPolygon(cx, cy, zones.property.points)) {
    type = TILE_GRASS;
    if (zones.gardens.some(g => pointInPolygon(cx, cy, g.points))) type = TILE_SOIL;
  }
  _typeCache.set(key, type);
  return type;
}

// ─── Deterministic per-tile RNG ───────────────────────────────
function _makeRng(tx, ty) {
  let s = ((tx * 1234567) ^ (ty * 7654321) ^ 99991) | 0;
  return function () {
    s = (Math.imul(s ^ (s >>> 15), 0x4e995bf1)) | 0;
    s = (Math.imul(s ^ (s >>> 12), 0x4e995bf1)) | 0;
    return ((s ^ (s >>> 15)) >>> 0) / 0xffffffff;
  };
}

// ─── Public API ───────────────────────────────────────────────

function drawTerrain(ctx, viewport, zones, cw, ch) {
  const x0 = (0  - viewport.x) / viewport.zoom;
  const y0 = (0  - viewport.y) / viewport.zoom;
  const x1 = (cw - viewport.x) / viewport.zoom;
  const y1 = (ch - viewport.y) / viewport.zoom;

  const tx0 = Math.floor(x0 / TILE_SIZE) - 1;
  const ty0 = Math.floor(y0 / TILE_SIZE) - 1;
  const tx1 = Math.ceil(x1  / TILE_SIZE) + 1;
  const ty1 = Math.ceil(y1  / TILE_SIZE) + 1;

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      _drawTile(ctx, tx, ty, zones, viewport.zoom);
    }
  }
}

// ─── Tile rendering ───────────────────────────────────────────

function _drawTile(ctx, tx, ty, zones, zoom) {
  const type = _getType(tx, ty, zones);
  const rand = _makeRng(tx, ty);
  const wx   = tx * TILE_SIZE;
  const wy   = ty * TILE_SIZE;
  const s    = TILE_SIZE;

  const palette = type === TILE_GRASS ? GRASS_COLORS
                : type === TILE_SOIL  ? SOIL_COLORS
                : EXT_COLORS;

  ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
  ctx.fillRect(wx, wy, s, s);

  // Skip all detail work at very low zoom (tiles are < 4px on screen)
  const screenSize = s * zoom;
  if (screenSize < 4) return;

  if      (type === TILE_GRASS) _grassDetails(ctx, wx, wy, s, rand, zoom, screenSize);
  else if (type === TILE_SOIL)  _soilDetails(ctx, wx, wy, s, rand, zoom, screenSize);
  else if (screenSize > 6)      _extDetails(ctx, wx, wy, s, rand);
}

function _grassDetails(ctx, wx, wy, s, rand, zoom, screenSize) {
  if (screenSize < 6) return;

  // Top-left highlight / bottom shadow (pseudo-3D)
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(wx, wy, s, 1);
  ctx.fillRect(wx, wy, 1, s);
  ctx.fillStyle = 'rgba(0,0,0,0.09)';
  ctx.fillRect(wx, wy + s - 1, s, 1);

  // Occasional dappled shadow blob
  if (rand() > 0.62 && screenSize > 10) {
    const pr = (1.5 + rand() * 2.5);
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.beginPath();
    ctx.ellipse(wx + pr + rand() * (s - pr * 2), wy + pr + rand() * (s - pr * 2),
                pr, pr * 0.65, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  if (screenSize < 10) return; // tufts only when tile is ≥10px on screen

  // Grass tufts (2–4 per tile)
  const n = 2 + Math.floor(rand() * 3);
  ctx.strokeStyle = 'rgba(55, 105, 30, 0.68)';
  ctx.lineWidth   = Math.max(0.3, 0.6 / zoom);
  ctx.lineCap     = 'round';
  for (let i = 0; i < n; i++) {
    const bx = wx + 0.8 + rand() * (s - 1.6);
    const by = wy + 1   + rand() * (s - 2);
    const h  = 0.8 + rand() * 1.2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - h * 0.55, by - h);       ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + h * 0.55, by - h);       ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx,             by - h * 1.2); ctx.stroke();
  }

  if (screenSize < 18) return; // flowers only at higher zoom

  // Occasional wildflower (1-in-5 tiles)
  if (rand() > 0.80) {
    const fx = wx + 1 + rand() * (s - 2);
    const fy = wy + 1 + rand() * (s - 2);
    const FLOWER_COLORS = ['#ffcc44','#ff9999','#cc88ff','#ffffff','#ffbbcc','#88ddff'];
    const fc = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.fillStyle = fc;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 0.65, fy + Math.sin(a) * 0.65, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(fx, fy, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _soilDetails(ctx, wx, wy, s, rand, zoom, screenSize) {
  if (screenSize < 8) return;

  // Tilled furrow rows — one dark line per tile at low zoom, denser at high
  const step = screenSize > 20 ? s / 2 : s;
  ctx.lineWidth   = Math.max(0.3, 0.5 / zoom);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  for (let ry = wy + step; ry < wy + s; ry += step) {
    ctx.beginPath(); ctx.moveTo(wx, ry); ctx.lineTo(wx + s, ry); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let ry = wy + step * 0.5; ry < wy + s; ry += step) {
    ctx.beginPath(); ctx.moveTo(wx, ry); ctx.lineTo(wx + s, ry); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.fillRect(wx, wy + s - 1, s, 1);

  if (screenSize < 15) return; // pebbles at closer zoom only

  const n = Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const pr = 0.3 + rand() * 0.5;
    ctx.fillStyle = `rgba(${155+Math.floor(rand()*40)},${125+Math.floor(rand()*30)},${95+Math.floor(rand()*30)},0.7)`;
    ctx.beginPath();
    ctx.ellipse(wx + 0.5 + rand() * (s - 1), wy + 0.5 + rand() * (s - 1),
                pr, pr * 0.65, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _extDetails(ctx, wx, wy, s, rand) {
  // Tree canopy shadow blobs
  const n = 1 + Math.floor(rand() * 3);
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(wx + rand() * s, wy + rand() * s, 2 + rand() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
