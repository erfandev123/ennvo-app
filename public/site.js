/* Ennvo public pages – shared, dependency-free interactions. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // Header elevation on scroll
  const header = document.querySelector('.site-header');
  if (header) {
    const syncHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });
  }

  // Mobile navigation
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navLinks = document.querySelector('[data-nav-links]');
  if (navToggle && navLinks) {
    const closeNav = () => {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeNav();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNav();
    });
  }

  // Reveal content as it enters the viewport
  const revealItems = Array.from(document.querySelectorAll('.reveal'));
  if (revealItems.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      revealItems.forEach((item) => observer.observe(item));
      // Safety net: never leave content invisible if something goes wrong.
      window.setTimeout(() => revealItems.forEach((item) => item.classList.add('is-visible')), 2600);
    }
  }

  // Count-up numbers, e.g. <span data-count="6">6</span>
  const counters = Array.from(document.querySelectorAll('[data-count]'));
  if (counters.length && !reduceMotion && 'IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = Number(el.getAttribute('data-count'));
          const suffix = el.getAttribute('data-suffix') || '';
          if (!Number.isFinite(target)) return;
          const duration = 1100;
          const started = performance.now();
          const tick = (now) => {
            const progress = Math.min((now - started) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          counterObserver.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((counter) => counterObserver.observe(counter));
  }

  // Cursor: soft spotlight + precision dot + trailing ring
  if (finePointer && !reduceMotion) {
    const glow = document.querySelector('[data-cursor-glow]');
    const dot = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');
    if (glow || dot || ring) {
      let mouseX = window.innerWidth / 2;
      let mouseY = window.innerHeight / 2;
      let ringX = mouseX;
      let ringY = mouseY;
      let cursorActive = false;

      const activateCursor = () => {
        if (cursorActive) return;
        cursorActive = true;
        root.classList.add('has-cursor');
        if (dot) dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
        if (ring) ring.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      };

      window.addEventListener(
        'pointermove',
        (event) => {
          mouseX = event.clientX;
          mouseY = event.clientY;
          if (!cursorActive) {
            ringX = mouseX;
            ringY = mouseY;
            activateCursor();
          }
          if (glow) {
            glow.style.setProperty('--mx', `${mouseX}px`);
            glow.style.setProperty('--my', `${mouseY}px`);
          }
          if (dot) dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
        },
        { passive: true }
      );

      const deactivateCursor = () => {
        cursorActive = false;
        root.classList.remove('has-cursor');
      };
      window.addEventListener('blur', deactivateCursor);
      document.documentElement.addEventListener('mouseleave', deactivateCursor);

      if (ring) {
        const animateRing = () => {
          ringX += (mouseX - ringX) * 0.16;
          ringY += (mouseY - ringY) * 0.16;
          ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
          requestAnimationFrame(animateRing);
        };
        requestAnimationFrame(animateRing);

        const interactive = 'a, button, summary, input, textarea, select, [data-cursor-hover]';
        document.querySelectorAll(interactive).forEach((el) => {
          el.addEventListener('mouseenter', () => ring.classList.add('is-hover'));
          el.addEventListener('mouseleave', () => ring.classList.remove('is-hover'));
        });
      }
    }
  }

  // Subtle pointer tilt for hero product cards
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    if (!finePointer || reduceMotion) return;
    const strength = Number(card.getAttribute('data-tilt')) || 6;
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1100px) rotateX(${(-py * strength).toFixed(2)}deg) rotateY(${(px * strength).toFixed(2)}deg) translateY(-2px)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = 'perspective(1100px) rotateX(0deg) rotateY(0deg) translateY(0)';
    });
  });

  // Keep copyright years current
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
