/* ============================================================
   Live vortex background - raw WebGL, zero dependencies.

   The funnel in the reference screenshot is thousands of thin
   orbital streaks (plus a little "dust") rotating around a
   vertical axis, faster near the waist - like Keplerian orbits.
   We reproduce it with a particle system whose motion is computed
   entirely in the vertex shader from a single time uniform, so
   the CPU does no per-frame work and 60fps is trivial even on
   integrated graphics.

   Shape: a surface of revolution. Each particle owns a height
   parameter u in [0,1]; radius follows
     R(u) = waist + (max - waist) * |2u - 1|^1.55
   which is wide at both ends and pinched in the middle - the
   trumpet/hourglass silhouette from the screenshot.

   Each streak is one line segment: the two vertices sample the
   same orbit at t and t - lag, producing motion-blurred strands
   with additive blending on the dark page background.
   ============================================================ */

const VERT_SRC = `
attribute vec4 aSeed;   // u, theta0, rand1, rand2
attribute vec2 aMeta;   // trail lag (s), isDust

uniform mat4 uProj;
uniform mat4 uView;
uniform float uTime;
uniform float uSpeed;
uniform float uPointScale;

varying float vFade;

const float R_MAX = 2.15;
const float R_WAIST = 0.32;
const float Y_TOP = 1.05;
const float Y_BOT = -1.15;

void main() {
  float u = aSeed.x;
  float theta = aSeed.y;
  float r1 = aSeed.z;
  float r2 = aSeed.w;
  float lag = aMeta.x;
  float isDust = aMeta.y;

  // Trumpet profile: flared at both ends, pinched at the waist.
  float flare = pow(abs(2.0 * u - 1.0), 1.55);
  float radius = R_WAIST + (R_MAX - R_WAIST) * flare;
  radius *= 0.94 + 0.12 * r1;                            // sheet thickness
  radius *= mix(1.0, 0.45 + 0.85 * fract(r1 * 7.13), isDust); // dust fills the volume

  float t = uTime * uSpeed - lag;
  float omega = 0.85 / (0.18 + radius);                  // waist spins fastest
  float ang = theta + omega * t;

  float breathe = 1.0 + 0.035 * sin(uTime * 0.5 + r2 * 6.2831);
  float y = mix(Y_TOP, Y_BOT, u)
          + 0.05 * sin(uTime * 0.7 + r1 * 6.2831)
          + isDust * (r2 - 0.5) * 0.6;

  vec3 p = vec3(radius * breathe * cos(ang), y, radius * breathe * sin(ang));
  gl_Position = uProj * (uView * vec4(p, 1.0));

  // Brighter toward the glowing waist; tails dimmer than heads.
  float radial = 1.0 - clamp(radius / R_MAX, 0.0, 1.0);
  float coreGlow = 0.3 + 0.7 * pow(radial, 1.4);
  float strand = 0.45 + 0.55 * r2;
  vFade = coreGlow * strand * mix(1.0, 0.3, step(0.001, lag));

  if (isDust > 0.5) {
    gl_PointSize = uPointScale * (0.8 + 1.6 * r2);
    vFade = 0.5 + 0.5 * r1;
  }
}
`;

const FRAG_SRC = `
precision mediump float;

varying float vFade;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uIsDust;

void main() {
  float a = uAlpha * vFade;
  if (uIsDust > 0.5) {
    float d = length(gl_PointCoord - vec2(0.5));
    a *= smoothstep(0.5, 0.12, d);
  }
  gl_FragColor = vec4(uColor, a);
}
`;

export interface VortexOptions {
  /** Orbital streak count (each streak = 1 line segment). */
  streaks?: number;
  /** Floating dust-speck count. */
  dust?: number;
  /** Motion multiplier; 1 matches the reference cadence. */
  speed?: number;
  /** Slow cinematic camera drift around the funnel. */
  drift?: boolean;
}

export interface VortexHandle {
  dispose(): void;
}

const FLOATS_PER_VERT = 6; // aSeed(4) + aMeta(2)

interface ThemeColors {
  bg: [number, number, number];
  streak: [number, number, number];
  dust: [number, number, number];
}

const FALLBACK: ThemeColors = {
  bg: [0.93, 0.95, 0.96],
  streak: [0.55, 0.62, 0.72],
  dust: [0.45, 0.52, 0.62],
};

/**
 * Resolve the vortex palette from the live CSS tokens so the canvas always
 * matches the active theme (light silver strands on paper white; white
 * strands on near-black). Read once at engine creation.
 */
function readThemeColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string): [number, number, number] | null => {
    const raw = styles.getPropertyValue(name).trim();
    const m = /^#([0-9a-f]{6})$/i.exec(raw);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const bg = read("--bg");
  const streak = read("--vortex-streak");
  const dust = read("--text-3");
  if (!bg || !streak || !dust) return FALLBACK;
  return { bg, streak, dust };
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("vortex: could not create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`vortex: shader compile failed: ${log ?? "unknown"}`);
  }
  return shader;
}

/** Column-major perspective matrix. */
function perspective(out: Float32Array, fovy: number, aspect: number, near: number, far: number): void {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
}

/** Column-major look-at matrix (up is +Y). */
function lookAt(
  out: Float32Array,
  ex: number, ey: number, ez: number,
  cx: number, cy: number, cz: number
): void {
  let zx = ex - cx, zy = ey - cy, zz = ez - cz;
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  // x = up × z  (up = 0,1,0)
  let xx = 1 * zz - 0 * zy;
  let xy = 0 * zx - 0 * zz;
  let xz = 0 * zy - 1 * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * ex + xy * ey + xz * ez);
  out[13] = -(yx * ex + yy * ey + yz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez);
  out[15] = 1;
}

function buildGeometry(streakCount: number, dustCount: number): { data: Float32Array; streakVerts: number; dustVerts: number } {
  const streakVerts = streakCount * 2;
  const dustVerts = dustCount;
  const data = new Float32Array((streakVerts + dustVerts) * FLOATS_PER_VERT);

  let i = 0;
  for (let s = 0; s < streakCount; s++) {
    const u = Math.random();
    const theta = Math.random() * Math.PI * 2;
    const r1 = Math.random();
    const r2 = Math.random();
    const lag = 0.12 + Math.random() * 0.3;
    // Head vertex
    data[i++] = u; data[i++] = theta; data[i++] = r1; data[i++] = r2; data[i++] = 0; data[i++] = 0;
    // Tail vertex (same orbit, earlier in time)
    data[i++] = u; data[i++] = theta; data[i++] = r1; data[i++] = r2; data[i++] = lag; data[i++] = 0;
  }
  for (let d = 0; d < dustCount; d++) {
    data[i++] = Math.random();
    data[i++] = Math.random() * Math.PI * 2;
    data[i++] = Math.random();
    data[i++] = Math.random();
    data[i++] = 0;
    data[i++] = 1;
  }
  return { data, streakVerts, dustVerts };
}

export function createVortex(canvas: HTMLCanvasElement, options: VortexOptions = {}): VortexHandle {
  const streakCount = options.streaks ?? 6200;
  const dustCount = options.dust ?? 750;
  const speed = options.speed ?? 1;
  const drift = options.drift ?? true;
  const theme = readThemeColors();

  const gl = canvas.getContext("webgl", {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: true,
    powerPreference: "low-power",
  });
  // Graceful no-op: the CSS fallback gradient on .bg-vortex still shows.
  if (!gl) return { dispose() {} };

  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let streakVerts = 0;
  let dustVerts = 0;
  let loc = {
    aSeed: -1,
    aMeta: -1,
    uProj: null as WebGLUniformLocation | null,
    uView: null as WebGLUniformLocation | null,
    uTime: null as WebGLUniformLocation | null,
    uSpeed: null as WebGLUniformLocation | null,
    uPointScale: null as WebGLUniformLocation | null,
    uColor: null as WebGLUniformLocation | null,
    uAlpha: null as WebGLUniformLocation | null,
    uIsDust: null as WebGLUniformLocation | null,
  };

  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  let pointScale = 2;

  function setup(): boolean {
    try {
      const vs = compileShader(gl!, gl!.VERTEX_SHADER, VERT_SRC);
      const fs = compileShader(gl!, gl!.FRAGMENT_SHADER, FRAG_SRC);
      const prog = gl!.createProgram();
      if (!prog) throw new Error("could not create program");
      gl!.attachShader(prog, vs);
      gl!.attachShader(prog, fs);
      gl!.linkProgram(prog);
      gl!.deleteShader(vs);
      gl!.deleteShader(fs);
      if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
        throw new Error(`link failed: ${gl!.getProgramInfoLog(prog) ?? "unknown"}`);
      }
      if (program) gl!.deleteProgram(program);
      program = prog;

      const geo = buildGeometry(streakCount, dustCount);
      streakVerts = geo.streakVerts;
      dustVerts = geo.dustVerts;
      if (buffer) gl!.deleteBuffer(buffer);
      buffer = gl!.createBuffer();
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, geo.data, gl!.STATIC_DRAW);

      loc = {
        aSeed: gl!.getAttribLocation(prog, "aSeed"),
        aMeta: gl!.getAttribLocation(prog, "aMeta"),
        uProj: gl!.getUniformLocation(prog, "uProj"),
        uView: gl!.getUniformLocation(prog, "uView"),
        uTime: gl!.getUniformLocation(prog, "uTime"),
        uSpeed: gl!.getUniformLocation(prog, "uSpeed"),
        uPointScale: gl!.getUniformLocation(prog, "uPointScale"),
        uColor: gl!.getUniformLocation(prog, "uColor"),
        uAlpha: gl!.getUniformLocation(prog, "uAlpha"),
        uIsDust: gl!.getUniformLocation(prog, "uIsDust"),
      };
      return true;
    } catch (err) {
      console.warn("vortex: WebGL init failed, falling back to CSS gradient", err);
      return false;
    }
  }

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl!.viewport(0, 0, w, h);
    perspective(proj, (42 * Math.PI) / 180, w / h, 0.1, 20);
    applyCamera(0);
    pointScale = dpr * (h / 1000) * 2.6;
  }

  /** Slow orbital camera drift; t in seconds (0 = home position). */
  function applyCamera(timeSec: number): void {
    const wob = drift ? Math.sin(timeSec * 0.11) * 0.35 : 0;
    const push = drift ? Math.sin(timeSec * 0.07 + 1.7) * 0.25 : 0;
    lookAt(view, wob, 0.52, 2.95 + push, 0, -0.08, 0);
  }

  function draw(timeSec: number): void {
    if (!program || !buffer) return;
    gl!.clearColor(theme.bg[0], theme.bg[1], theme.bg[2], 1);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.enable(gl!.BLEND);

    // Additive blending only works for strands brighter than the
    // background (dark mode). On light backgrounds the strands are
    // near-black, and adding black changes nothing — so use normal
    // alpha blending there to render dark ink-like strands.
    const lightBg =
      theme.bg[0] + theme.bg[1] + theme.bg[2] > 1.5;

    if (lightBg) {
      gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE_MINUS_SRC_ALPHA);
    } else {
      gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE); // additive glow
    }

    gl!.useProgram(program);
    gl!.uniformMatrix4fv(loc.uProj, false, proj);
    gl!.uniformMatrix4fv(loc.uView, false, view);
    gl!.uniform1f(loc.uTime, timeSec);
    gl!.uniform1f(loc.uSpeed, speed);
    gl!.uniform1f(loc.uPointScale, pointScale);

    const stride = FLOATS_PER_VERT * 4;
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
    gl!.enableVertexAttribArray(loc.aSeed);
    gl!.vertexAttribPointer(loc.aSeed, 4, gl!.FLOAT, false, stride, 0);
    gl!.enableVertexAttribArray(loc.aMeta);
    gl!.vertexAttribPointer(loc.aMeta, 2, gl!.FLOAT, false, stride, 16);

    // Streaks: heads + trails as line segments.
    gl!.uniform3f(loc.uColor, theme.streak[0], theme.streak[1], theme.streak[2]);
    gl!.uniform1f(loc.uAlpha, lightBg ? 0.5 : 0.4);
    gl!.uniform1f(loc.uIsDust, 0);
    gl!.drawArrays(gl!.LINES, 0, streakVerts);

    // Dust: soft round points.
    gl!.uniform3f(loc.uColor, theme.dust[0], theme.dust[1], theme.dust[2]);
    gl!.uniform1f(loc.uAlpha, lightBg ? 0.45 : 0.55);
    gl!.uniform1f(loc.uIsDust, 1);
    gl!.drawArrays(gl!.POINTS, streakVerts, dustVerts);

    if (drift) applyCamera(timeSec);
  }

  let raf = 0;
  let running = false;

  function start(): void {
    if (running || !program) return;
    running = true;
    const frame = (nowMs: number): void => {
      if (!running) return;
      resize();
      draw(nowMs / 1000);
      raf = requestAnimationFrame(frame);
    };    raf = requestAnimationFrame(frame);
  }

  function stop(): void {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // Reduced motion: render a single static frame instead of animating.
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function applyMotion(): void {
    if (motionQuery.matches) {
      stop();
      resize();
      draw(9.35);
    } else {
      start();
    }
  }
  const onMotionChange = (): void => applyMotion();

  // Stop burning GPU cycles when the canvas is scrolled out of view.
  const io = new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (!visible) {
      stop();
    } else {
      applyMotion();
    }
  });

  const onContextLost = (e: Event): void => {
    e.preventDefault();
    stop();
  };
  const onContextRestored = (): void => {
    if (setup()) applyMotion();
  };

  if (!setup()) return { dispose() {} };
  resize();
  applyMotion();

  io.observe(canvas);
  motionQuery.addEventListener?.("change", onMotionChange);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  const ro = new ResizeObserver(() => {
    if (motionQuery.matches) {
      resize();
      draw(9.35);
    }
  });
  ro.observe(canvas);

  // Re-read the palette when the app flips data-theme on <html> so the
  // canvas always matches the active theme without a remount.
  const themeObserver = new MutationObserver(() => {
    Object.assign(theme, readThemeColors());
    // Static mode needs an explicit repaint; the live loop repaints anyway.
    if (motionQuery.matches) draw(9.35);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return {
    dispose(): void {
      stop();
      io.disconnect();
      ro.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener?.("change", onMotionChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (program) gl!.deleteProgram(program);
      if (buffer) gl!.deleteBuffer(buffer);
      program = null;
      buffer = null;
      // Deliberately NOT calling WEBGL_lose_context.loseContext():
      // React StrictMode remounts effects in dev, and a force-lost
      // context would poison the canvas for the remount. Dropping the
      // program/buffer refs is enough; GC reclaims the rest.
    },
  };
}
