// Namita Garg Makeover, site interactions (shared across all pages)

document.documentElement.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

// sessionStorage throws when the browser blocks site storage; without this
// guard one throw stops the script and every .reveal section stays hidden
const store = {
  get(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  },
  set(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
  }
};

// ---------- Intro veil: velvet curtain with the name, then lift ----------
if (!reducedMotion && !store.get('ngm-intro-done')) {
  document.documentElement.classList.add('with-intro');

  const veil = document.createElement('div');
  veil.className = 'intro-veil';
  veil.setAttribute('aria-hidden', 'true');
  const name = document.createElement('div');
  name.className = 'intro-name';
  'Namita Garg'.split('').forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch === ' ' ? String.fromCharCode(160) : ch;
    s.style.animationDelay = `${0.1 + i * 0.04}s`;
    name.appendChild(s);
  });
  veil.appendChild(name);
  document.body.appendChild(veil);

  const finishIntro = () => {
    if (veil.classList.contains('lift')) return;
    veil.classList.add('lift');
    store.set('ngm-intro-done', '1');
    setTimeout(() => veil.remove(), 900);
  };

  setTimeout(finishIntro, 950);
  // a click skips straight to the page
  veil.addEventListener('click', () => {
    document.documentElement.style.setProperty('--intro-delay', '0s');
    finishIntro();
  });
}

// ---------- Sticky header + scroll progress ----------
const header = document.getElementById('siteHeader');

const progressBar = document.createElement('div');
progressBar.className = 'scroll-progress';
document.body.appendChild(progressBar);

const onScroll = () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Mobile nav ----------
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');

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

  // wedding dates are in the future (local date, not UTC)
  const dateInput = document.getElementById('weddingDate');
  if (dateInput) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    dateInput.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  const prettyDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const lines = [
      'Hi Namita, I\'d like to enquire about makeup.',
      `Name: ${data.get('name')}`,
      `Phone: ${data.get('phone')}`
    ];
    const date = data.get('weddingDate');
    if (date) lines.push(`Wedding date: ${prettyDate(date)}`);
    const functions = data.getAll('functions');
    if (functions.length) lines.push(`Functions: ${functions.join(', ')}`);
    const message = data.get('message');
    if (message) lines.push(`Message: ${message}`);

    const url = `https://wa.me/919235112453?text=${encodeURIComponent(lines.join('\n'))}`;

    // Some in-app browsers (Instagram, Facebook) block new windows; fall
    // back to opening WhatsApp in this tab so the enquiry is never lost.
    const win = window.open(url, '_blank');
    if (win) win.opener = null;
    else window.location.href = url;

    if (fallbackLink) fallbackLink.href = url;
    confirmation.hidden = false;
  });
}

// ---------- Magnetic buttons (fine pointers only) ----------
if (finePointer && !reducedMotion) {
  document.querySelectorAll('.btn-fill, .btn-outline, .header-cta').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.16;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
      btn.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
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

// ---------- WhatsApp nudge bubble (once per session) ----------
const waHref = 'https://wa.me/919235112453?text=' + encodeURIComponent('Hi Namita, I\'d like to ask about bridal makeup.');

if (!store.get('ngm-bubble-seen')) {
  const bubble = document.createElement('div');
  bubble.className = 'wa-bubble';
  bubble.setAttribute('role', 'status');
  bubble.innerHTML =
    '<button class="wa-bubble-close" type="button" aria-label="Dismiss">&times;</button>' +
    '<p>Hi! I\'m Namita. Wondering if your date is free? Just ask.</p>' +
    `<a href="${waHref}" target="_blank" rel="noopener">Say hi on WhatsApp</a>`;
  document.body.appendChild(bubble);

  const hideBubble = () => {
    bubble.classList.remove('show');
    store.set('ngm-bubble-seen', '1');
  };

  setTimeout(() => bubble.classList.add('show'), 6000);
  setTimeout(hideBubble, 26000);
  bubble.querySelector('.wa-bubble-close').addEventListener('click', hideBubble);
  bubble.querySelector('a').addEventListener('click', hideBubble);
}

// ---------- Booking bar (all pages except the enquiry page) ----------
if (!form && !store.get('ngm-bar-dismissed')) {
  const onAcademy = /academy/i.test(location.pathname);
  const bar = document.createElement('div');
  bar.className = 'booking-bar';
  bar.setAttribute('role', 'complementary');
  bar.setAttribute('aria-label', 'Booking reminder');
  bar.innerHTML = onAcademy
    ? '<p><strong>Small batches, limited seats.</strong><span> The next batch fills quickly.</span></p>' +
      '<a href="contact.html" class="bar-cta">Ask about admissions</a>' +
      '<button class="bar-close" type="button" aria-label="Dismiss">&times;</button>'
    : '<p><strong>Wedding season fills fast.</strong><span> Dates are first come, first served.</span></p>' +
      '<a href="contact.html" class="bar-cta">Check your date</a>' +
      '<button class="bar-close" type="button" aria-label="Dismiss">&times;</button>';
  document.body.appendChild(bar);

  let barShown = false;

  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (!barShown && max > 0 && window.scrollY / max > 0.5) {
      barShown = true;
      bar.classList.add('show');
      document.body.classList.add('bar-show');
    }
  }, { passive: true });

  bar.querySelector('.bar-close').addEventListener('click', () => {
    bar.classList.remove('show');
    document.body.classList.remove('bar-show');
    store.set('ngm-bar-dismissed', '1');
  });
}

// ---------- Hero cursor card: mini slideshow beside the pointer (index only) ----------
const cursorCard = document.getElementById('cursorCard');

if (cursorCard && heroSection && !reducedMotion) {
  const ccImgs = [...cursorCard.querySelectorAll('.cc-img')];

  let ccIndex = 0;
  let ccTargetX = 0, ccTargetY = 0;
  let ccX = 0, ccY = 0;
  let ccSwapX = 0, ccSwapY = 0;
  let ccActive = false;
  let ccRaf = null;
  let ccLoaded = false;

  // the card's photos load on first use, not with the page
  const ccLoad = () => {
    if (ccLoaded) return;
    ccLoaded = true;
    ccImgs.forEach((el) => {
      if (el.dataset.bg) el.style.backgroundImage = `url('${el.dataset.bg}')`;
    });
  };

  const ccTick = () => {
    ccX += (ccTargetX - ccX) * 0.12;
    ccY += (ccTargetY - ccY) * 0.12;
    cursorCard.style.transform = `translate3d(${ccX.toFixed(1)}px, ${ccY.toFixed(1)}px, 0) translate(-50%, -50%)`;
    if (ccActive || Math.abs(ccTargetX - ccX) + Math.abs(ccTargetY - ccY) > 0.5) {
      ccRaf = requestAnimationFrame(ccTick);
    } else {
      ccRaf = null;
    }
  };

  // position the target from a viewport point; hero rect is read live so
  // the card stays glued to the finger even while the page scrolls
  const ccAim = (clientX, clientY, offsetX, offsetY) => {
    const r = heroSection.getBoundingClientRect();
    ccTargetX = clientX - r.left + offsetX;
    ccTargetY = clientY - r.top + offsetY;
  };

  const ccShow = (swapDist) => {
    ccLoad();
    if (!ccActive) {
      ccActive = true;
      ccX = ccTargetX;
      ccY = ccTargetY;
      ccSwapX = ccTargetX;
      ccSwapY = ccTargetY;
      cursorCard.classList.add('show');
    }
    if (Math.hypot(ccTargetX - ccSwapX, ccTargetY - ccSwapY) > swapDist) {
      ccSwapX = ccTargetX;
      ccSwapY = ccTargetY;
      ccImgs[ccIndex].classList.remove('is-active');
      ccIndex = (ccIndex + 1) % ccImgs.length;
      ccImgs[ccIndex].classList.add('is-active');
    }
    if (!ccRaf) ccRaf = requestAnimationFrame(ccTick);
  };

  const ccHide = () => {
    ccActive = false;
    cursorCard.classList.remove('show');
  };

  // the card never appears over the arch photo, where it would only
  // cover the bride
  const arch = heroSection.querySelector('.hero-arch');

  // desktop: card floats to the right of the mouse cursor
  if (finePointer) {
    heroSection.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (arch && arch.contains(e.target)) {
        ccHide();
        return;
      }
      ccAim(e.clientX, e.clientY, 90, 12);
      ccShow(150);
    });
    heroSection.addEventListener('pointerleave', ccHide);
  }

  // touch: card rides above the finger during drags over the hero.
  // Listeners are passive so scrolling is never blocked; a plain tap
  // (touchstart with no movement) primes the position but shows nothing.
  heroSection.addEventListener('touchstart', (e) => {
    ccAim(e.touches[0].clientX, e.touches[0].clientY, 0, -100);
    ccX = ccTargetX;
    ccY = ccTargetY;
  }, { passive: true });
  heroSection.addEventListener('touchmove', (e) => {
    if (arch && arch.contains(e.target)) return;
    ccAim(e.touches[0].clientX, e.touches[0].clientY, 0, -100);
    ccShow(110);
  }, { passive: true });
  heroSection.addEventListener('touchend', ccHide);
  heroSection.addEventListener('touchcancel', ccHide);
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
