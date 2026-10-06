// Namita Garg Makeover, burn-away reveal (home page, once per visit).
// A velvet cover with the name burns through from the bride outwards, with
// a glowing gold-and-sindoor edge, uncovering the page underneath.
//
// The inline script in index.html's <head> adds html.burn-pending before
// the first paint, so a plain velvet cover (CSS) is up from frame one. This
// file swaps that cover for a WebGL canvas showing the same thing and burns
// it away. No WebGL: a short fade. Any tap, scroll or key finishes it fast.

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

  // ---------- the cover, drawn in 2D and handed to WebGL as a texture ----------
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const w = Math.round(window.innerWidth * dpr);
  const h = Math.round(window.innerHeight * dpr);

  const drawCover = () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#3D0E18';
    x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, 0, 0, w / 2, 0, Math.max(w, h) * 0.85);
    g.addColorStop(0, '#551A28');
    g.addColorStop(1, 'rgba(61, 14, 24, 0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);

    const size = Math.max(36, Math.min(76, window.innerWidth * 0.075)) * dpr;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#E3CB98';
    x.font = `italic 400 ${size}px "Bodoni Moda", Didot, Georgia, serif`;
    x.fillText('Namita Garg', w / 2, h / 2 - size * 0.2);
    x.fillStyle = '#CDB4AE';
    x.font = `500 ${11 * dpr}px Jost, Futura, sans-serif`;
    if ('letterSpacing' in x) x.letterSpacing = `${3.5 * dpr}px`;
    x.fillText('BRIDAL MAKEUP STUDIO  ·  LUCKNOW', w / 2, h / 2 + size * 0.75);
    return c;
  };

  // ---------- shader ----------
  const VERT = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

  // The burn front is a threshold over (distance from the origin + fbm
  // noise), so it spreads outwards with a ragged, organic edge. Just ahead
  // of the front the cover chars and ripples like it is melting; at the
  // front itself it glows from sindoor to hot gold.
  const FRAG = `
    precision mediump float;
    uniform sampler2D u_tex;
    uniform float u_t;
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
      float field = distance(q, o) / u_maxd * 0.8 + fbm(q * 3.2) * 0.45;

      float edge = 0.075;
      float intact = smoothstep(u_t - 0.004, u_t + 0.004, field);
      float near = 1.0 - smoothstep(u_t, u_t + edge, field);
      float front = 1.0 - smoothstep(u_t, u_t + edge * 0.35, field);

      vec2 wobble = vec2(fbm3(q * 7.0 + u_t * 3.0), fbm3(q * 7.0 - u_t * 3.0)) - 0.5;
      vec3 col = texture2D(u_tex, v_uv + wobble * 0.035 * near).rgb;

      col = mix(col, vec3(0.07, 0.01, 0.025), near * 0.85);
      vec3 ember = mix(vec3(0.64, 0.14, 0.23), vec3(1.0, 0.86, 0.55), front * front);
      col = mix(col, ember, front);

      gl_FragColor = vec4(col * intact, intact);
    }`;

  const canvas = document.createElement('canvas');
  canvas.className = 'burn-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = w;
  canvas.height = h;
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) {
    fade();
    return;
  }

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
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
  const aspect = w / h;
  gl.uniform1f(gl.getUniformLocation(prog, 'u_aspect'), aspect);

  // start the burn at the bride (the hero arch) where she is on screen
  const arch = document.querySelector('.hero-arch .arch-frame');
  let ox = 0.5;
  let oy = 0.5;
  if (arch) {
    const r = arch.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.8 && r.bottom > 0) {
      ox = (r.left + r.width / 2) / window.innerWidth;
      oy = 1 - Math.min(0.8, Math.max(0.25, (r.top + r.height * 0.3) / window.innerHeight));
    }
  }
  gl.uniform2f(gl.getUniformLocation(prog, 'u_origin'), ox, oy);
  // farthest corner from the origin, so the burn always clears the screen
  const corners = [[0, 0], [aspect, 0], [0, 1], [aspect, 1]];
  const maxd = Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - ox * aspect, cy - oy)));
  gl.uniform1f(gl.getUniformLocation(prog, 'u_maxd'), maxd);

  const start = (coverCanvas) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, coverCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.viewport(0, 0, w, h);

    const T_FROM = -0.06;
    const T_TO = 1.32;
    const render = (t) => {
      gl.uniform1f(uT, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    render(T_FROM);

    // canvas goes in, CSS cover comes off in the same frame: no flicker
    document.body.appendChild(canvas);
    root.classList.remove('burn-pending');

    const HOLD = 220;
    let duration = 1500;
    let t0 = performance.now() + HOLD;
    let rushed = false;

    // a tap, scroll or key means "let me in": finish in a blink
    const rush = () => {
      if (rushed) return;
      rushed = true;
      const now = performance.now();
      const p = Math.max(0, Math.min(1, (now - t0) / duration));
      t0 = now - p * 380;
      duration = 380;
    };
    ['pointerdown', 'wheel', 'touchmove', 'keydown'].forEach((type) => {
      window.addEventListener(type, rush, { once: true, passive: true });
    });

    const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    const frame = (now) => {
      const p = Math.max(0, Math.min(1, (now - t0) / duration));
      render(T_FROM + (T_TO - T_FROM) * ease(p));
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    };
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
  fontReady.then(() => start(drawCover()));
})();
