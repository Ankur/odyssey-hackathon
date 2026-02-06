/**
 * Subtle trailing sparkle effect for the fingertip cursor.
 * Leaves a soft, fading trail that shimmers — like a wand trace.
 */

interface TrailPoint {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  size: number;
  twinkleOffset: number;
}

export class SparkleSystem {
  private trail: TrailPoint[] = [];
  private lastX = 0;
  private lastY = 0;
  private hasLastPos = false;

  /**
   * Add trail points at the cursor position.
   */
  emit(x: number, y: number) {
    // Only add points when the cursor has moved enough
    if (this.hasLastPos) {
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        // Drop trail points along the path
        const steps = Math.min(Math.ceil(dist / 3), 6);
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const life = 40 + Math.random() * 20;
          this.trail.push({
            x: this.lastX + dx * t + (Math.random() - 0.5) * 3,
            y: this.lastY + dy * t + (Math.random() - 0.5) * 3,
            life,
            maxLife: life,
            size: 3 + Math.random() * 3,
            twinkleOffset: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    this.lastX = x;
    this.lastY = y;
    this.hasLastPos = true;

    // Cap trail length
    if (this.trail.length > 150) {
      this.trail = this.trail.slice(-150);
    }
  }

  /**
   * Update trail points (call once per frame).
   */
  update() {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life--;
      if (this.trail[i].life <= 0) {
        this.trail.splice(i, 1);
      }
    }
  }

  /**
   * Draw the trailing sparkle effect.
   */
  draw(ctx: CanvasRenderingContext2D, color: string) {
    ctx.save();

    for (const p of this.trail) {
      const progress = 1 - p.life / p.maxLife;
      // Smooth fade out
      const fade = 1 - progress * progress;
      // Gentle twinkle
      const twinkle = 0.6 + 0.4 * Math.sin(p.life * 0.5 + p.twinkleOffset);
      const alpha = fade * twinkle * 0.6;
      const size = p.size * (1 - progress * 0.4);

      if (alpha <= 0.01) continue;

      // Soft glow
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw the cursor dot with a soft glow.
   */
  drawCursor(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    isExtended: boolean,
  ) {
    ctx.save();

    const baseSize = isExtended ? 6 : 4;

    // Soft glow
    ctx.globalAlpha = isExtended ? 0.25 : 0.1;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, baseSize * 3, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.globalAlpha = 1;
    ctx.fillStyle = isExtended ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, baseSize, 0, Math.PI * 2);
    ctx.fill();

    // Color ring when extended
    if (isExtended) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(x, y, baseSize + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  reset() {
    this.trail = [];
    this.hasLastPos = false;
  }
}
