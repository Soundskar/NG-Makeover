// Namita Garg Makeover, "Five functions. Five looks." (home page).
// A walk through the wedding: each function changes the section's palette
// and its background (morning light, henna, fairy lights, the sacred fire,
// chikankari), and shows the look and approach for that function.
// Tabs follow the ARIA tabs pattern: arrow keys, Home and End work.

(() => {
  const section = document.getElementById('celebrations');
  if (!section) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = section.querySelector('.cel-nav');
  const tabs = [...section.querySelectorAll('.cel-tab')];
  const scenes = [...section.querySelectorAll('.scene')];
  const stage = section.querySelector('.cel-stage');
  let current = 0;

  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- decoration for each scene ----------
  // Sangeet: strings of fairy lights swagged across the night
  const sangeet = section.querySelector('.decor-sangeet');
  if (sangeet) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 600');
    svg.setAttribute('preserveAspectRatio', 'xMidYMin slice');
    svg.setAttribute('class', 'fairy');
    [[-40, 30, 1040, 70, 110], [-40, 120, 1040, 90, 80], [-40, 210, 1040, 250, 120]].forEach(([x1, y1, x2, y2, sag]) => {
      // a quadratic curve through the sag point: control = 2 * mid - (ends) / 2
      const midX = (x1 + x2) / 2;
      const ctrlY = (Math.max(y1, y2) + sag) * 2 - (y1 + y2) / 2;
      const wire = document.createElementNS(NS, 'path');
      wire.setAttribute('d', `M${x1} ${y1}Q${midX} ${ctrlY} ${x2} ${y2}`);
      wire.setAttribute('class', 'fairy-wire');
      svg.appendChild(wire);
      for (let i = 1; i < 26; i++) {
        const t = i / 26;
        const cx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
        const cy = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * ctrlY + t * t * y2;
        const bulb = document.createElementNS(NS, 'circle');
        bulb.setAttribute('cx', cx.toFixed(1));
        bulb.setAttribute('cy', (cy + 4).toFixed(1));
        bulb.setAttribute('r', '3.6');
        bulb.setAttribute('class', 'fairy-bulb');
        bulb.style.animationDelay = `${rand(-3, 0).toFixed(2)}s`;
        bulb.style.animationDuration = `${rand(1.6, 3.2).toFixed(2)}s`;
        svg.appendChild(bulb);
      }
    });
    sangeet.appendChild(svg);
  }

  // Reception: a few sparkles, like light off the chandeliers
  const reception = section.querySelector('.decor-reception');
  if (reception) {
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      s.textContent = '✦';
      s.style.left = `${rand(3, 97).toFixed(1)}%`;
      s.style.top = `${rand(4, 90).toFixed(1)}%`;
      s.style.fontSize = `${rand(8, 16).toFixed(0)}px`;
      s.style.animationDelay = `${rand(-4, 0).toFixed(2)}s`;
      reception.appendChild(s);
    }
  }

  // ---------- switching functions ----------
  const keepTabInView = (tab) => {
    const left = tab.offsetLeft - (nav.clientWidth - tab.offsetWidth) / 2;
    nav.scrollTo({ left, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const show = (i, { focus = false } = {}) => {
    current = (i + tabs.length) % tabs.length;
    const key = tabs[current].dataset.scene;
    section.dataset.scene = key;
    tabs.forEach((tab, n) => {
      const on = n === current;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    scenes.forEach((scene, n) => {
      scene.classList.toggle('is-active', n === current);
      scene.hidden = false;
      scene.setAttribute('aria-hidden', String(n !== current));
    });
    if (focus) tabs[current].focus({ preventScroll: true });
    if (nav.scrollWidth > nav.clientWidth) keepTabInView(tabs[current]);
  };

  tabs.forEach((tab, n) => tab.addEventListener('click', () => show(n)));

  nav.addEventListener('keydown', (e) => {
    const moves = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    show(moves[e.key], { focus: true });
  });

  section.querySelectorAll('[data-cel-dir]').forEach((btn) => {
    btn.addEventListener('click', () => show(current + Number(btn.dataset.celDir)));
  });

  // swipe between functions on touch screens
  let startX = null;
  let startY = 0;
  stage.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    startX = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) show(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  section.classList.add('is-ready');
  show(0);
})();
