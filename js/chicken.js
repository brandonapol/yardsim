class Chicken {
  constructor(x, y, zones) {
    this.x = x;
    this.y = y;
    this.zones = zones; // reference to current zone data for bounds check
    this.targetX = x;
    this.targetY = y;
    this.speed = 18 + Math.random() * 12; // pixels per second
    this.facingLeft = false;
    this.walkFrame = Math.random() * Math.PI * 2; // phase offset so they're not in sync
    this.isPecking = false;
    this.peckFrame = 0;
    this.stateTimer = 2 + Math.random() * 3;
    this.state = 'walking'; // 'walking' | 'pecking' | 'idle'
    this.idleTime = 0;
    // Slight hue variation per chicken
    this.tint = Math.random() > 0.5 ? '#f5f5f0' : '#f0ece0';
    this.wattleColor = Math.random() > 0.3 ? '#e53935' : '#c62828';
  }

  update(dt) {
    this.stateTimer -= dt;

    if (this.stateTimer <= 0) {
      this._pickNewBehavior();
    }

    if (this.state === 'pecking') {
      this.peckFrame += dt * 6;
    } else if (this.state === 'walking') {
      this.walkFrame += dt * 5;
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 3) {
        this._pickNewBehavior();
      } else {
        const step = Math.min(this.speed * dt, dist);
        const nx = this.x + (dx / dist) * step;
        const ny = this.y + (dy / dist) * step;
        // If the next step would enter a garden, pick a new target instead
        if (this.zones.gardens.some(g => pointInPolygon(nx, ny, g.points))) {
          this._findNewTarget();
        } else {
          this.x = nx;
          this.y = ny;
          if (Math.abs(dx) > 2) this.facingLeft = dx < 0;
        }
      }
    }
    // 'idle' just waits for stateTimer
  }

  _pickNewBehavior() {
    const roll = Math.random();
    if (roll < 0.5) {
      // Walk to a new spot
      this.state = 'walking';
      this.stateTimer = 4 + Math.random() * 6;
      this._findNewTarget();
    } else if (roll < 0.8) {
      // Peck at the ground
      this.state = 'pecking';
      this.peckFrame = 0;
      this.stateTimer = 1.5 + Math.random() * 2.5;
    } else {
      // Stand idle
      this.state = 'idle';
      this.stateTimer = 1 + Math.random() * 2;
    }
  }

  _isValidPosition(x, y) {
    return pointInPolygon(x, y, this.zones.property.points) &&
           !this.zones.gardens.some(g => pointInPolygon(x, y, g.points));
  }

  _findNewTarget() {
    const pts = this.zones.property.points;
    const bb  = getBoundingBox(pts);
    for (let attempts = 0; attempts < 100; attempts++) {
      const tx = bb.minX + Math.random() * (bb.maxX - bb.minX);
      const ty = bb.minY + Math.random() * (bb.maxY - bb.minY);
      if (this._isValidPosition(tx, ty)) {
        this.targetX = tx;
        this.targetY = ty;
        return;
      }
    }
    // No valid target found — stay put
    this.targetX = this.x;
    this.targetY = this.y;
  }

  // ctx already has the viewport transform applied — draw in world coordinates.
  draw(ctx) {
    const s = 14; // size in world pixels; scales naturally with zoom

    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.facingLeft) ctx.scale(-1, 1);

    const bob = this.state === 'walking'
      ? Math.sin(this.walkFrame) * s * 0.06
      : 0;
    const peckBob = this.state === 'pecking'
      ? Math.max(0, Math.sin(this.peckFrame) * s * 0.5)
      : 0;

    this._drawBody(ctx, s, bob);
    this._drawHead(ctx, s, bob, peckBob);
    this._drawLegs(ctx, s, bob);

    ctx.restore();
  }

  _drawBody(ctx, s, bob) {
    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.9 + bob, s * 0.75, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Main body
    ctx.fillStyle = this.tint;
    ctx.strokeStyle = '#d0cfc0';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.ellipse(0, bob, s * 0.75, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wing accent
    ctx.fillStyle = 'rgba(200,195,180,0.5)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, bob + s * 0.05, s * 0.45, s * 0.32, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Tail feathers
    ctx.fillStyle = '#e8e0d0';
    ctx.strokeStyle = '#ccc8b8';
    ctx.lineWidth = s * 0.05;
    // Three tail feathers
    for (let i = -1; i <= 1; i++) {
      ctx.save();
      ctx.translate(-s * 0.65, bob - s * 0.15);
      ctx.rotate(-0.6 + i * 0.25);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.35, s * 0.1, s * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawHead(ctx, s, bob, peckBob) {
    const headX = s * 0.62;
    const headY = bob - s * 0.48 + peckBob;

    // Head
    ctx.fillStyle = this.tint;
    ctx.strokeStyle = '#d0cfc0';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.arc(headX, headY, s * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Comb
    ctx.fillStyle = this.wattleColor;
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = s * 0.03;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(
        headX - s * 0.08 + i * s * 0.1,
        headY - s * 0.28,
        s * 0.08, s * 0.16,
        i * 0.15, 0, Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();
    }

    // Wattle (chin)
    ctx.fillStyle = this.wattleColor;
    ctx.beginPath();
    ctx.ellipse(headX + s * 0.1, headY + s * 0.2, s * 0.1, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ff8f00';
    ctx.beginPath();
    ctx.moveTo(headX + s * 0.30, headY - s * 0.05);
    ctx.lineTo(headX + s * 0.52, headY);
    ctx.lineTo(headX + s * 0.30, headY + s * 0.08);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(headX + s * 0.12, headY - s * 0.08, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(headX + s * 0.15, headY - s * 0.11, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawLegs(ctx, s, bob) {
    ctx.strokeStyle = '#ff8f00';
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = 'round';

    const legBob = this.state === 'walking' ? Math.sin(this.walkFrame) * s * 0.08 : 0;

    // Left leg
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, s * 0.52 + bob);
    ctx.lineTo(-s * 0.12, s * 0.82 + bob - legBob);
    ctx.stroke();
    // Left toes
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, s * 0.82 + bob - legBob);
    ctx.lineTo(-s * 0.28, s * 0.9 + bob - legBob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, s * 0.82 + bob - legBob);
    ctx.lineTo(-s * 0.0, s * 0.93 + bob - legBob);
    ctx.stroke();

    // Right leg
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(s * 0.18, s * 0.52 + bob);
    ctx.lineTo(s * 0.18, s * 0.82 + bob + legBob);
    ctx.stroke();
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(s * 0.18, s * 0.82 + bob + legBob);
    ctx.lineTo(s * 0.0, s * 0.9 + bob + legBob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.18, s * 0.82 + bob + legBob);
    ctx.lineTo(s * 0.32, s * 0.93 + bob + legBob);
    ctx.stroke();
  }
}
