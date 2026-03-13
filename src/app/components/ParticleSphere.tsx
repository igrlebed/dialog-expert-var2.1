import { useEffect, useRef, useCallback } from "react";

/**
 * ParticleSphere — fixed full-viewport canvas.
 *
 * Phase 1 (hero scroll 0→0.5): Funnel/tornado — particles scattered wide
 *   at top flow down in streams and assemble into sphere at bottom-center.
 * Phase 2 (hero scroll 0.5): Sphere formed, gently rotating with glow.
 * Phase 3 (hero scroll 0.5→1.0): Sphere dissolves downward funnel (mirror).
 * Phase 4 (other sections): Ambient floating particles across the page.
 */

interface Particle {
  // Unit sphere position
  sx: number; sy: number; sz: number;
  // Funnel scatter params
  funnelAngle: number;   // angle around vertical axis
  funnelHeight: number;  // 0..1 how far up the funnel (1 = top of screen)
  funnelSpread: number;  // horizontal spread multiplier
  arrivalDelay: number;  // 0..0.6 — when this particle starts moving to sphere
  // Visual
  speed: number; phase: number; size: number;
  colorIdx: number;
}

interface FloatingDot {
  x: number; y: number;       // normalized 0..1 base position
  driftXFreq: number; driftYFreq: number;
  driftXAmp: number; driftYAmp: number;
  phase: number;
  size: number;
  colorIdx: number;
  alpha: number;
}

const IS_MOBILE = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
const PARTICLE_COUNT = IS_MOBILE ? 800 : 2800;
const FLOATING_COUNT = IS_MOBILE ? 30 : 80;
const PHI = (1 + Math.sqrt(5)) / 2;

function fibSphere(n: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = (2 * Math.PI * i) / PHI;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return pts;
}

const rand = (a: number, b: number) => Math.random() * (b - a) + a;
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/* ── Floating ambient particles ── */
function makeFloatingDots(): FloatingDot[] {
  const dots: FloatingDot[] = [];
  for (let i = 0; i < FLOATING_COUNT; i++) {
    dots.push({
      x: rand(0.02, 0.98),
      y: rand(0.02, 0.98),
      driftXFreq: rand(0.08, 0.25),
      driftYFreq: rand(0.06, 0.2),
      driftXAmp: rand(15, 50),
      driftYAmp: rand(10, 35),
      phase: rand(0, Math.PI * 2),
      size: rand(0.6, 2.0),
      colorIdx: Math.random() < 0.55 ? 0 : Math.random() < 0.65 ? 1 : 2,
      alpha: rand(0.08, 0.3),
    });
  }
  return dots;
}

export const ParticleSphere = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroProgressRef = useRef(0);
  const heroElRef = useRef<HTMLElement | null>(null);
  const pageProgressRef = useRef(0);
  const timeRef = useRef(0);
  const dimRef = useRef({ w: 0, h: 0 });
  const floatingRef = useRef<FloatingDot[]>([]);

  const updateScroll = useCallback(() => {
    // Only update page progress from window.scrollY (cheap)
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    pageProgressRef.current = docH > 0 ? clamp01(window.scrollY / docH) : 0;
    
    // Hero progress calculation moved to the main loop to avoid layout thrashing on scroll event
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", updateScroll, { passive: true });
    updateScroll();
    
    // Cache hero element and its dimensions
    const heroEl = document.getElementById("hero-sphere-track");
    heroElRef.current = heroEl;
    let heroH = 0;
    let heroTop = 0;
    
    const updateHeroMetrics = () => {
      if (heroEl) {
        const rect = heroEl.getBoundingClientRect();
        heroH = heroEl.offsetHeight - window.innerHeight;
        heroTop = rect.top + window.scrollY;
      }
    };
    
    updateHeroMetrics();
    window.addEventListener("resize", updateHeroMetrics);

    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateHeroMetrics);
    };
  }, [updateScroll]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false }); // Performance: opaque canvas
    if (!ctx) return;
    let animId = 0;

    /* ── Particles with funnel scatter ── */
    const points = fibSphere(PARTICLE_COUNT);
    const particles: Particle[] = points.map(([sx, sy, sz]) => {
      const funnelHeight = rand(0.05, 1.0);
      // Particles higher up have more delay (arrive later to sphere)
      const arrivalDelay = funnelHeight * 0.55 + rand(-0.08, 0.08);
      return {
        sx, sy, sz,
        funnelAngle: rand(0, Math.PI * 2),
        funnelHeight,
        funnelSpread: rand(0.6, 1.4),
        arrivalDelay: clamp01(arrivalDelay),
        speed: rand(0.3, 1.4),
        phase: rand(0, Math.PI * 2),
        size: rand(1.0, 3.0),
        colorIdx: Math.random() < 0.55 ? 0 : Math.random() < 0.65 ? 1 : 2,
      };
    });

    floatingRef.current = makeFloatingDots();

    const COLORS = [[0, 168, 79], [52, 210, 180], [180, 220, 240]];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dimRef.current = { w, h };
    };

    const draw = () => {
      // 1. Update hero progress without layout thrashing (using cached heroTop/heroH)
      // Since we can't easily access the variables from the other useEffect, 
      // we'll just do a cheap calculation here.
      const heroEl = heroElRef.current;
      if (heroEl) {
        const rect = heroEl.getBoundingClientRect();
        const heroH = heroEl.offsetHeight - window.innerHeight;
        if (heroH > 0) heroProgressRef.current = clamp01(-rect.top / heroH);
      }

      timeRef.current += 1 / 60;
      const t = timeRef.current;
      const hp = heroProgressRef.current;
      const pp = pageProgressRef.current;
      const { w, h } = dimRef.current;
      ctx.clearRect(0, 0, w, h);

      /* ── Assembly: 0 = funnel scattered, 1 = sphere ── */
      const assembly = smoothstep(0.0, 0.5, hp);

      /* ── Sphere fading: becomes paler as it assembles ── */
      const sphereFade = 1 - smoothstep(0.3, 0.7, hp) * 0.55;

      /* ── Sphere vertical shift: drifts up slightly before dissolving ── */
      const sphereShift = smoothstep(0.45, 0.55, hp) * -60;

      /* ── Dissolution: same duration as assembly (0.5 range) ── */
      const dissolve = smoothstep(0.5, 1.0, hp);

      const sphereVis = assembly * (1 - dissolve) * sphereFade;

      /* ── Sphere geometry — lower center like reference ── */
      const baseR = Math.min(w, h) * 0.28;
      const cx = w / 2;
      const cy = h * 0.55 + sphereShift;  // center-lower + shift
      const perspective = 900;
      const rotY = t * 0.12 + assembly * 0.6;
      const rotX = -0.15;          // slight tilt
      const cRY = Math.cos(rotY), sRY = Math.sin(rotY);
      const cRX = Math.cos(rotX), sRX = Math.sin(rotX);
      const pulse = 1 + Math.sin(t * 0.35) * 0.012;

      /* ── Funnel geometry ── */
      const funnelTopY = -h * 0.08;           // above viewport
      const funnelBottomY = cy;               // sphere center
      const funnelMaxSpread = w * 0.65;       // max horizontal spread at top
      const funnelVertical = funnelBottomY - funnelTopY;

      /* ── Dissolve funnel (mirrored downward) ── */
      const dissolveFunnelEndY = h * 1.15;    // below viewport
      const dissolveFunnelRange = dissolveFunnelEndY - cy;

      ctx.globalAlpha = dissolve < 1 ? 1.0 : 0;
      if (dissolve >= 1) {
        ctx.globalAlpha = 1;
        drawFloatingParticles(ctx, t, pp, w, h, COLORS, floatingRef.current);
        animId = requestAnimationFrame(draw);
        return;
      }

      /* ── Ambient funnel glow ── */
      if (assembly < 0.85 && dissolve < 0.3) {
        const ga = (1 - assembly) * (1 - dissolve) * 0.1;
        const grd0 = ctx.createRadialGradient(cx, cy - funnelVertical * 0.4, 0, cx, cy - funnelVertical * 0.4, funnelMaxSpread * 1.2);
        grd0.addColorStop(0, `rgba(0,168,79,${ga * 0.6})`);
        grd0.addColorStop(0.5, `rgba(52,210,123,${ga * 0.2})`);
        grd0.addColorStop(1, "rgba(0,168,79,0)");
        ctx.fillStyle = grd0;
        ctx.beginPath();
        ctx.arc(cx, cy - funnelVertical * 0.4, funnelMaxSpread * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      /* ── Sphere glow (strong, bottom-heavy like reference) ── */
      if (sphereVis > 0.05) {
        // Main sphere glow
        const ga = sphereVis * 0.18;
        const grd = ctx.createRadialGradient(cx, cy, baseR * 0.3, cx, cy, baseR * 2.0);
        grd.addColorStop(0, `rgba(0,168,79,${ga})`);
        grd.addColorStop(0.4, `rgba(52,210,123,${ga * 0.3})`);
        grd.addColorStop(1, "rgba(0,168,79,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * 2.0, 0, Math.PI * 2);
        ctx.fill();

        // Bottom rim hot glow
        const ba = sphereVis * 0.22;
        const bGrd = ctx.createRadialGradient(cx, cy + baseR * 0.7, 0, cx, cy + baseR * 0.7, baseR * 1.2);
        bGrd.addColorStop(0, `rgba(0,220,80,${ba})`);
        bGrd.addColorStop(0.3, `rgba(52,210,123,${ba * 0.4})`);
        bGrd.addColorStop(1, "rgba(0,168,79,0)");
        ctx.fillStyle = bGrd;
        ctx.beginPath();
        ctx.arc(cx, cy + baseR * 0.7, baseR * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      /* ── Main particles ── */
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Per-particle assembly progress (staggered by arrivalDelay)
        const pAssembly = clamp01((assembly - p.arrivalDelay * 0.5) / (1 - p.arrivalDelay * 0.5));

        // ── Funnel position ──
        // Current height along funnel (1 = top, 0 = sphere)
        const curHeight = p.funnelHeight * (1 - pAssembly);
        // Horizontal spread narrows as particle descends
        const curSpread = curHeight * funnelMaxSpread * p.funnelSpread;
        // Slight spiral rotation as descending
        const spiralAngle = p.funnelAngle + curHeight * 1.5 + t * 0.15 * p.speed;
        // Drift/turbulence
        const drift = Math.sin(t * 0.4 * p.speed + p.phase) * (1 - pAssembly) * 20;
        const driftY = Math.cos(t * 0.3 * p.speed + p.phase * 1.3) * (1 - pAssembly) * 10;

        const funnelX = cx + Math.cos(spiralAngle) * curSpread + drift;
        const funnelY = funnelTopY + (funnelBottomY - funnelTopY) * (1 - curHeight) + driftY;

        // ── Sphere position (with surface distortion) ──
        const waveDisp = Math.sin(p.sx * 4 + t * 0.8) * Math.cos(p.sz * 3 + t * 0.6) * 0.04;
        const sR = baseR * pulse * (1 + waveDisp);
        const sx2 = p.sx * sR, sy2 = p.sy * sR, sz2 = p.sz * sR;
        const rx = sx2 * cRY - sz2 * sRY;
        const rz = sx2 * sRY + sz2 * cRY;
        const ry = sy2 * cRX - rz * sRX;
        const rz2 = sy2 * sRX + rz * cRX;
        const proj = perspective / (perspective + rz2);
        const spX = cx + rx * proj;
        const spY = cy + ry * proj;

        // ── Dissolve: downward funnel (mirror of assembly funnel) ──
        // Per-particle staggered dissolve (particles with low funnelHeight leave first)
        const pDissolve = clamp01((dissolve - (1 - p.funnelHeight) * 0.4) / (1 - (1 - p.funnelHeight) * 0.4));
        const pDissolveSmooth = pDissolve * pDissolve * (3 - 2 * pDissolve);
        // How far down the dissolve funnel this particle has traveled
        const dsHeight = p.funnelHeight * pDissolveSmooth;
        // Spread widens as particle goes down
        const dsSpread = dsHeight * funnelMaxSpread * p.funnelSpread;
        // Spiral in opposite direction
        const dsSpiralAngle = p.funnelAngle + Math.PI + dsHeight * 1.5 + t * 0.15 * p.speed;
        const dsDrift = Math.sin(t * 0.4 * p.speed + p.phase) * pDissolveSmooth * 20;
        const dsDriftY = Math.cos(t * 0.3 * p.speed + p.phase * 1.3) * pDissolveSmooth * 10;

        const dsX = cx + Math.cos(dsSpiralAngle) * dsSpread + dsDrift;
        const dsY = cy + dissolveFunnelRange * dsHeight + dsDriftY;

        // ── Final position ──
        let px: number, py: number;
        if (dissolve < 0.01) {
          // Smooth blend: funnel → sphere via eased pAssembly
          const blend = pAssembly * pAssembly * (3 - 2 * pAssembly); // smoothstep
          px = funnelX + (spX - funnelX) * blend;
          py = funnelY + (spY - funnelY) * blend;
        } else {
          // Sphere → downward funnel dissolve
          px = spX + (dsX - spX) * pDissolveSmooth;
          py = spY + (dsY - spY) * pDissolveSmooth;
        }

        if (px < -60 || px > w + 60 || py < -60 || py > h + 60) continue;

        // ── Alpha ──
        // Brighter when in funnel (high scatter), depth-based when in sphere
        const funnelAlpha = 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(t * p.speed + p.phase));
        const sphereAlpha = 0.4 + proj * 0.6;
        const baseAlpha = funnelAlpha + (sphereAlpha - funnelAlpha) * pAssembly;
        const dissolveAlpha = pDissolve > 0.5 ? 1 - (pDissolve - 0.5) / 0.5 : 1;
        const alpha = baseAlpha * dissolveAlpha * sphereFade;
        if (alpha < 0.01) continue;

        // ── Size ──
        const funnelSize = p.size * 0.55;
        const sphereSize = p.size * proj * (0.8 + pAssembly * 0.5);
        const curSize = funnelSize + (sphereSize - funnelSize) * pAssembly;
        const finalSize = curSize * (1 + dissolve * 0.8);
        if (finalSize < 0.1) continue;

        const [cr, cg, cb] = COLORS[p.colorIdx];

        // Glow halo
        if (finalSize > 0.5 && alpha > 0.1) {
          const gr = finalSize * 4;
          const grd = ctx.createRadialGradient(px, py, 0, px, py, gr);
          grd.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha * 0.2})`);
          grd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(px, py, gr, 0, Math.PI * 2);
          ctx.fill();
        }

        // Dot
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, finalSize, 0, Math.PI * 2);
        ctx.fill();
      }

      /* ── Wireframe rings (equator + meridians) ── */
      if (sphereVis > 0.2) {
        const ra = (sphereVis - 0.2) / 0.8 * 0.12;
        ctx.strokeStyle = `rgba(0,168,79,${ra})`;
        ctx.lineWidth = 0.6;

        // Equator ring
        ctx.beginPath();
        for (let j = 0; j <= 80; j++) {
          const a = (j / 80) * Math.PI * 2;
          const wv = 1 + Math.sin(a * 6 + t * 0.8) * 0.02;
          const rx0 = Math.cos(a) * baseR * pulse * wv;
          const rz0 = Math.sin(a) * baseR * pulse * wv;
          const rrx = rx0 * cRY - rz0 * sRY;
          const rrz = rx0 * sRY + rz0 * cRY;
          const rry = -rrz * sRX;
          const rrz2 = rrz * cRX;
          const ps = perspective / (perspective + rrz2);
          const ppx = cx + rrx * ps, ppy = cy + rry * ps;
          j === 0 ? ctx.moveTo(ppx, ppy) : ctx.lineTo(ppx, ppy);
        }
        ctx.stroke();

        // Two tilted meridian rings
        for (let m = 0; m < 2; m++) {
          const tiltAngle = (m === 0 ? Math.PI * 0.5 : Math.PI * 0.25);
          const cT = Math.cos(tiltAngle), sT = Math.sin(tiltAngle);
          ctx.beginPath();
          for (let j = 0; j <= 80; j++) {
            const a = (j / 80) * Math.PI * 2;
            const wv = 1 + Math.sin(a * 5 + t * 0.6 + m) * 0.015;
            const lx = Math.cos(a) * baseR * pulse * wv;
            const ly = Math.sin(a) * baseR * pulse * wv;
            const lz = 0;
            // Tilt
            const tx = lx;
            const ty = ly * cT - lz * sT;
            const tz = ly * sT + lz * cT;
            // World rotation
            const rrx = tx * cRY - tz * sRY;
            const rrz = tx * sRY + tz * cRY;
            const rry = ty * cRX - rrz * sRX;
            const rrz2 = ty * sRX + rrz * cRX;
            const ps = perspective / (perspective + rrz2);
            const ppx = cx + rrx * ps, ppy = cy + rry * ps;
            j === 0 ? ctx.moveTo(ppx, ppy) : ctx.lineTo(ppx, ppy);
          }
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      drawFloatingParticles(ctx, t, pp, w, h, COLORS, floatingRef.current);
      animId = requestAnimationFrame(draw);
    };

    let rt: ReturnType<typeof setTimeout>;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(resize, 80); };
    resize();

    // Wait for initial render to complete before starting animation loop
    const delayStart = setTimeout(() => {
      animId = requestAnimationFrame(draw);
    }, 500);

    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(delayStart);
      cancelAnimationFrame(animId);
      clearTimeout(rt);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[1] pointer-events-none"
      style={{ willChange: "transform" }}
    />
  );
};

/* ── Ambient floating particles (replace satellite mini-spheres) ── */
function drawFloatingParticles(
  ctx: CanvasRenderingContext2D,
  t: number,
  pageProgress: number,
  w: number,
  h: number,
  COLORS: number[][],
  dots: FloatingDot[],
) {
  // Visible only after hero (pp > ~0.05 means past hero)
  const vis = smoothstep(0.03, 0.08, pageProgress)
    * (1 - smoothstep(0.92, 1.0, pageProgress)); // fade out near footer
  if (vis < 0.01) return;

  for (const dot of dots) {
    // Gentle floating drift
    const px = dot.x * w + Math.sin(t * dot.driftXFreq + dot.phase) * dot.driftXAmp;
    const py = dot.y * h + Math.cos(t * dot.driftYFreq + dot.phase * 1.7) * dot.driftYAmp;

    // Soft twinkle
    const twinkle = 0.6 + 0.4 * Math.sin(t * 0.8 + dot.phase * 3);
    const alpha = dot.alpha * vis * twinkle;
    if (alpha < 0.01) continue;

    const [cr, cg, cb] = COLORS[dot.colorIdx];

    // Soft glow halo
    if (dot.size > 0.8) {
      const gr = dot.size * 6;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, gr);
      grd.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha * 0.15})`);
      grd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, gr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dot
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, dot.size, 0, Math.PI * 2);
    ctx.fill();
  }
}