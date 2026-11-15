'use strict';

/* NightWither Discord-Seite – Laufband, Slider und Scroll-Bewegung (15.11.2026)
   Läuft nach discord.js und fasst dessen Daten nicht an (liest nur die schon geladenen Zahlen aus der Seite).
   Zurücksetzen: in index.html die zwei Zeilen mit „auftritt“ entfernen. */
(() => {
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hatBeobachter = 'IntersectionObserver' in window;
  const STAFFEL_MS = 70;      // Abstand zwischen Geschwistern beim Einblenden
  const STAFFEL_MAX = 6;
  const ZIEH_SCHWELLE_PX = 4; // ab hier gilt eine Mausbewegung als Ziehen
  const ZAEHL_DAUER_MS = 1100;
  const BAND_WIEDERHOLUNGEN = 6;
  const BAND_TEXT = ['Community', 'Zusammen zocken', 'Labern', 'Eine geile Zeit', 'Tritt der Dunkelheit bei'];
  const NS = 'http://www.w3.org/2000/svg';

  function neu(tag, klasse, text) {
    const n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function pfeil(pfad) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', pfad);
    svg.append(p);
    return svg;
  }

  // Nur einmal je Bild arbeiten, egal wie oft der Browser das Ereignis meldet
  function gedrosselt(fn) {
    let wartet = false;
    return () => {
      if (wartet) return;
      wartet = true;
      requestAnimationFrame(() => { wartet = false; fn(); });
    };
  }

  /* ---------- Laufband ---------- */
  function bandFuellen(zusatz) {
    const spur = document.getElementById('bandTrack');
    if (!spur) return;
    const teile = zusatz ? [...BAND_TEXT, zusatz] : BAND_TEXT;
    const stuecke = [];
    for (let runde = 0; runde < BAND_WIEDERHOLUNGEN; runde++) {
      teile.forEach((t) => {
        const sp = neu('span', '', t);
        const krone = document.createElement('img');
        krone.src = 'crown.webp';
        krone.alt = '';
        sp.append(krone);
        stuecke.push(sp);
      });
    }
    spur.replaceChildren(...stuecke);
  }

  /* ---------- Zahlen zählen hoch, sobald discord.js sie eingetragen hat ---------- */
  function hochzaehlen(el) {
    const ziel = Number(String(el.textContent).replace(/\D/g, ''));
    if (!ziel || ruhig) return;
    const start = performance.now();
    const schritt = (jetzt) => {
      const anteil = Math.min(1, (jetzt - start) / ZAEHL_DAUER_MS);
      const weich = 1 - Math.pow(1 - anteil, 3);
      el.textContent = Math.round(ziel * weich).toLocaleString('de-DE');
      if (anteil < 1) requestAnimationFrame(schritt);
    };
    el.textContent = '0';
    requestAnimationFrame(schritt);
  }

  function zahlen() {
    const bereich = document.getElementById('discordStats');
    if (!bereich) return;
    let gezeigt = false;
    const zeigen = () => {
      if (gezeigt || bereich.hidden) return;
      gezeigt = true;
      const online = document.getElementById('statOnline');
      if (online && Number(String(online.textContent).replace(/\D/g, ''))) bandFuellen(`${online.textContent} gerade online`);
      bereich.querySelectorAll('.stat-number').forEach(hochzaehlen);
    };
    new MutationObserver(zeigen).observe(bereich, { attributes: true, attributeFilter: ['hidden'] });
    zeigen();
  }

  /* ---------- Einblenden beim Scrollen ---------- */
  function einblenden() {
    if (ruhig || !hatBeobachter) return;
    const gruppen = [
      ['.sec h2, .cta h2', 'rv-h'],
      ['.stats, .sec-lead, .sec-note, .punkte li, .faq details, .form, .cta p, .cta .btn-gold', 'rv']   // der Fuß bleibt draußen: ganz unten erreicht er die Auslöse-Zone nie
    ];
    const beobachter = new IntersectionObserver((eintraege) => {
      eintraege.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('rv-in');
        beobachter.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    gruppen.forEach(([auswahl, klasse]) => {
      document.querySelectorAll(auswahl).forEach((n) => {
        const platz = [...n.parentElement.children].filter((c) => c.matches(auswahl)).indexOf(n);
        if (klasse === 'rv-h') {
          const huelle = neu('span', 'rv-hi');
          huelle.append(...n.childNodes);
          n.append(huelle);
        }
        n.classList.add(klasse);
        n.style.setProperty('--rv-d', `${Math.min(platz, STAFFEL_MAX) * STAFFEL_MS}ms`);
        beobachter.observe(n);
      });
    });
  }

  /* ---------- Goldene Fortschrittslinie ---------- */
  function fortschritt() {
    const bar = document.querySelector('.bar');
    if (!bar) return;
    const setzen = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--prog', max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : '0');
    };
    const melden = gedrosselt(setzen);
    window.addEventListener('scroll', melden, { passive: true });
    window.addEventListener('resize', melden);
    setzen();
  }

  /* ---------- Server-Struktur als Slider ---------- */
  function serverSlider() {
    const grid = document.querySelector('.server-grid');
    if (!grid || grid.children.length < 2) return;

    const daumen = neu('i');
    const linie = neu('div', 'slider-line');
    linie.append(daumen);
    const zaehler = neu('span', 'slider-count');
    const zurueck = neu('button', 'slider-btn zurueck');
    zurueck.type = 'button';
    zurueck.setAttribute('aria-label', 'Zurück');
    zurueck.append(pfeil('M14 6l-6 6 6 6'));
    const vor = neu('button', 'slider-btn vor');
    vor.type = 'button';
    vor.setAttribute('aria-label', 'Weiter');
    vor.append(pfeil('M10 6l6 6-6 6'));
    const nav = neu('div', 'slider-nav');
    nav.append(linie, zaehler, zurueck, vor);
    grid.after(nav);

    grid.classList.add('is-slider');
    grid.tabIndex = 0;
    grid.setAttribute('role', 'region');
    grid.setAttribute('aria-label', 'Bereiche des Servers, seitlich blätterbar');

    const schritt = () => grid.children[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(grid).columnGap) || 0);
    const ende = () => grid.scrollWidth - grid.clientWidth;

    const stand = () => {
      const max = ende();
      const anteil = Math.min(1, grid.clientWidth / grid.scrollWidth);
      const weg = max > 0 ? Math.min(1, grid.scrollLeft / max) : 0;
      daumen.style.width = `${anteil * 100}%`;
      daumen.style.transform = `translateX(${weg * (1 / anteil - 1) * 100}%)`;
      const anzahl = grid.children.length;
      const platz = weg > 0.995 ? anzahl : Math.min(anzahl, Math.round(grid.scrollLeft / schritt()) + 1);
      zaehler.replaceChildren(neu('b', '', String(platz).padStart(2, '0')), ` / ${String(anzahl).padStart(2, '0')}`);
      zurueck.disabled = grid.scrollLeft < 2;
      vor.disabled = grid.scrollLeft > max - 2;
    };
    const melden = gedrosselt(stand);

    const blaettern = (richtung) => grid.scrollBy({ left: richtung * schritt(), behavior: ruhig ? 'auto' : 'smooth' });
    zurueck.addEventListener('click', () => blaettern(-1));
    vor.addEventListener('click', () => blaettern(1));
    grid.addEventListener('scroll', melden, { passive: true });
    window.addEventListener('resize', melden);

    // Mit der Maus ziehen (am Handy wischt der Browser von selbst)
    let zieht = false, bewegt = false, startX = 0, startLinks = 0;
    grid.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      zieht = true; bewegt = false; startX = e.clientX; startLinks = grid.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!zieht) return;
      const dx = e.clientX - startX;
      if (!bewegt && Math.abs(dx) > ZIEH_SCHWELLE_PX) { bewegt = true; grid.classList.add('zieht'); }
      if (bewegt) grid.scrollLeft = startLinks - dx;
    });
    const loslassen = () => {
      if (!zieht) return;
      zieht = false;
      if (!bewegt) return;
      const s = schritt();
      grid.scrollTo({ left: Math.min(ende(), Math.round(grid.scrollLeft / s) * s), behavior: ruhig ? 'auto' : 'smooth' });
      setTimeout(() => grid.classList.remove('zieht'), 450);
    };
    window.addEventListener('pointerup', loslassen);
    window.addEventListener('pointercancel', loslassen);

    stand();
  }

  bandFuellen('');
  serverSlider();
  einblenden();
  fortschritt();
  zahlen();
})();
