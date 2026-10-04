// Namita Garg Makeover, portfolio rendering: hero slideshow, home strip,
// portfolio grid with filters, and the look viewer (lightbox).
// Content comes from js/portfolio-data.js. Load this before main.js so the
// cards it creates pick up the shared scroll reveals.

(() => {
  const items = window.NGM_PORTFOLIO || [];
  const WA_NUMBER = '919235112453';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);

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

    const media = make('span', 'look-media arch');
    media.appendChild(cardMedia(item, sizes));
    if (item.type === 'video') media.appendChild(make('span', 'look-badge', 'Video'));
    else if (item.before) media.appendChild(make('span', 'look-badge', 'Before / after'));

    const meta = make('span', 'look-meta');
    meta.append(make('span', 'look-style', item.style), make('span', 'look-title', item.title));

    card.append(media, meta);
    card.addEventListener('click', () => {
      if (card.dataset.dragged) return;
      const list = getList();
      openViewer(list, Math.max(0, list.indexOf(item)));
    });
    return card;
  };

  // ============ LOOK VIEWER ============
  let viewer = null;
  let viewList = [];
  let viewIndex = 0;
  const ui = {};

  const waLink = (item) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Hi Namita, I loved the "${item.title}" look on your website. Is my date free?`
  )}`;

  const compareSlider = (item) => {
    const wrap = make('div', 'compare');
    wrap.style.setProperty('--pos', '50%');
    const after = make('img', 'cmp-after');
    after.src = item.src;
    after.alt = item.alt || item.title;
    const before = make('img', 'cmp-before');
    before.src = item.before;
    before.alt = `${item.title}, before makeup`;
    const handle = make('span', 'cmp-handle');
    handle.setAttribute('aria-hidden', 'true');
    const range = make('input', 'cmp-range');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.value = '50';
    range.setAttribute('aria-label', 'Drag to compare before and after');
    range.addEventListener('input', () => wrap.style.setProperty('--pos', `${range.value}%`));
    wrap.append(after, before, make('span', 'cmp-label cmp-label-before', 'Before'), make('span', 'cmp-label cmp-label-after', 'After'), handle, range);
    return wrap;
  };

  const viewerMedia = (item) => {
    if (item.before) return compareSlider(item);
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

  const showLook = (i) => {
    viewIndex = (i + viewList.length) % viewList.length;
    const item = viewList[viewIndex];
    ui.stage.replaceChildren(viewerMedia(item));
    ui.count.textContent = `${viewIndex + 1} / ${viewList.length}`;
    ui.style.textContent = item.style;
    ui.title.textContent = item.title;
    ui.details.textContent = item.details || '';
    ui.details.hidden = !item.details;
    ui.book.href = waLink(item);
    const single = viewList.length < 2;
    ui.prev.hidden = single;
    ui.next.hidden = single;

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
      </div>
      <button class="lb-nav lb-prev" type="button" aria-label="Previous look"><span aria-hidden="true">&larr;</span></button>
      <button class="lb-nav lb-next" type="button" aria-label="Next look"><span aria-hidden="true">&rarr;</span></button>
      <button class="lb-close" type="button" aria-label="Close viewer"><span aria-hidden="true">&times;</span></button>`;
    document.body.appendChild(viewer);

    ui.stage = viewer.querySelector('.lb-stage');
    ui.count = viewer.querySelector('.lb-count');
    ui.style = viewer.querySelector('.lb-style');
    ui.title = viewer.querySelector('.lb-title');
    ui.details = viewer.querySelector('.lb-details');
    ui.book = viewer.querySelector('.lb-book');
    ui.prev = viewer.querySelector('.lb-prev');
    ui.next = viewer.querySelector('.lb-next');

    ui.prev.addEventListener('click', () => showLook(viewIndex - 1));
    ui.next.addEventListener('click', () => showLook(viewIndex + 1));
    viewer.querySelector('.lb-close').addEventListener('click', () => viewer.close());

    viewer.addEventListener('keydown', (e) => {
      if (e.target.matches && e.target.matches('input[type="range"]')) return;
      if (e.key === 'ArrowLeft') showLook(viewIndex - 1);
      if (e.key === 'ArrowRight') showLook(viewIndex + 1);
    });

    // a click on the dark backdrop (outside the photo and the panel) closes
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer || e.target === ui.stage) viewer.close();
    });

    // swipe between looks on touch screens
    let startX = null;
    let startY = 0;
    ui.stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || e.target.matches('input')) return;
      startX = e.clientX;
      startY = e.clientY;
    });
    ui.stage.addEventListener('pointerup', (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showLook(viewIndex + (dx < 0 ? 1 : -1));
    });

    viewer.addEventListener('close', () => {
      ui.stage.replaceChildren();
      document.documentElement.classList.remove('lb-open');
    });
  };

  function openViewer(list, index) {
    if (!list.length) return;
    ensureViewer();
    viewList = list;
    showLook(index);
    document.documentElement.classList.add('lb-open');
    if (typeof viewer.showModal === 'function') viewer.showModal();
    else viewer.setAttribute('open', '');
  }

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

    function goTo(n) {
      if (!slides[n] || n === current) return;
      slides[current].classList.remove('is-active');
      dots[current].classList.remove('is-active');
      current = n;
      slides[current].classList.add('is-active');
      dots[current].classList.add('is-active');
      captionText.textContent = ordered[current].title;
    }

    function restart() {
      clearInterval(timer);
      if (reducedMotion || slides.length < 2) return;
      timer = setInterval(() => {
        if (!document.hidden) goTo((current + 1) % slides.length);
      }, 5200);
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
    document.querySelectorAll('[data-strip-dir]').forEach((btn) => {
      btn.addEventListener('click', () => {
        strip.scrollBy({ left: step() * Number(btn.dataset.stripDir), behavior: reducedMotion ? 'auto' : 'smooth' });
      });
    });

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
      let shown = 0;
      items.forEach((it) => {
        const show = filter.test(it);
        const card = cards.get(it);
        card.hidden = !show;
        if (show) shown += 1;
        // cards revealed by a filter skip the scroll fade-in
        if (show && fromClick) card.classList.add('in');
      });
      if (emptyNote) emptyNote.hidden = shown > 0;
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
