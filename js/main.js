// Namita Garg Makeover, site interactions (shared across all pages)

document.documentElement.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;
const phoneLayout = window.matchMedia('(max-width: 900px)');

// ---------- Shared helpers (also used by gallery.js via window.NGM) ----------
const WA_NUMBER = '919235112453';

const waUrl = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

// Some in-app browsers (Instagram, Facebook) block new windows; fall back
// to opening WhatsApp in this tab so the enquiry is never lost.
const openWhatsApp = (url) => {
  const win = window.open(url, '_blank');
  if (win) win.opener = null;
  else window.location.href = url;
};

const prettyDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const todayIso = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// A short confirmation at the bottom of the screen. Inside the look viewer
// it has to live in the open dialog, which sits above everything else.
let toastTimer = null;
const toast = (message) => {
  const host = document.querySelector('dialog[open]') || document.body;
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
  }
  if (el.parentNode !== host) host.appendChild(el);
  el.textContent = message;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
};

// Brief "done" state on a button after it hands off to WhatsApp
const flashButton = (btn, label) => {
  if (!btn || btn.dataset.busy) return;
  btn.dataset.busy = '1';
  const original = btn.innerHTML;
  btn.textContent = label;
  btn.classList.add('is-done');
  setTimeout(() => {
    btn.innerHTML = original;
    btn.classList.remove('is-done');
    delete btn.dataset.busy;
  }, 2200);
};

// ---------- Phool barsana: a shower of rose and marigold petals ----------
// For the moments that deserve it: reaching the pheras, sending a booking.
const celebrate = () => {
  if (reducedMotion || document.querySelector('.petal-canvas')) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const d = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.className = 'petal-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = vw * d;
  canvas.height = vh * d;
  (document.querySelector('dialog[open]') || document.body).appendChild(canvas);
  const x = canvas.getContext('2d');
  x.scale(d, d);

  // rose reds and pinks, marigold orange and yellow: [light edge, dark edge]
  const colours = [['#C8324B', '#7E1426'], ['#E0587A', '#A3243A'], ['#F5A623', '#C76A06'], ['#F8CB4A', '#D9921A']];
  const petals = Array.from({ length: vw < 600 ? 42 : 72 }, () => ({
    x: Math.random() * vw,
    y: -20 - Math.random() * vh * 0.7,
    vy: 70 + Math.random() * 90,
    sway: 18 + Math.random() * 42,
    phase: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 4,
    flip: Math.random() * Math.PI * 2,
    size: 6 + Math.random() * 7,
    c: colours[Math.floor(Math.random() * colours.length)]
  }));

  const start = performance.now();
  let last = start;
  const tick = (now) => {
    const dt = Math.min(50, now - last) / 1000;
    last = now;
    x.clearRect(0, 0, vw, vh);
    let falling = 0;
    petals.forEach((p) => {
      p.y += p.vy * dt;
      p.phase += dt * 1.6;
      p.rot += p.vr * dt;
      p.flip += dt * 3;
      if (p.y > vh + 30) return;
      falling += 1;
      x.save();
      x.translate(p.x + Math.sin(p.phase) * p.sway, p.y);
      x.rotate(p.rot);
      x.scale(1, Math.abs(Math.cos(p.flip)) * 0.8 + 0.2); // tumbling
      const g = x.createLinearGradient(-p.size, 0, p.size, 0);
      g.addColorStop(0, p.c[0]);
      g.addColorStop(1, p.c[1]);
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(0, 0, p.size, p.size * 0.62, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    });
    if (falling && now - start < 8000) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
};

window.NGM = { waUrl, openWhatsApp, toast, prettyDate, celebrate };

// ---------- Toran: a marigold garland over the doorway of each page ----------
// Swags of marigolds in orange and yellow blocks, mango leaves and short
// swaying strings with a gold bell at every hanging point. Drawn as SVG to
// fit the width, and redrawn if the width changes.
const buildToran = (host) => {
  const W = Math.round(host.clientWidth);
  if (!W || host.dataset.drawnFor === String(W)) return;
  host.dataset.drawnFor = String(W);
  const small = W < 700;
  const r = small ? 5.5 : 7.5;
  const height = small ? 72 : 108;
  const y0 = r + 2;
  const sag = small ? 20 : 30;
  const swags = Math.max(2, Math.round(W / (small ? 170 : 280)));
  const step = W / swags;
  const f = (n) => n.toFixed(1);

  const flower = (fx, fy, rr, yellow) =>
    `<g transform="translate(${f(fx)} ${f(fy)})">` +
    `<circle r="${f(rr)}" fill="url(#mg${yellow ? 'Y' : 'O'})"/>` +
    `<circle r="${f(rr * 0.68)}" fill="none" stroke="${yellow ? '#B8770C' : '#A9470A'}" stroke-opacity=".55" stroke-width="${f(rr * 0.3)}" stroke-dasharray="1.1 1.5"/>` +
    `<circle r="${f(rr * 0.26)}" fill="#8A3A05" fill-opacity=".45"/></g>`;
  const leaf = (lx, ly, rot, sc) =>
    `<g transform="translate(${f(lx)} ${f(ly)}) rotate(${rot}) scale(${sc})">` +
    '<path d="M0 0C4.6 6 4.6 19 0 27C-4.6 19-4.6 6 0 0Z" fill="#3F7A33"/>' +
    '<path d="M0 2V25" stroke="#2A5522" stroke-width=".8"/></g>';

  let leaves = '';
  let swagFlowers = '';
  let drops = '';
  let crowns = '';
  let count = 0;
  for (let s = 0; s < swags; s++) {
    const x0 = s * step;
    const n = Math.max(6, Math.round(step / (r * 1.5)));
    for (let k = s === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      swagFlowers += flower(x0 + t * step, y0 + sag * Math.sin(Math.PI * t), r, Math.floor(count / 5) % 2 === 1);
      count += 1;
    }
  }
  for (let s = 0; s <= swags; s++) {
    const hx = Math.min(W - r * 2, Math.max(r * 2, s * step));
    const sc = small ? 0.8 : 1.05;
    leaves += leaf(hx, y0, -34, sc) + leaf(hx, y0, 0, sc) + leaf(hx, y0, 34, sc);
    let drop = '';
    const beads = small ? 3 : 4;
    let dy = y0 + r * 1.9;
    for (let j = 0; j < beads; j++) {
      drop += flower(hx, dy, r * 0.9, j % 2 === 0);
      dy += r * 1.65;
    }
    drop += `<path d="M${f(hx)} ${f(dy - r * 0.6)}l${f(-r * 0.75)} ${f(r * 1.4)}h${f(r * 1.5)}z" fill="#C9A35E"/>` +
      `<circle cx="${f(hx)}" cy="${f(dy + r * 1)}" r="${f(r * 0.32)}" fill="#E3CB98"/>`;
    drops += `<g class="toran-drop" style="animation-delay:${(-Math.random() * 5).toFixed(2)}s">${drop}</g>`;
    crowns += flower(hx, y0, r * 1.35, s % 2 === 1);
  }

  host.innerHTML =
    `<svg viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" aria-hidden="true" focusable="false">` +
    '<defs>' +
    '<radialGradient id="mgO" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFC34D"/><stop offset=".55" stop-color="#F08A1C"/><stop offset="1" stop-color="#C45A0C"/></radialGradient>' +
    '<radialGradient id="mgY" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFE58A"/><stop offset=".55" stop-color="#F6B92B"/><stop offset="1" stop-color="#D98E12"/></radialGradient>' +
    '</defs>' +
    leaves + swagFlowers + drops + crowns + '</svg>';
};

// page headers get their toran here; the home hero has its own in the HTML
document.querySelectorAll('.page-header').forEach((ph) => {
  const t = document.createElement('div');
  t.className = 'toran';
  t.setAttribute('data-toran', '');
  t.setAttribute('aria-hidden', 'true');
  ph.prepend(t);
});
const torans = [...document.querySelectorAll('[data-toran]')];
torans.forEach(buildToran);
let toranTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(toranTimer);
  toranTimer = setTimeout(() => torans.forEach(buildToran), 200);
});

// Page cross-fades (CSS @view-transition) are skipped when a tab is hidden
// or a navigation is interrupted; that rejection is expected, not an error.
['pageswap', 'pagereveal'].forEach((type) => {
  window.addEventListener(type, (e) => {
    const vt = e.viewTransition;
    if (!vt) return;
    [vt.ready, vt.finished, vt.updateCallbackDone].forEach((p) => p && p.catch(() => {}));
  });
});

// ---------- Sticky header + scroll progress ----------
const header = document.getElementById('siteHeader');
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');

const progressBar = document.createElement('div');
progressBar.className = 'scroll-progress';
document.body.appendChild(progressBar);

// On phones the header tucks away while reading down the page and comes
// back on the way up (the action bar keeps "Check your date" in reach).
// On desktop it stays put: there is room, and it carries the main button.
let lastScrollY = window.scrollY;

const onScroll = () => {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 40);
  if (!phoneLayout.matches || mainNav.classList.contains('open') || y < 480) {
    header.classList.remove('tucked');
  } else if (y > lastScrollY + 6) {
    header.classList.add('tucked');
  } else if (y < lastScrollY - 6) {
    header.classList.remove('tucked');
  }
  lastScrollY = y;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Mobile nav ----------

const setMenu = (open) => {
  mainNav.classList.toggle('open', open);
  header.classList.toggle('menu-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};

navToggle.addEventListener('click', () => setMenu(!mainNav.classList.contains('open')));

mainNav.addEventListener('click', (e) => {
  if (e.target.closest('a')) setMenu(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mainNav.classList.contains('open')) {
    setMenu(false);
    navToggle.focus();
  }
});

// ---------- Scroll reveals ----------
const reveals = document.querySelectorAll('.reveal');

if (reducedMotion || !('IntersectionObserver' in window)) {
  reveals.forEach((el) => el.classList.add('in'));
} else {
  // Stagger siblings inside a .reveal-group, a row at a time
  document.querySelectorAll('.reveal-group').forEach((group) => {
    group.querySelectorAll('.reveal').forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${(i % 4) * 0.09}s`);
    });
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

  reveals.forEach((el) => io.observe(el));
}

// ---------- Soft parallax ----------
// Writes --py only; the element's CSS transform combines it with the
// hero mouse drift (--mx/--my) so the two effects never overwrite each other
const parallaxEls = [...document.querySelectorAll('[data-parallax]')];

if (!reducedMotion && parallaxEls.length) {
  let ticking = false;

  const applyParallax = () => {
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.1;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      el.style.setProperty('--py', `${(-progress * speed * 100).toFixed(2)}px`);
    });
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(applyParallax);
    }
  }, { passive: true });
  applyParallax();
}

// ---------- Marquee reacts to scroll speed ----------
const marqueeTrack = document.querySelector('.marquee-track');

if (marqueeTrack && !reducedMotion && 'getAnimations' in marqueeTrack) {
  let marqueeAnim = null;
  const getAnim = () => marqueeAnim || (marqueeAnim = marqueeTrack.getAnimations()[0] || null);
  let lastMarqueeY = window.scrollY;
  let easing = null;

  // ease back to normal speed, and stop ticking once it is there
  const easeBack = () => {
    const a = getAnim();
    if (a && a.playbackRate > 1.01) {
      a.playbackRate = Math.max(1, a.playbackRate * 0.92);
      easing = setTimeout(easeBack, 120);
    } else {
      if (a) a.playbackRate = 1;
      easing = null;
    }
  };

  window.addEventListener('scroll', () => {
    const a = getAnim();
    if (!a) return;
    const dy = Math.abs(window.scrollY - lastMarqueeY);
    lastMarqueeY = window.scrollY;
    a.playbackRate = Math.min(1 + dy / 40, 4);
    if (!easing) easing = setTimeout(easeBack, 120);
  }, { passive: true });
}

// ---------- Pointer tilt on service images ----------
if (finePointer && !reducedMotion) {
  document.querySelectorAll('.svc-media .ph').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -5;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 6;
      el.style.transform = `perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.015)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

// ---------- Testimonials (index only) ----------
const tSection = document.getElementById('testimonials');

if (tSection) {
  const slides = [...tSection.querySelectorAll('.t-slide')];
  const pagerBtns = [...tSection.querySelectorAll('.t-num')];
  let tIndex = 0;
  let tTimer = null;

  const showSlide = (i) => {
    tIndex = i;
    slides.forEach((s, n) => {
      s.classList.toggle('is-active', n === i);
      s.setAttribute('aria-hidden', String(n !== i));
    });
    pagerBtns.forEach((b, n) => {
      b.classList.toggle('is-active', n === i);
      b.setAttribute('aria-pressed', String(n === i));
    });
  };

  const stopAuto = () => clearInterval(tTimer);
  const startAuto = () => {
    if (reducedMotion) return;
    stopAuto();
    tTimer = setInterval(() => showSlide((tIndex + 1) % slides.length), 6500);
  };

  pagerBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      showSlide(i);
      startAuto(); // reset the clock after a manual choice
    });
  });

  // pause while someone is reading with the mouse or keyboard
  tSection.addEventListener('mouseenter', stopAuto);
  tSection.addEventListener('mouseleave', startAuto);
  tSection.addEventListener('focusin', stopAuto);
  tSection.addEventListener('focusout', (e) => {
    if (!tSection.contains(e.relatedTarget)) startAuto();
  });
  showSlide(0);
  startAuto();
}

// ---------- Enquiry form → WhatsApp handoff (contact only) ----------
const form = document.getElementById('enquiryForm');

if (form) {
  const confirmation = document.getElementById('formConfirmation');
  const fallbackLink = document.getElementById('formFallback');
  const submitBtn = form.querySelector('button[type="submit"]');

  // wedding dates are in the future (local date, not UTC)
  const dateInput = document.getElementById('weddingDate');
  if (dateInput) dateInput.min = todayIso();

  // arriving from a service ("contact.html?for=Bridal makeup") keeps that
  // context visible and adds it to the message
  const context = document.getElementById('formContext');
  let interest = (new URLSearchParams(location.search).get('for') || '').trim().slice(0, 60);
  if (context && interest) {
    context.querySelector('strong').textContent = interest;
    context.hidden = false;
    context.querySelector('button').addEventListener('click', () => {
      interest = '';
      context.hidden = true;
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const lines = [`Hi Namita, I'm ${data.get('name')}. I'd like to enquire about makeup.`];
    if (interest) lines.push(`Interested in: ${interest}`);
    const date = data.get('weddingDate');
    if (date) lines.push(`Wedding date: ${prettyDate(date)}`);
    const functions = data.getAll('functions');
    if (functions.length) lines.push(`Functions: ${functions.join(', ')}`);
    const message = data.get('message');
    if (message) lines.push(`Message: ${message}`);

    const url = waUrl(lines.join('\n'));
    openWhatsApp(url);

    flashButton(submitBtn, 'Opening WhatsApp…');
    celebrate();
    if (fallbackLink) fallbackLink.href = url;
    confirmation.hidden = false;
  });
}

// ---------- Date checker: pick a date, ask on WhatsApp (CTA bands) ----------
document.querySelectorAll('.date-check').forEach((dc) => {
  const input = dc.querySelector('input[type="date"]');
  const btn = dc.querySelector('button[type="submit"]');
  const what = dc.dataset.service || 'bridal makeup';
  input.min = todayIso();

  dc.addEventListener('submit', (e) => {
    e.preventDefault();
    openWhatsApp(waUrl(`Hi Namita, is ${prettyDate(input.value)} free for ${what}?`));
    flashButton(btn, 'Opening WhatsApp…');
    celebrate();
  });
});

// ---------- Phone numbers: copy on desktop, where tel: links rarely work ----------
if (finePointer && navigator.clipboard) {
  document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const number = link.textContent.trim();
      navigator.clipboard.writeText(number).then(
        () => toast(`Number copied: ${number}`),
        () => { window.location.href = link.href; }
      );
    });
  });
}

// ---------- WhatsApp button label (shown on hover on desktop) ----------
const waFloat = document.querySelector('.whatsapp-float');
if (waFloat) {
  const label = document.createElement('span');
  label.className = 'wa-label';
  label.setAttribute('aria-hidden', 'true');
  label.textContent = 'Chat on WhatsApp';
  waFloat.appendChild(label);
}

// ---------- Magnetic buttons (fine pointers only) ----------
// Writes --tx/--ty; the CSS transform also carries the :active press
if (finePointer && !reducedMotion) {
  document.querySelectorAll('.btn-fill, .btn-outline, .header-cta').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--tx', `${((e.clientX - (r.left + r.width / 2)) * 0.16).toFixed(1)}px`);
      btn.style.setProperty('--ty', `${((e.clientY - (r.top + r.height / 2)) * 0.3).toFixed(1)}px`);
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.removeProperty('--tx');
      btn.style.removeProperty('--ty');
    });
  });
}

// ---------- Hero mouse drift ----------
const heroMedia = document.querySelector('.hero .arch-media');
const heroSection = document.querySelector('.hero');

if (heroMedia && heroSection && finePointer && !reducedMotion) {
  heroSection.addEventListener('mousemove', (e) => {
    heroMedia.style.setProperty('--mx', `${((e.clientX / window.innerWidth - 0.5) * 10).toFixed(1)}px`);
    heroMedia.style.setProperty('--my', `${((e.clientY / window.innerHeight - 0.5) * 8).toFixed(1)}px`);
  });
  heroSection.addEventListener('mouseleave', () => {
    heroMedia.style.setProperty('--mx', '0px');
    heroMedia.style.setProperty('--my', '0px');
  });
}

// ---------- Action bar (phones; hidden on desktop by CSS) ----------
// One sticky bar in the thumb zone, instead of a chat bubble, a booking
// bar and a floating button competing for the same corner. It appears once
// the page's first call to action has scrolled away, and steps aside while
// the page's own booking form or call to action is on screen, so the same
// button never shows twice. Saved looks (gallery.js) show up in it too.
const HEART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';

if (!form) {
  const onAcademy = /academy/i.test(location.pathname);
  const waIcon = (document.querySelector('.whatsapp-float svg') || {}).outerHTML || '';
  const waText = onAcademy
    ? 'Hi Namita, I\'d like to ask about your academy courses.'
    : 'Hi Namita, I\'d like to ask about bridal makeup.';

  const bar = document.createElement('div');
  bar.className = 'action-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Quick contact');
  bar.innerHTML =
    `<a class="ab-wa" href="${waUrl(waText)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${waIcon}</a>` +
    '<a class="ab-saved" href="#" target="_blank" rel="noopener" hidden></a>' +
    (onAcademy
      ? '<a class="ab-main" href="contact.html?for=Academy%20admissions">Ask about admissions <span class="arrow" aria-hidden="true">&rarr;</span></a>'
      : '<a class="ab-main" href="contact.html">Check your date <span class="arrow" aria-hidden="true">&rarr;</span></a>');
  document.body.appendChild(bar);

  // WhatsApp links go through openWhatsApp so in-app browsers still get there
  bar.querySelectorAll('.ab-wa, .ab-saved').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openWhatsApp(link.href);
    });
  });

  const saved = bar.querySelector('.ab-saved');
  const syncSaved = (state, bump) => {
    const n = state ? state.count : 0;
    saved.hidden = n === 0;
    if (!n) return;
    saved.innerHTML = `${HEART_ICON}<span>${n}</span>`;
    saved.href = state.href;
    saved.setAttribute('aria-label', `Send my ${n} saved look${n === 1 ? '' : 's'} to Namita on WhatsApp`);
    if (bump) {
      saved.classList.remove('bump');
      void saved.offsetWidth;
      saved.classList.add('bump');
    }
  };
  syncSaved(window.NGM_SHORTLIST, false);
  document.addEventListener('ngm:shortlist', (e) => syncSaved(e.detail, true));

  const firstCta = document.querySelector('.hero-actions, .page-header');
  const pageCtas = [...document.querySelectorAll('.cta-band, .date-check, .site-footer')];
  let pastFirst = !firstCta;
  let ctaInView = false;

  const update = () => {
    const show = pastFirst && !ctaInView;
    bar.classList.toggle('show', show);
    document.body.classList.toggle('ab-on', show);
  };

  if ('IntersectionObserver' in window) {
    if (firstCta) {
      new IntersectionObserver(([entry]) => {
        pastFirst = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        update();
      }).observe(firstCta);
    }
    const inView = new Set();
    const ctaWatch = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) inView.add(entry.target);
        else inView.delete(entry.target);
      });
      ctaInView = inView.size > 0;
      update();
    }, { rootMargin: '0px 0px -12% 0px' });
    pageCtas.forEach((el) => ctaWatch.observe(el));
  } else {
    pastFirst = true;
    update();
  }
}

// ---------- Course module accordions, one open at a time (academy only) ----------
const courseDetails = [...document.querySelectorAll('.course-card .course-details')];

courseDetails.forEach((d) => {
  d.addEventListener('toggle', () => {
    if (d.open) {
      courseDetails.forEach((other) => {
        if (other !== d) other.open = false;
      });
    }
  });
});

// ---------- Footer year ----------
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
