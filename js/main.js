// Namita Garg Makeover, site interactions (shared across all pages)

document.documentElement.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Intro veil: letter-by-letter name, then curtain lift ----------
if (!reducedMotion && !sessionStorage.getItem('ngm-intro-done')) {
  document.documentElement.classList.add('with-intro');

  const veil = document.createElement('div');
  veil.className = 'intro-veil';
  veil.setAttribute('aria-hidden', 'true');
  const name = document.createElement('div');
  name.className = 'intro-name';
  'Namita Garg'.split('').forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch === ' ' ? String.fromCharCode(160) : ch;
    s.style.animationDelay = `${0.15 + i * 0.055}s`;
    name.appendChild(s);
  });
  veil.appendChild(name);
  document.body.appendChild(veil);

  const finishIntro = () => {
    if (!veil.parentNode) return;
    veil.classList.add('lift');
    sessionStorage.setItem('ngm-intro-done', '1');
    setTimeout(() => veil.remove(), 1000);
  };

  setTimeout(finishIntro, 1400);
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

navToggle.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  header.classList.toggle('menu-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
});

mainNav.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    mainNav.classList.remove('open');
    header.classList.remove('menu-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }
});

// ---------- Scroll reveals ----------
const reveals = document.querySelectorAll('.reveal');

if (reducedMotion || !('IntersectionObserver' in window)) {
  reveals.forEach((el) => el.classList.add('in'));
} else {
  // Stagger siblings inside a .reveal-group
  document.querySelectorAll('.reveal-group').forEach((group) => {
    group.querySelectorAll('.reveal').forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${i * 0.09}s`);
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
      const shift = -progress * speed * 100;
      // scale slightly so edges never show while translating
      el.style.transform = `scale(1.06) translateY(${shift.toFixed(2)}px)`;
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

  window.addEventListener('scroll', () => {
    const a = getAnim();
    if (!a) return;
    const dy = Math.abs(window.scrollY - lastMarqueeY);
    lastMarqueeY = window.scrollY;
    a.playbackRate = Math.min(1 + dy / 40, 4);
  }, { passive: true });

  // ease back to normal speed
  setInterval(() => {
    const a = getAnim();
    if (a && a.playbackRate > 1) {
      a.playbackRate = Math.max(1, a.playbackRate * 0.92);
    }
  }, 120);
}

// ---------- Pointer tilt on service images ----------
if (window.matchMedia('(pointer: fine)').matches && !reducedMotion) {
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

// ---------- Testimonial pager (index only) ----------
const tSection = document.getElementById('testimonials');

if (tSection) {
  const slides = [...tSection.querySelectorAll('.t-slide')];
  const pagerBtns = [...tSection.querySelectorAll('.t-num')];
  let tIndex = 0;
  let tTimer = null;

  const showSlide = (i) => {
    tIndex = i;
    slides.forEach((s, n) => s.classList.toggle('is-active', n === i));
    pagerBtns.forEach((b, n) => {
      b.classList.toggle('is-active', n === i);
      b.setAttribute('aria-selected', String(n === i));
    });
  };

  const startAuto = () => {
    if (reducedMotion) return;
    clearInterval(tTimer);
    tTimer = setInterval(() => showSlide((tIndex + 1) % slides.length), 6500);
  };

  pagerBtns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      showSlide(i);
      startAuto(); // reset the clock after a manual choice
    });
  });

  tSection.addEventListener('mouseenter', () => clearInterval(tTimer));
  tSection.addEventListener('mouseleave', startAuto);
  startAuto();
}

// ---------- Enquiry form → WhatsApp handoff (contact only) ----------
const form = document.getElementById('enquiryForm');

if (form) {
  const confirmation = document.getElementById('formConfirmation');

  // wedding dates are in the future (local date, not UTC)
  const dateInput = document.getElementById('weddingDate');
  if (dateInput) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    dateInput.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const lines = [
      'Hi Namita, I\'d like to enquire about makeup.',
      `Name: ${data.get('name')}`,
      `Phone: ${data.get('phone')}`
    ];
    const date = data.get('weddingDate');
    if (date) lines.push(`Wedding date: ${date}`);
    const message = data.get('message');
    if (message) lines.push(`Message: ${message}`);

    const url = `https://wa.me/919235112453?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener');

    confirmation.hidden = false;
    form.reset();
  });
}

// ---------- Magnetic buttons (fine pointers only) ----------
const finePointer = window.matchMedia('(pointer: fine)').matches;

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
const heroImg = document.querySelector('.ph-hero');
const heroSection = document.querySelector('.hero');

if (heroImg && heroSection && finePointer && !reducedMotion) {
  heroSection.addEventListener('mousemove', (e) => {
    const mx = (e.clientX / window.innerWidth - 0.5) * 10;
    const my = (e.clientY / window.innerHeight - 0.5) * 8;
    heroImg.style.transform = `scale(1.08) translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px)`;
  });
  heroSection.addEventListener('mouseleave', () => {
    heroImg.style.transform = '';
  });
}

// ---------- WhatsApp nudge bubble (once per session) ----------
const waHref = 'https://wa.me/919235112453?text=' + encodeURIComponent('Hi Namita, I\'d like to ask about bridal makeup.');

if (!sessionStorage.getItem('ngm-bubble-seen')) {
  const bubble = document.createElement('div');
  bubble.className = 'wa-bubble';
  bubble.setAttribute('role', 'status');
  bubble.innerHTML =
    '<button class="wa-bubble-close" aria-label="Dismiss">&times;</button>' +
    '<p>Hi! I\'m Namita. Wondering if your date is free? Just ask.</p>' +
    `<a href="${waHref}" target="_blank" rel="noopener">Say Hi On WhatsApp</a>`;
  document.body.appendChild(bubble);

  const hideBubble = () => {
    bubble.classList.remove('show');
    sessionStorage.setItem('ngm-bubble-seen', '1');
  };

  setTimeout(() => bubble.classList.add('show'), 6000);
  setTimeout(hideBubble, 26000);
  bubble.querySelector('.wa-bubble-close').addEventListener('click', hideBubble);
  bubble.querySelector('a').addEventListener('click', hideBubble);
}

// ---------- Booking bar (all pages except the enquiry page) ----------
if (!form && !sessionStorage.getItem('ngm-bar-dismissed')) {
  const onAcademy = /academy/i.test(location.pathname);
  const bar = document.createElement('div');
  bar.className = 'booking-bar';
  bar.setAttribute('role', 'complementary');
  bar.innerHTML = onAcademy
    ? '<p><strong>Small Batches, Limited Seats.</strong><span> The next batch fills quickly.</span></p>' +
      '<a href="contact.html" class="bar-cta">Ask About Admissions</a>' +
      '<button class="bar-close" aria-label="Dismiss">&times;</button>'
    : '<p><strong>Wedding Season Fills Fast.</strong><span> Dates are first come, first served.</span></p>' +
      '<a href="contact.html" class="bar-cta">Check Your Date</a>' +
      '<button class="bar-close" aria-label="Dismiss">&times;</button>';
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
    sessionStorage.setItem('ngm-bar-dismissed', '1');
  });
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
