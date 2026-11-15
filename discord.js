'use strict';

const WORKER = 'https://nwu-anmeldung.nwu-brand.workers.dev';
const $ = (id) => document.getElementById(id);

// ---------- Partikel ----------
const canvas = $('particle-canvas');
const ctx = canvas.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.size = Math.random() * 2 + 0.5;
    this.opacity = Math.random() * 0.5 + 0.2;
    // Farbe aus saison.js (Halloween orange usw.), sonst das normale NWU-Gold
    const s = window.NWU_SAISON;
    this.color = Math.random() > 0.5 ? 'rgba(' + (s ? s.rgb : '201, 168, 76') + ',' : 'rgba(' + (s ? s.rgbHi : '232, 201, 109') + ',';
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    this.opacity = Math.max(0.1, Math.min(0.8, this.opacity + (Math.random() - 0.5) * 0.02));
  }
  draw() {
    ctx.fillStyle = this.color + this.opacity + ')';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

const particles = Array.from({ length: 50 }, () => new Particle());
function animate() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  particles.forEach((p) => { p.update(); p.draw(); });
  if (!reduceMotion) requestAnimationFrame(animate);
}
animate();

// ---------- Menü ----------
const menuToggle = document.querySelector('.menu-toggle');
const sideMenu = document.querySelector('.side-menu');
const menuOverlay = document.querySelector('.menu-overlay');

function closeMenu() {
  sideMenu.classList.remove('active');
  menuOverlay.classList.remove('active');
  menuToggle.setAttribute('aria-expanded', 'false');
}
menuToggle.setAttribute('aria-expanded', 'false');
menuToggle.addEventListener('click', () => {
  const open = sideMenu.classList.toggle('active');
  menuOverlay.classList.toggle('active', open);
  menuToggle.setAttribute('aria-expanded', String(open));
});
menuOverlay.addEventListener('click', closeMenu);
document.querySelectorAll('.menu-item').forEach((item) => item.addEventListener('click', closeMenu));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

// ---------- Mitgliederzahl ----------
// Discord antwortet dem Worker nicht immer beim ersten Mal. Darum: mehrmals versuchen
// und die zuletzt gesehenen Zahlen im Browser merken, damit der Bereich nie leer bleibt.
const STATS_MERKER = 'nwu-discord-stats';
const STATS_VERSUCHE = 4;
const STATS_PAUSE_MS = 1500;
const STATS_ZEITLIMIT_MS = 6000;

function showStats(members, online) {
  $('statMembers').textContent = members.toLocaleString('de-DE');
  $('statOnline').textContent = (online || 0).toLocaleString('de-DE');
  $('discordStats').hidden = false;
}

function gemerkteStats() {
  try {
    const d = JSON.parse(localStorage.getItem(STATS_MERKER) || 'null');
    return d && Number(d.members) > 0 ? { members: Number(d.members), online: Number(d.online) || 0 } : null;
  } catch (e) {
    return null; // Speicher gesperrt oder Inhalt kaputt: dann eben ohne Merker
  }
}

async function fetchStats() {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), STATS_ZEITLIMIT_MS);
  try {
    const res = await fetch(WORKER + '/discord-stats', { credentials: 'omit', signal: abbruch.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const members = Number(data.members);
    return members > 0 ? { members, online: Number(data.online) || 0 } : null;
  } catch (e) {
    return null; // Netzfehler oder Zeitlimit: der nächste Versuch folgt
  } finally {
    clearTimeout(uhr);
  }
}

async function loadStats() {
  for (let versuch = 0; versuch < STATS_VERSUCHE; versuch++) {
    if (versuch) await new Promise((r) => setTimeout(r, STATS_PAUSE_MS * versuch));
    const stats = await fetchStats();
    if (!stats) continue;
    showStats(stats.members, stats.online);
    try { localStorage.setItem(STATS_MERKER, JSON.stringify(stats)); } catch (e) { /* Speicher gesperrt: nicht schlimm */ }
    return;
  }
  // Alle Versuche gescheitert: lieber die Zahlen vom letzten Besuch als gar keine
  const alt = gemerkteStats();
  if (alt) showStats(alt.members, alt.online);
}
loadStats();

// ---------- Feedback ----------
const feedbackForm = $('feedback-form');
const formStatus = $('form-status');

function setStatus(text, type) {
  formStatus.textContent = text;
  formStatus.className = 'form-status' + (type ? ' ' + type : '');
}

feedbackForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const category = $('feedback-category').value;
  const message = $('feedback-message').value.trim();

  if (!category || message.length < 5) {
    setStatus('Bitte Kategorie wählen und Feedback schreiben.', 'error');
    return;
  }

  const btn = $('feedback-submit');
  btn.disabled = true;
  try {
    const res = await fetch(WORKER + '/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({
        category,
        message: message.slice(0, 1500),
        website: $('feedback-website').value
      })
    });
    if (!res.ok) throw new Error('Status ' + res.status);
    setStatus('✓ Feedback versendet. Danke dir!', 'success');
    feedbackForm.reset();
    setTimeout(() => setStatus('', ''), 5000);
  } catch (err) {
    setStatus('✗ Versand fehlgeschlagen. Bitte später erneut versuchen.', 'error');
  } finally {
    btn.disabled = false;
  }
});
