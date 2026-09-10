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
    this.color = Math.random() > 0.5 ? 'rgba(201, 168, 76,' : 'rgba(232, 201, 109,';
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
async function loadStats() {
  try {
    const res = await fetch(WORKER + '/discord-stats', { credentials: 'omit' });
    if (!res.ok) return;
    const data = await res.json();
    const members = Number(data.members);
    const online = Number(data.online);
    if (!members) return;
    $('statMembers').textContent = members.toLocaleString('de-DE');
    $('statOnline').textContent = (online || 0).toLocaleString('de-DE');
    $('discordStats').hidden = false;
  } catch (e) {
    // Ohne Zahlen bleibt der Bereich einfach ausgeblendet
  }
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
