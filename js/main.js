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

window.NGM = { waUrl, openWhatsApp, toast, prettyDate };

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
