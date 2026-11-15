'use strict';

/* NightWither Discord-Seite – Abschnitt „Kooperation“ (15.11.2026)
   Die Partner-Server stehen NICHT hier im Code. Niki pflegt sie in der Google-Tabelle NWU_Community,
   Blatt „Partner“ (Name | Einladungs-Link | Beschreibung | Anzeigen ja/nein). Der Worker liefert die Liste.
   Ist die Liste leer oder nicht erreichbar, bleiben Abschnitt und Reiter unsichtbar. */
(() => {
  const PARTNER_URL = 'https://nwu-anmeldung.nwu-brand.workers.dev/partner';
  const ZEITLIMIT_MS = 6000;
  const PAUSEN_MS = [0, 400, 1500]; // Wartezeit vor jedem Versuch
  const MAX_KACHELN = 24;
  // Nur echte Discord-Einladungen werden verlinkt, auch wenn der Worker einmal etwas anderes liefern sollte
  const NUR_DISCORD = /^https:\/\/(?:discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,32}$/;

  const liste = document.getElementById('partnerListe');
  if (!liste) return;

  function neu(tag, klasse, text) {
    const n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text) n.textContent = text;
    return n;
  }

  function kachel(p) {
    const a = neu('a', 'partner-karte');
    a.href = p.link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.append(neu('span', 'partner-name', p.name));
    if (p.text) a.append(neu('span', 'partner-text', p.text));
    a.append(neu('span', 'partner-los', 'Zum Server'));
    const li = neu('li');
    li.append(a);
    return li;
  }

  function gueltig(roh) {
    if (!roh || !Array.isArray(roh.partner)) return [];
    return roh.partner
      .map((p) => ({ name: String((p && p.name) || '').trim(), link: String((p && p.link) || '').trim(), text: String((p && p.text) || '').trim() }))
      .filter((p) => p.name && NUR_DISCORD.test(p.link))
      .slice(0, MAX_KACHELN);
  }

  async function abrufen() {
    const abbruch = new AbortController();
    const uhr = setTimeout(() => abbruch.abort(), ZEITLIMIT_MS);
    try {
      const res = await fetch(PARTNER_URL, { credentials: 'omit', signal: abbruch.signal });
      return res.ok ? gueltig(await res.json()) : null;
    } catch (e) {
      return null; // Netzfehler oder Zeitlimit: der nächste Versuch folgt
    } finally {
      clearTimeout(uhr);
    }
  }

  async function laden() {
    for (const pause of PAUSEN_MS) {
      if (pause) await new Promise((r) => setTimeout(r, pause));
      const partner = await abrufen();
      if (!partner) continue;
      if (!partner.length) return; // Liste ist leer: nichts zeigen
      liste.replaceChildren(...partner.map(kachel));
      document.querySelectorAll('[data-partner]').forEach((n) => { n.hidden = false; });
      return;
    }
  }

  laden();
})();
