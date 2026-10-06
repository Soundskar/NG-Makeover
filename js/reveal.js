// Namita Garg Makeover, burn-away reveal (home page, once per visit).
//
// 1. The velvet cover becomes an invitation: a gold double border fades in,
//    the cusped Lucknawi arch draws itself in gold, and the name rises in.
// 2. A held breath.
// 3. The cover burns away from the bottom up, the way fire climbs, with a
//    shimmering gold rim, gold light spilling onto the page and sparks
//    drifting upward.
//
// The inline script in index.html's <head> adds html.burn-pending before
// the first paint, so a plain velvet cover (CSS) is up from frame one; this
// file takes over from it seamlessly. No WebGL: a short fade. Any tap,
// scroll or key finishes the whole thing in under half a second.

(() => {
  const root = document.documentElement;
  if (!root.classList.contains('burn-pending')) return;

  const done = () => {
    root.classList.remove('burn-pending', 'burn-fade');
  };

  const fade = () => {
    root.classList.add('burn-fade');
    setTimeout(done, 700);
  };

  // On a very slow load the CSS fail-safe has already lifted the cover;
  // burning a fresh one over a page the visitor is reading would be worse.
  if (performance.now() > 3500) {
    done();
    return;
  }

  // ---------- timings (ms) ----------
  const DRAW = 1100;  // border and arch draw on, the name rises in
  const HOLD = 500;   // a held breath with the name on screen
  const BURN = 2800;  // the burn

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.round(vw * dpr);
  const h = Math.round(vh * dpr);

  // ---------- the cover (2D) ----------
  const GOLD = '#C9A35E';
  const GOLD_SOFT = '#E3CB98';

  // the site's arch, as a closed window shape H units tall (100 wide)
  const archPath = (H) => new Path2D(
    `M0 ${H}V58A15 15 0 0 1 5 35A12.5 12.5 0 0 1 16 18A12 12 0 0 1 32 8A11.5 11.5 0 0 1 50 3` +
    `A11.5 11.5 0 0 1 68 8A12 12 0 0 1 84 18A12.5 12.5 0 0 1 95 35A15 15 0 0 1 100 58V${H}Z`
  );
  const archW = Math.min(w * 0.74, h * 0.34);
  const archH = archW * 1.5;
  const s = archW / 100;
  const H = archH / s;
  const arch = archPath(H);
  // longer than the real outline (sides + cusped crown + base), so the
  // draw-on dash never leaves a gap at the end
  const archLen = 2 * (H - 58) + 340;
  const ax = (w - archW) / 2;
  const ay = (h - archH) / 2 + archH * 0.04;

  // both lines of text are sized to sit inside the arch on any screen
  const NAME = 'Namita Garg';
  const TAGLINE = 'BRIDAL MAKEUP STUDIO  ·  LUCKNOW';
  let nameSize = archW * 0.17;
  let tagSize = 10.5 * dpr;
  let tagSpacing = 3.5 * dpr;
  // runs once the display font has had its chance to load
  const sizeText = () => {
    const m = document.createElement('canvas').getContext('2d');
    m.font = `italic 400 ${nameSize}px "Bodoni Moda", Didot, Georgia, serif`;
    nameSize *= Math.min(1, (archW * 0.8) / m.measureText(NAME).width);
    m.font = `500 ${tagSize}px Jost, Futura, sans-serif`;
    const raw = m.measureText(TAGLINE).width + tagSpacing * TAGLINE.length;
    const fit = Math.min(1, (archW * 0.84) / raw);
    tagSize *= Math.max(0.8, fit);
    tagSpacing *= fit;
  };

  const paintCover = (x, p) => {
    x.globalAlpha = 1;
    x.shadowBlur = 0;
    x.setLineDash([]);
    x.fillStyle = '#3D0E18';
    x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, 0, 0, w / 2, 0, Math.max(w, h) * 0.85);
    g.addColorStop(0, '#551A28');
    g.addColorStop(1, 'rgba(61, 14, 24, 0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(20, 3, 8, 0.45)');
    x.fillStyle = v;
    x.fillRect(0, 0, w, h);

    // gold double border, like the edge of a wedding card
    const pb = easeOut(clamp(p * 1.5));
    x.strokeStyle = GOLD;
    x.globalAlpha = 0.6 * pb;
    x.lineWidth = 1 * dpr;
    const i1 = 16 * dpr;
    const i2 = 22 * dpr;
    x.strokeRect(i1, i1, w - i1 * 2, h - i1 * 2);
    x.globalAlpha = 0.35 * pb;
    x.strokeRect(i2, i2, w - i2 * 2, h - i2 * 2);

    // the arch draws itself on: outer line, then a finer inner line
    const pa = easeInOut(clamp(p / 0.85));
    x.save();
    x.translate(ax, ay);
    x.scale(s, s);
    x.globalAlpha = 1;
    x.strokeStyle = GOLD;
    x.shadowColor = 'rgba(227, 203, 152, 0.55)';
    x.shadowBlur = 10 * dpr;
    x.lineWidth = (1.5 * dpr) / s;
    x.setLineDash([archLen, archLen]);
    x.lineDashOffset = archLen * (1 - pa);
    x.stroke(arch);
    x.translate(50, H / 2);
    x.scale(0.93, 0.955);
    x.translate(-50, -H / 2);
    x.globalAlpha = 0.55;
    x.lineWidth = (0.9 * dpr) / (s * 0.93);
    x.lineDashOffset = archLen * (1 - easeInOut(clamp((p - 0.12) / 0.88)));
    x.stroke(arch);
    x.restore();

    // a small star at the crown of the arch
    const ps = easeOut(clamp((p - 0.7) / 0.3));
    x.globalAlpha = ps;
    x.fillStyle = GOLD_SOFT;
    x.shadowBlur = 0;
    x.font = `${12 * dpr}px Jost, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('✦', w / 2, ay - 16 * dpr);

    // the name rises in with a soft gold glow, then the tagline
    const cy = ay + archH * 0.56;
    const pn = easeOut(clamp((p - 0.3) / 0.7));
    x.globalAlpha = pn;
    x.shadowColor = 'rgba(227, 203, 152, 0.45)';
    x.shadowBlur = 24 * dpr;
    x.fillStyle = GOLD_SOFT;
    x.font = `italic 400 ${nameSize}px "Bodoni Moda", Didot, Georgia, serif`;
    x.fillText(NAME, w / 2, cy + (1 - pn) * 14 * dpr);
    x.shadowBlur = 0;

    const pt = easeOut(clamp((p - 0.55) / 0.45));
    x.globalAlpha = pt * 0.9;
    x.fillStyle = '#CDB4AE';
    x.font = `500 ${tagSize}px Jost, Futura, sans-serif`;
    if ('letterSpacing' in x) x.letterSpacing = `${tagSpacing}px`;
    x.fillText(TAGLINE, w / 2, cy + nameSize * 0.85);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    x.globalAlpha = 1;
  };

  // ---------- the burn (WebGL) ----------
  const VERT = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

  // The front is a threshold over (distance from the origin + fbm noise),
  // so it climbs with a ragged, organic edge. Ahead of the front the cover
  // chars and ripples; at the front sits a crisp, shimmering gold rim; just
  // behind it, gold light spills onto the uncovered page.
  const FRAG = `
    precision mediump float;
    uniform sampler2D u_tex;
    uniform float u_t;
    uniform float u_time;
    uniform float u_aspect;
    uniform vec2 u_origin;
    uniform float u_maxd;
    varying vec2 v_uv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
      return v;
    }
    float fbm3(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 q = vec2(v_uv.x * u_aspect, v_uv.y);
      vec2 o = vec2(u_origin.x * u_aspect, u_origin.y);
      float field = distance(q, o) / u_maxd * 0.8 + fbm(q * 3.0) * 0.45;

      float edge = 0.09;
      float intact = smoothstep(u_t - 0.003, u_t + 0.003, field);
      float near = 1.0 - smoothstep(u_t, u_t + edge, field);
      float glow = 1.0 - smoothstep(u_t, u_t + edge * 0.45, field);
      float rim = 1.0 - smoothstep(u_t + 0.004, u_t + 0.016, field);
      float spill = smoothstep(u_t - 0.06, u_t, field) * (1.0 - intact);

      vec2 wobble = vec2(fbm3(q * 7.0 + u_t * 3.0), fbm3(q * 7.0 - u_t * 3.0)) - 0.5;
      vec3 col = texture2D(u_tex, v_uv + wobble * 0.03 * near).rgb;

      float shimmer = 0.78 + 0.22 * sin(fbm3(q * 16.0) * 14.0 + u_time * 7.0);
      vec3 deepGold = vec3(0.70, 0.50, 0.16);
      vec3 brightGold = vec3(1.0, 0.86, 0.52);
      vec3 hotGold = vec3(1.0, 0.97, 0.85);

      col = mix(col, vec3(0.06, 0.01, 0.02), near * 0.8);
      col = mix(col, deepGold, glow * 0.9);
      col = mix(col, mix(brightGold, hotGold, rim * rim) * shimmer, rim);

      vec3 spillCol = brightGold * 0.9;
      float a = max(intact, spill * 0.42);
      vec3 outCol = mix(spillCol * spill * 0.42, col * intact, intact);
      gl_FragColor = vec4(outCol, a);
    }`;

  const glCanvas = document.createElement('canvas');
  glCanvas.className = 'burn-canvas';
  glCanvas.setAttribute('aria-hidden', 'true');
  glCanvas.width = w;
  glCanvas.height = h;
  const gl = glCanvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) {
    fade();
    return;
  }

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const prog = vs && fs && gl.createProgram();
  if (prog) {
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
  }
  if (!prog || !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    fade();
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uT = gl.getUniformLocation(prog, 'u_t');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const aspect = w / h;
  gl.uniform1f(gl.getUniformLocation(prog, 'u_aspect'), aspect);

  // fire climbs: the burn starts just below the bottom edge, centred
  const ox = 0.5;
  const oy = -0.18;
  gl.uniform2f(gl.getUniformLocation(prog, 'u_origin'), ox, oy);
  const maxd = Math.max(Math.hypot(ox * aspect, 1 - oy), Math.hypot(aspect - ox * aspect, 1 - oy));
  gl.uniform1f(gl.getUniformLocation(prog, 'u_maxd'), maxd);
  // T_FROM puts the first flames right on the bottom edge, so the burn is
  // visible from its first frame
  const T_FROM = 0.25;
  const T_TO = 1.3;
  const easeBurn = (p) => -(Math.cos(Math.PI * p) - 1) / 2;

  // ---------- sparks (2D, above the burn) ----------
  // Spawned along an approximation of the front: the ring where distance
  // alone would put it (the noise term averages about 0.22).
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.className = 'burn-canvas burn-sparks';
  sparkCanvas.setAttribute('aria-hidden', 'true');
  sparkCanvas.width = w;
  sparkCanvas.height = h;
  const sx = sparkCanvas.getContext('2d');
  const sprite = document.createElement('canvas');
  sprite.width = 32;
  sprite.height = 32;
  const spx = sprite.getContext('2d');
  const sg = spx.createRadialGradient(16, 16, 0, 16, 16, 16);
  sg.addColorStop(0, 'rgba(255, 246, 214, 1)');
  sg.addColorStop(0.25, 'rgba(240, 200, 110, 0.9)');
  sg.addColorStop(1, 'rgba(201, 163, 94, 0)');
  spx.fillStyle = sg;
  spx.fillRect(0, 0, 32, 32);

  const sparks = [];
  const originPx = { x: ox * w, y: (1 - oy) * h };
  const spawn = (t, count) => {
    const r = ((t - 0.22) / 0.8) * maxd * h;
    if (r <= 0) return;
    for (let i = 0; i < count; i++) {
      const a = Math.PI + Math.random() * Math.PI; // upper half of the ring
      const px = originPx.x + Math.cos(a) * r + (Math.random() - 0.5) * 40 * dpr;
      const py = originPx.y + Math.sin(a) * r + (Math.random() - 0.5) * 30 * dpr;
      if (px < 0 || px > w || py < 0 || py > h) continue;
      sparks.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 40 * dpr,
        vy: -(40 + Math.random() * 110) * dpr,
        life: 0,
        max: 700 + Math.random() * 900,
        size: (3 + Math.random() * 7) * dpr
      });
    }
  };
  let lastSparkTime = 0;
  const drawSparks = (now, dt) => {
    sx.clearRect(0, 0, w, h);
    sx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life += dt;
      if (p.life >= p.max) {
        sparks.splice(i, 1);
        continue;
      }
      p.vx += Math.sin((p.life + p.y) * 0.01) * 0.6 * dpr; // a little flicker sideways
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
      const k = 1 - p.life / p.max;
      sx.globalAlpha = k;
      const size = p.size * (0.6 + 0.4 * k);
      sx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
    }
    sx.globalAlpha = 1;
    lastSparkTime = now;
  };

  // ---------- running it ----------
  const coverCanvas = document.createElement('canvas');
  coverCanvas.className = 'burn-canvas';
  coverCanvas.setAttribute('aria-hidden', 'true');
  coverCanvas.width = w;
  coverCanvas.height = h;
  const cx = coverCanvas.getContext('2d');

  let rushed = false;
  let phase = 'draw';
  let drawStart = 0;
  let burnStart = 0;
  let burnDuration = BURN;

  const rush = () => {
    if (rushed) return;
    rushed = true;
    // the hero text was timed for the full reveal; let it come in now
    root.style.setProperty('--intro-delay', '0s');
    const now = performance.now();
    if (phase === 'draw') {
      phase = 'burn';
      startBurn(now, 420);
    } else if (phase === 'burn') {
      const p = clamp((now - burnStart) / burnDuration);
      burnStart = now - p * 420;
      burnDuration = 420;
    }
  };

  const finish = () => {
    phase = 'done';
    glCanvas.remove();
    sparkCanvas.remove();
    coverCanvas.remove();
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  };

  function startBurn(now, duration) {
    paintCover(cx, 1);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, coverCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.viewport(0, 0, w, h);
    gl.uniform1f(uT, T_FROM);
    gl.uniform1f(uTime, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // the burn canvas replaces the drawn cover in the same frame
    document.body.appendChild(glCanvas);
    document.body.appendChild(sparkCanvas);
    coverCanvas.remove();
    burnStart = now;
    burnDuration = duration;
    lastSparkTime = now;
  }

  const frame = (now) => {
    if (phase === 'draw') {
      const p = clamp((now - drawStart) / DRAW);
      paintCover(cx, p);
      if (now - drawStart >= DRAW + HOLD) {
        phase = 'burn';
        startBurn(now, BURN);
      }
    }
    if (phase === 'burn') {
      const p = clamp((now - burnStart) / burnDuration);
      if (p < 1) {
        const t = T_FROM + (T_TO - T_FROM) * easeBurn(p);
        gl.uniform1f(uT, t);
        gl.uniform1f(uTime, (now - burnStart) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (p < 0.92 && !rushed) spawn(t, 4);
      } else if (glCanvas.isConnected) {
        // the cover is gone; let the last sparks drift off on their own
        glCanvas.remove();
      }
      drawSparks(now, Math.min(50, now - lastSparkTime));
      if (p >= 1 && !sparks.length) {
        finish();
        return;
      }
    }
    if (phase !== 'done') requestAnimationFrame(frame);
  };

  const begin = () => {
    sizeText();
    paintCover(cx, 0);
    // drawn cover in, CSS cover off, in the same frame: no flicker
    document.body.appendChild(coverCanvas);
    root.classList.remove('burn-pending');
    ['pointerdown', 'wheel', 'touchmove', 'keydown'].forEach((type) => {
      window.addEventListener(type, rush, { once: true, passive: true });
    });
    drawStart = performance.now();
    requestAnimationFrame(frame);
  };

  // give the display font a moment so the name is drawn in Bodoni,
  // but never hold the page for it
  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([
      document.fonts.load('italic 400 64px "Bodoni Moda"'),
      new Promise((resolve) => setTimeout(resolve, 350))
    ]).catch(() => {})
    : Promise.resolve();
  fontReady.then(begin);
})();
