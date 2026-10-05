// Namita Garg Makeover, portfolio rendering: hero slideshow, home strip,
// portfolio grid with filters, and the look viewer (lightbox).
// Content comes from js/portfolio-data.js. Load this before main.js so the
// cards it creates pick up the shared scroll reveals.

(() => {
  const items = window.NGM_PORTFOLIO || [];
  const WA_NUMBER = '919235112453';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);

  // helpers from main.js, which loads after this file; only used on clicks
  const ngm = () => window.NGM || {};
  const notify = (msg) => { if (ngm().toast) ngm().toast(msg); };

  // a link to one look that opens straight into the viewer
  const lookUrl = (item) => new URL(`portfolio.html#look-${item.id}`, location.href).href;

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const srcsetFor = (item) => (item.thumb && item.thumb !== item.src ? `${item.thumb} 640w, ${item.src} 1200w` : '');

  // ---------- muted previews play only while on screen ----------
  const autoplay = !reducedMotion && !saveData && 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach(({ target: video, isIntersecting }) => {
        if (isIntersecting) {
          if (!video.src) video.src = video.dataset.src;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.6 })
    : null;

  const cardMedia = (item, sizes) => {
    if (item.type === 'video') {
      const video = make('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      if (item.thumb) video.poster = item.thumb;
      video.dataset.src = item.src;
      if (item.focus) video.style.objectPosition = item.focus;
      if (autoplay) autoplay.observe(video);
      return video;
    }
    const img = make('img');
    img.src = item.thumb || item.src;
    const srcset = srcsetFor(item);
    if (srcset) {
      img.srcset = srcset;
      img.sizes = sizes;
    }
    img.alt = item.alt || item.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    if (item.focus) img.style.objectPosition = item.focus;
    return img;
  };

  // A look card: arch-framed media + style and title. `getList` returns the
  // looks the viewer should page through when this card is opened.
  const buildCard = (item, className, sizes, getList) => {
    const card = make('button', `look-card ${className}`);
    card.type = 'button';
    card.dataset.id = item.id;
    card.setAttribute('aria-label', `${item.title}${item.type === 'video' ? ', video' : ''}. Open larger view`);

    const frame = make('span', 'look-frame');
    const media = make('span', 'look-media arch');
    media.appendChild(cardMedia(item, sizes));
    if (item.type === 'video') media.appendChild(make('span', 'look-badge', 'Video'));
    else if (item.before) media.appendChild(make('span', 'look-badge', 'Before / after'));
    frame.appendChild(media);

    const meta = make('span', 'look-meta');
    meta.append(make('span', 'look-style', item.style), make('span', 'look-title', item.title));

    card.append(frame, meta);
    card.dataset.cursor = item.type === 'video' ? 'Play' : (item.before ? 'Compare' : 'View');
    card.addEventListener('click', () => {
      if (card.dataset.dragged) return;
      const list = getList();
      openViewer(list, Math.max(0, list.indexOf(item)));
    });
    return card;
  };

  // ============ SHORTLIST ============
  // Brides decide with family, so looks can be saved and sent to Namita
  // in one message. Saved ids live in this browser only.
  const SHORTLIST_KEY = 'ngm-shortlist';
  const shortlist = new Set((() => {
    try { return JSON.parse(window.localStorage.getItem(SHORTLIST_KEY)) || []; } catch (e) { return []; }
  })().filter((id) => items.some((it) => it.id === id)));

  const saveShortlist = () => {
    try { window.localStorage.setItem(SHORTLIST_KEY, JSON.stringify([...shortlist])); } catch (e) { /* storage blocked */ }
  };

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';

  let pill = null;
  const shortlistMessage = () => {
    const saved = items.filter((it) => shortlist.has(it.id));
    return [
      'Hi Namita, I shortlisted these looks on your website:',
      ...saved.map((it) => `• ${it.title}: ${lookUrl(it)}`),
      'Is my date free?'
    ].join('\n');
  };

  const renderPill = (bump) => {
    // only on pages that show looks
    if (!document.querySelector('#looksStrip, #portfolioGrid')) return;
    if (!pill) {
      pill = make('a', 'shortlist-pill');
      pill.target = '_blank';
      pill.rel = 'noopener';
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        if (ngm().openWhatsApp) ngm().openWhatsApp(pill.href);
        else window.open(pill.href, '_blank', 'noopener');
      });
      document.body.appendChild(pill);
    }
    const n = shortlist.size;
    pill.innerHTML = `${HEART}<span>${n} saved &middot; Send to Namita</span>`;
    pill.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(shortlistMessage())}`;
    pill.setAttribute('aria-label', `Send my ${n} saved look${n === 1 ? '' : 's'} to Namita on WhatsApp`);
    pill.classList.toggle('show', n > 0);
    pill.tabIndex = n > 0 ? 0 : -1;
    if (bump) {
      pill.classList.remove('bump');
      void pill.offsetWidth;
      pill.classList.add('bump');
    }
  };

  // ============ LOOK VIEWER ============
  let viewer = null;
  let viewList = [];
  let viewIndex = 0;
  const ui = {};

  const waLink = (item) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Hi Namita, I loved the "${item.title}" look on your website (${lookUrl(item)}). Is my date free?`
  )}`;

  // ============ BEFORE / AFTER SLIDER ============
  // One component for the home page section (variant 'inline', arch framed)
  // and the viewer ('viewer'). Mouse: the divider follows the pointer.
  // Touch: drag sideways; vertical swipes still scroll the page.
  // Keyboard: arrow keys on the visually hidden range input.
  const KNOB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg>';

  const buildCompare = (item, variant) => {
    const wrap = make('div', `compare compare--${variant}`);
    const stage = make('div', `cmp-stage${variant === 'inline' ? ' arch' : ''}`);

    const after = make('img', 'cmp-after');
    after.src = item.src;
    after.alt = item.alt || item.title;
    after.draggable = false;
    const before = make('img', 'cmp-before');
    before.src = item.before;
    before.alt = `${item.title}, before makeup`;
    before.draggable = false;
    if (variant === 'inline') {
      after.loading = 'lazy';
      before.loading = 'lazy';
      after.decoding = 'async';
      before.decoding = 'async';
      if (item.focus) {
        after.style.objectPosition = item.focus;
        before.style.objectPosition = item.focus;
      }
    }

    const handle = make('span', 'cmp-handle');
    handle.setAttribute('aria-hidden', 'true');
    const knob = make('span', 'cmp-knob');
    knob.innerHTML = KNOB;
    handle.appendChild(knob);

    stage.append(after, before, handle,
      make('span', 'cmp-label cmp-label-before', 'Before'),
      make('span', 'cmp-label cmp-label-after', 'After'));

    const range = make('input', 'cmp-range');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.value = '50';
    range.setAttribute('aria-label', `Compare before and after: ${item.title}`);

    wrap.append(stage, range);

    let touched = false; // once someone interacts, the hint sweep never runs
    const setPos = (pct) => {
      const p = Math.max(0, Math.min(100, pct));
      wrap.style.setProperty('--pos', `${p.toFixed(1)}%`);
      range.value = String(Math.round(p));
      range.setAttribute('aria-valuetext', `${Math.round(p)}% before, ${100 - Math.round(p)}% after`);
    };
    const fromEvent = (e) => {
      const r = stage.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * 100;
    };
    setPos(50);

    range.addEventListener('input', () => {
      touched = true;
      setPos(Number(range.value));
    });

    let dragging = false;
    stage.addEventListener('pointerdown', (e) => {
      touched = true;
      if (e.pointerType === 'mouse') return;
      dragging = true;
      wrap.classList.add('is-tracking', 'is-dragging');
      setPos(fromEvent(e));
    });
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        touched = true;
        wrap.classList.add('is-tracking');
        setPos(fromEvent(e));
      } else if (dragging) {
        setPos(fromEvent(e));
      }
    });
    const endDrag = () => {
      dragging = false;
      wrap.classList.remove('is-tracking', 'is-dragging');
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag); // the browser took over to scroll
    stage.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      wrap.classList.remove('is-tracking');
      if (variant === 'inline') setPos(50); // glide back to the middle
    });

    // a gentle back-and-forth that shows the photo can be dragged
    const hint = () => {
      if (touched || reducedMotion) return;
      [[0, 32], [750, 68], [1500, 50]].forEach(([delay, pct]) => {
        setTimeout(() => { if (!touched) setPos(pct); }, delay);
      });
    };

    return { el: wrap, hint };
  };

  const viewerMedia = (item) => {
    if (item.before) return buildCompare(item, 'viewer').el;
    if (item.type === 'video') {
      const video = make('video', 'lb-media');
      video.src = item.src;
      if (item.thumb) video.poster = item.thumb;
      video.controls = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      // opened by a tap, so sound is usually allowed; fall back to muted
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
      return video;
    }
    const img = make('img', 'lb-media');
    img.src = item.src;
    img.alt = item.alt || item.title;
    return img;
  };

  const updateSaveButton = (item) => {
    const saved = shortlist.has(item.id);
    ui.save.setAttribute('aria-pressed', String(saved));
    ui.saveLabel.textContent = saved ? 'Saved' : 'Save';
  };

  // dir: 'next' or 'prev' slides the new look in from that side
  const showLook = (i, dir) => {
    viewIndex = (i + viewList.length) % viewList.length;
    const item = viewList[viewIndex];
    if (dir) ui.stage.dataset.dir = dir;
    else delete ui.stage.dataset.dir;
    ui.stage.replaceChildren(viewerMedia(item));
    ui.count.textContent = `${viewIndex + 1} / ${viewList.length}`;
    ui.style.textContent = item.style;
    ui.title.textContent = item.title;
    ui.details.textContent = item.details || '';
    ui.details.hidden = !item.details;
    ui.book.href = waLink(item);
    updateSaveButton(item);
    const single = viewList.length < 2;
    ui.prev.hidden = single;
    ui.next.hidden = single;

    // re-run the caption entrance for the new look
    ui.info.classList.remove('swap');
    void ui.info.offsetWidth;
    ui.info.classList.add('swap');
    fitStage(); // a details line can change the panel's height

    // warm up the neighbours so paging feels instant
    [viewIndex - 1, viewIndex + 1].forEach((n) => {
      const near = viewList[(n + viewList.length) % viewList.length];
      if (near && near.type === 'photo') new Image().src = near.src;
    });
  };

  const ensureViewer = () => {
    if (viewer) return;
    viewer = make('dialog', 'lightbox');
    viewer.setAttribute('aria-label', 'Look viewer');
    viewer.innerHTML = `
      <div class="lb-stage"></div>
      <div class="lb-info">
        <p class="lb-count"></p>
        <p class="eyebrow lb-style"></p>
        <h2 class="lb-title"></h2>
        <p class="lb-details"></p>
        <a class="btn-fill lb-book" target="_blank" rel="noopener">Book this look <span class="arrow">&rarr;</span></a>
        <div class="lb-actions">
          <button class="lb-chip lb-save" type="button" aria-pressed="false">${HEART}<span>Save</span></button>
          <button class="lb-chip lb-share" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7.5h14V12"/></svg><span>Share</span></button>
        </div>
      </div>
      <button class="lb-nav lb-prev" type="button" aria-label="Previous look"><span aria-hidden="true">&larr;</span></button>
      <button class="lb-nav lb-next" type="button" aria-label="Next look"><span aria-hidden="true">&rarr;</span></button>
      <button class="lb-close" type="button" aria-label="Close viewer"><span aria-hidden="true">&times;</span></button>`;
    document.body.appendChild(viewer);

    ui.stage = viewer.querySelector('.lb-stage');
    ui.info = viewer.querySelector('.lb-info');
    ui.count = viewer.querySelector('.lb-count');
    ui.style = viewer.querySelector('.lb-style');
    ui.title = viewer.querySelector('.lb-title');
    ui.details = viewer.querySelector('.lb-details');
    ui.book = viewer.querySelector('.lb-book');
    ui.save = viewer.querySelector('.lb-save');
    ui.saveLabel = ui.save.querySelector('span');
    ui.prev = viewer.querySelector('.lb-prev');
    ui.next = viewer.querySelector('.lb-next');

    ui.prev.addEventListener('click', () => showLook(viewIndex - 1, 'prev'));
    ui.next.addEventListener('click', () => showLook(viewIndex + 1, 'next'));
    viewer.querySelector('.lb-close').addEventListener('click', () => viewer.close());

    // the booking link goes through main.js so in-app browsers still reach WhatsApp
    ui.book.addEventListener('click', (e) => {
      if (!ngm().openWhatsApp) return;
      e.preventDefault();
      ngm().openWhatsApp(ui.book.href);
    });

    ui.save.addEventListener('click', () => {
      const item = viewList[viewIndex];
      if (shortlist.has(item.id)) {
        shortlist.delete(item.id);
        notify('Removed from your shortlist');
      } else {
        shortlist.add(item.id);
        notify(shortlist.size === 1 ? 'Saved. Send your shortlist to Namita when you are ready.' : 'Saved to your shortlist');
      }
      saveShortlist();
      updateSaveButton(item);
      renderPill(true);
    });

    viewer.querySelector('.lb-share').addEventListener('click', async () => {
      const item = viewList[viewIndex];
      const url = lookUrl(item);
      if (navigator.share) {
        try {
          await navigator.share({ title: `${item.title} | Namita Garg Makeover`, text: `Look at this one: ${item.title}`, url });
        } catch (e) { /* closed the share sheet */ }
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        notify('Link copied. Paste it to share this look.');
      } catch (e) {
        window.prompt('Copy this link to share the look:', url);
      }
    });

    viewer.addEventListener('keydown', (e) => {
      if (e.target.matches && e.target.matches('input[type="range"]')) return;
      if (e.key === 'ArrowLeft') showLook(viewIndex - 1, 'prev');
      if (e.key === 'ArrowRight') showLook(viewIndex + 1, 'next');
    });

    // a click on the dark backdrop (outside the photo and the panel) closes
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer || e.target === ui.stage) viewer.close();
    });

    // swipe between looks on touch screens
    let startX = null;
    let startY = 0;
    ui.stage.addEventListener('pointerdown', (e) => {
      // dragging a before/after slider is not a swipe to the next look
      if (e.pointerType === 'mouse' || e.target.closest('.compare')) return;
      startX = e.clientX;
      startY = e.clientY;
    });
    ui.stage.addEventListener('pointerup', (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) showLook(viewIndex + 1, 'next');
        else showLook(viewIndex - 1, 'prev');
      }
    });

    viewer.addEventListener('close', () => {
      ui.stage.replaceChildren();
      document.documentElement.classList.remove('lb-open');
    });
  };

  // the space left for the photo once the info panel has taken its share
  const fitStage = () => {
    if (!viewer || !viewer.open) return;
    const cs = getComputedStyle(ui.stage);
    const room = ui.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    ui.stage.style.setProperty('--stage-max', `${Math.max(160, Math.floor(room))}px`);
  };
  window.addEventListener('resize', fitStage);

  function openViewer(list, index) {
    if (!list.length) return;
    ensureViewer();
    viewList = list;
    showLook(index);
    document.documentElement.classList.add('lb-open');
    if (typeof viewer.showModal === 'function') viewer.showModal();
    else viewer.setAttribute('open', '');
    fitStage();
  }

  // ============ "VIEW" CURSOR over look cards (mouse only) ============
  if (finePointer && !reducedMotion) {
    const cursor = make('div', 'view-cursor');
    cursor.setAttribute('aria-hidden', 'true');
    const label = make('span', null, 'View');
    cursor.appendChild(label);
    document.body.appendChild(cursor);

    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;
    let raf = null;
    let on = false;

    const tick = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      cursor.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      raf = on || Math.abs(x - cx) + Math.abs(y - cy) > 0.5 ? requestAnimationFrame(tick) : null;
    };

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      const card = e.target.closest && e.target.closest('.look-card');
      const dragging = card && card.closest('.strip.is-dragging');
      const show = !!card && !dragging;
      if (show && !on) {
        cx = x;
        cy = y;
      }
      if (card) label.textContent = card.dataset.cursor || 'View';
      on = show;
      cursor.classList.toggle('is-on', show);
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    document.addEventListener('pointerleave', () => {
      on = false;
      cursor.classList.remove('is-on');
    });
  }

  renderPill(false);

  // ============ HERO SLIDESHOW (home) ============
  const heroArch = document.getElementById('heroArch');

  if (heroArch) {
    const media = heroArch.querySelector('.arch-media');
    const captionText = heroArch.querySelector('.arch-caption-text');
    const dotsWrap = heroArch.querySelector('.arch-dots');
    const first = media.querySelector('.arch-slide');
    const slidesData = items.filter((it) => it.hero && it.type === 'photo');
    const firstData = slidesData.find((it) => it.id === first.dataset.id) || slidesData[0];
    const ordered = firstData ? [firstData, ...slidesData.filter((it) => it !== firstData)] : [];
    const slides = [first];
    let current = 0;
    let timer = null;

    const dots = ordered.map((it, n) => {
      const dot = make('button', `arch-dot${n === 0 ? ' is-active' : ''}`);
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show look ${n + 1} of ${ordered.length}: ${it.title}`);
      dot.addEventListener('click', () => {
        goTo(n);
        restart();
      });
      dotsWrap.appendChild(dot);
      return dot;
    });
    if (ordered.length < 2) dotsWrap.hidden = true;

    const SLIDE_MS = 5200;
    dotsWrap.style.setProperty('--slide-ms', `${SLIDE_MS}ms`);

    function goTo(n) {
      if (!slides[n] || n === current) return;
      slides[current].classList.remove('is-active');
      dots[current].classList.remove('is-active');
      current = n;
      slides[current].classList.add('is-active');
      dots[current].classList.add('is-active');
      captionText.textContent = ordered[current].title;
      captionText.classList.remove('swap');
      void captionText.offsetWidth;
      captionText.classList.add('swap');
    }

    // the active dot fills over SLIDE_MS (CSS), so it shows when the next
    // look is coming; .is-running starts that fill in step with the timer
    function restart() {
      clearInterval(timer);
      dotsWrap.classList.remove('is-running');
      if (reducedMotion || slides.length < 2) return;
      void dotsWrap.offsetWidth;
      dotsWrap.classList.add('is-running');
      timer = setInterval(() => {
        if (!document.hidden) goTo((current + 1) % slides.length);
      }, SLIDE_MS);
    }

    // the first slide is in the HTML for a fast first paint; the rest
    // load once the page has finished loading
    const addSlides = () => {
      ordered.slice(1).forEach((it) => {
        const img = make('img', 'arch-slide');
        img.alt = it.alt;
        img.decoding = 'async';
        img.sizes = first.sizes;
        const srcset = srcsetFor(it);
        if (srcset) img.srcset = srcset;
        img.src = it.src;
        if (it.focus) img.style.objectPosition = it.focus;
        media.appendChild(img);
        slides.push(img);
      });
      restart();
    };
    if (document.readyState === 'complete') addSlides();
    else window.addEventListener('load', addSlides, { once: true });
  }

  // ============ THE TRANSFORMATION (home) ============
  // Shows every look that has a `before` photo. The section stays hidden
  // until at least one real before/after pair is added to the data file.
  const tfSection = document.getElementById('transformation');
  const transforms = items.filter((it) => it.before && it.type === 'photo');

  if (tfSection && transforms.length) {
    tfSection.hidden = false;
    const holder = tfSection.querySelector('.tf-compare');
    const frame = tfSection.querySelector('.tf-frame');
    const lookStyle = tfSection.querySelector('.tf-look-style');
    const lookTitle = tfSection.querySelector('.tf-look-title');
    const thumbsWrap = tfSection.querySelector('.tf-thumbs');
    const sub = tfSection.querySelector('.tf-sub');
    if (sub && finePointer) sub.textContent = 'Move your mouse across the photo to see the difference.';

    let currentCompare = null;
    let seen = false;

    const showTransform = (n) => {
      const item = transforms[n];
      currentCompare = buildCompare(item, 'inline');
      holder.replaceChildren(currentCompare.el);
      lookStyle.textContent = item.style;
      lookTitle.textContent = item.details ? `${item.title} · ${item.details}` : item.title;
      thumbs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === n)));
      if (seen) currentCompare.hint();
    };

    const thumbs = transforms.length > 1 ? transforms.map((item, n) => {
      const btn = make('button', 'tf-thumb');
      btn.type = 'button';
      btn.setAttribute('aria-label', `Show ${item.title}`);
      const img = make('img', 'arch');
      img.src = item.thumb || item.src;
      img.alt = '';
      img.loading = 'lazy';
      if (item.focus) img.style.objectPosition = item.focus;
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        // a quick cross-fade while the next pair swaps in
        holder.classList.add('is-swapping');
        setTimeout(() => {
          showTransform(n);
          holder.classList.remove('is-swapping');
        }, reducedMotion ? 0 : 220);
      });
      thumbsWrap.appendChild(btn);
      return btn;
    }) : [];
    if (!thumbs.length) thumbsWrap.hidden = true;

    showTransform(0);

    // the first time the slider is properly on screen, draw the gold arch
    // and sweep the divider once so it is obvious it can be dragged
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        seen = true;
        frame.classList.add('is-seen');
        setTimeout(() => currentCompare.hint(), 600);
      }, { threshold: 0.55 });
      io.observe(holder);
    } else {
      frame.classList.add('is-seen');
    }
  }

  // ============ HOME STRIP ============
  const strip = document.getElementById('looksStrip');

  if (strip) {
    const homeItems = items.filter((it) => it.home);
    homeItems.forEach((it) => {
      strip.appendChild(buildCard(it, 'look-card-strip', '(max-width: 900px) 62vw, 280px', () => homeItems));
    });

    const step = () => {
      const card = strip.querySelector('.look-card');
      return card ? card.getBoundingClientRect().width + 20 : 300;
    };
    const arrowBtns = [...document.querySelectorAll('[data-strip-dir]')];
    arrowBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        strip.scrollBy({ left: step() * Number(btn.dataset.stripDir), behavior: reducedMotion ? 'auto' : 'smooth' });
      });
    });

    // progress line under the strip, and arrows that rest at either end
    const progress = document.querySelector('.strip-progress span');
    let stripTicking = false;
    const updateStrip = () => {
      stripTicking = false;
      const max = strip.scrollWidth - strip.clientWidth;
      if (progress) {
        progress.style.setProperty('--thumb', `${Math.min(100, (strip.clientWidth / strip.scrollWidth) * 100).toFixed(2)}%`);
        progress.style.setProperty('--offset', `${((strip.scrollLeft / strip.clientWidth) * 100).toFixed(2)}%`);
      }
      arrowBtns.forEach((btn) => {
        const back = Number(btn.dataset.stripDir) < 0;
        btn.disabled = back ? strip.scrollLeft <= 2 : strip.scrollLeft >= max - 2;
      });
    };
    strip.addEventListener('scroll', () => {
      if (!stripTicking) {
        stripTicking = true;
        requestAnimationFrame(updateStrip);
      }
    }, { passive: true });
    window.addEventListener('resize', updateStrip);
    updateStrip();

    // drag to scroll with a mouse; a drag never counts as a click
    let downX = null;
    let startLeft = 0;
    let dragged = false;
    strip.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      downX = e.clientX;
      startLeft = strip.scrollLeft;
      dragged = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (downX == null) return;
      const dx = e.clientX - downX;
      if (!dragged && Math.abs(dx) > 6) {
        dragged = true;
        strip.classList.add('is-dragging');
      }
      if (dragged) strip.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (downX == null) return;
      downX = null;
      strip.classList.remove('is-dragging');
      if (dragged) {
        strip.querySelectorAll('.look-card').forEach((c) => { c.dataset.dragged = '1'; });
        setTimeout(() => strip.querySelectorAll('.look-card').forEach((c) => { delete c.dataset.dragged; }), 0);
      }
    });
    strip.addEventListener('dragstart', (e) => e.preventDefault());
  }

  // ============ PORTFOLIO PAGE ============
  const grid = document.getElementById('portfolioGrid');

  if (grid) {
    const filtersWrap = document.getElementById('portfolioFilters');
    const emptyNote = document.getElementById('portfolioEmpty');
    const cards = new Map();

    const filters = [{ key: 'all', label: 'All looks', test: () => true }];
    [...new Set(items.map((it) => it.style).filter(Boolean))].forEach((style) => {
      filters.push({ key: slug(style), label: style, test: (it) => it.style === style });
    });
    if (items.some((it) => it.type === 'video')) {
      filters.push({ key: 'videos', label: 'Videos', test: (it) => it.type === 'video' });
    }
    if (items.some((it) => it.before)) {
      filters.push({ key: 'before-after', label: 'Before / after', test: (it) => !!it.before });
    }

    let active = filters[0];
    const visible = () => items.filter(active.test);

    items.forEach((it) => {
      const card = buildCard(it, 'look-card-grid reveal', '(max-width: 560px) 46vw, (max-width: 900px) 31vw, 24vw', visible);
      cards.set(it, card);
      grid.appendChild(card);
    });

    const chips = filters.map((f) => {
      const chip = make('button', 'filter-chip');
      chip.type = 'button';
      chip.dataset.key = f.key;
      chip.append(make('span', null, f.label), make('span', 'filter-count', String(items.filter(f.test).length)));
      chip.addEventListener('click', () => apply(f, true));
      filtersWrap.appendChild(chip);
      return chip;
    });

    function apply(filter, fromClick) {
      active = filter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.key === filter.key)));
      const entering = [];
      items.forEach((it) => {
        const show = filter.test(it);
        const card = cards.get(it);
        card.hidden = !show;
        if (show && fromClick) {
          // replay the fade-up, staggered, so the new set arrives together
          card.classList.remove('in');
          card.style.setProperty('--reveal-delay', `${Math.min(entering.length, 8) * 0.05}s`);
          entering.push(card);
        }
      });
      if (entering.length) {
        void grid.offsetWidth;
        entering.forEach((card) => card.classList.add('in'));
      }
      if (emptyNote) emptyNote.hidden = items.some(filter.test);
      if (fromClick) {
        history.replaceState(null, '', filter.key === 'all' ? location.pathname + location.search : `#${filter.key}`);
      }
    }

    const fromHash = filters.find((f) => `#${f.key}` === location.hash);
    apply(fromHash || filters[0], false);

    // a link straight to one look, e.g. portfolio.html#look-floral-terrace
    const lookMatch = location.hash.match(/^#look-(.+)$/);
    if (lookMatch) {
      const it = items.find((x) => x.id === lookMatch[1]);
      if (it) openViewer(visible(), visible().indexOf(it));
    }
  }
})();
