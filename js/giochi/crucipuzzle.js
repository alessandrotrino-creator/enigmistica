/* Crucipuzzle: parole dell'archivio nascoste nella griglia; le lettere avanzate, lette in ordine, formano la parola segreta. */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  const D2 = [[0, 1], [1, 0]], D3 = D2.concat([[1, 1]]), D6 = D3.concat([[-1, 1], [0, -1], [-1, 0]]), D8 = D6.concat([[-1, -1], [1, -1]]);
  // lato: dimensione della griglia; noto: notorietà massima; dir: direzioni ammesse;
  // segreta: lettere avanzate ammesse (minimo, massimo); definizioni: l'elenco mostra le definizioni al posto delle parole.
  const LIVELLI = [
    { n: 1, nome: "Principiante", lato: 8,  noto: 1, min: 3, max: 7,  dir: D2, segreta: [3, 12], defSegreta: 0 },
    { n: 2, nome: "Facile",       lato: 10, noto: 2, min: 3, max: 9,  dir: D3, segreta: [4, 12], defSegreta: 0 },
    { n: 3, nome: "Medio",        lato: 12, noto: 2, min: 3, max: 11, dir: D6, segreta: [5, 13], defSegreta: 0 },
    { n: 4, nome: "Difficile",    lato: 14, noto: 3, min: 4, max: 13, dir: D8, segreta: [5, 14], defSegreta: 1 },
    { n: 5, nome: "Esperto",      lato: 15, noto: 3, min: 4, max: 14, dir: D8, segreta: [6, 14], defSegreta: 1, definizioni: true }
  ];

  /* ---------- Generatore ---------- */

  // Indice per lunghezza e per lettera in posizione: trova in fretta le parole che rispettano uno schema.
  function creaIndice(voci) {
    const perLen = new Map();
    for (const v of voci) {
      let x = perLen.get(v.r.length);
      if (!x) perLen.set(v.r.length, x = { tutte: [], pos: [] });
      x.tutte.push(v);
      for (let i = 0; i < v.r.length; i++) {
        const m = x.pos[i] || (x.pos[i] = {});
        (m[v.r[i]] || (m[v.r[i]] = [])).push(v);
      }
    }
    return perLen;
  }
  function compatibili(indice, schema) {
    const x = indice.get(schema.length);
    if (!x) return [];
    let base = null;
    schema.forEach((ch, i) => { if (ch) { const l = (x.pos[i] && x.pos[i][ch]) || []; if (!base || l.length < base.length) base = l; } });
    return (base || x.tutte).filter(v => schema.every((ch, i) => !ch || v.r[i] === ch));
  }

  const dentro = (N, r, c) => r >= 0 && c >= 0 && r < N && c < N;

  // Quante volte la parola compare nella griglia completa (le palindrome si leggono due volte nello stesso punto).
  function occorrenze(g, N, w) {
    let n = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (g[r * N + c] !== w[0]) continue;
      for (const [dr, dc] of D8) {
        if (!dentro(N, r + dr * (w.length - 1), c + dc * (w.length - 1))) continue;
        let i = 1;
        while (i < w.length && g[(r + dr * i) * N + c + dc * i] === w[i]) i++;
        if (i === w.length) n++;
      }
    }
    return w === w.split("").reverse().join("") ? n / 2 : n;
  }

  function tentativo(pool, indice, tutte, lv) {
    const N = lv.lato, g = new Array(N * N).fill(null), parole = [], usate = [];
    const legata = r => usate.some(u => u.includes(r) || r.includes(u));
    const schema = (r, c, dr, dc, L) => Array.from({ length: L }, (_, i) => g[(r + dr * i) * N + c + dc * i]);
    function piazza(v, r, c, dr, dc) {
      for (let i = 0; i < v.r.length; i++) g[(r + dr * i) * N + c + dc * i] = v.r[i];
      usate.push(v.r);
      parole.push({ r: v.r, testo: v.testo, voce: v, r0: r, c0: c, dr, dc, len: v.r.length, materia: v.materia, trovata: false });
    }

    // 1. Parole principali, dove incrociano di più.
    for (const v of E.mescola(pool.slice()).slice(0, 400)) {
      if (parole.length >= Math.round(N * 0.9)) break;
      if (legata(v.r)) continue;
      let best = null;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of lv.dir) {
        if (!dentro(N, r + dr * (v.r.length - 1), c + dc * (v.r.length - 1))) continue;
        const s = schema(r, c, dr, dc, v.r.length);
        if (s.some((ch, i) => ch && ch !== v.r[i])) continue;
        const incroci = s.filter(Boolean).length;
        if (incroci === v.r.length) continue;
        const punti = incroci * 3 + Math.random() * 2;
        if (!best || punti > best.punti) best = { r, c, dr, dc, punti };
      }
      if (best) piazza(v, best.r, best.c, best.dr, best.dc);
    }

    // 2. Riempimento dei buchi: per ogni casella vuota si cerca una parola che ci passi sopra.
    const [smin, smax] = lv.segreta;
    const vuote = () => g.reduce((n, v) => n + (v === null), 0);
    const bloccate = new Set(), obiettivo = smin + Math.floor(Math.random() * (smax - smin + 1));
    while (vuote() > obiettivo) {
      const libere = [];
      g.forEach((v, k) => { if (v === null && !bloccate.has(k)) libere.push(k); });
      if (!libere.length) break;
      const k = libere[Math.floor(Math.random() * libere.length)], r0 = Math.floor(k / N), c0 = k % N;
      let scelta = null, visti = 0;
      for (const [dr, dc] of E.mescola(lv.dir.slice())) {
        for (let L = Math.min(lv.max, N, 9); L >= lv.min && visti < 40; L--) for (let o = 0; o < L && visti < 40; o++) {
          const r = r0 - dr * o, c = c0 - dc * o;
          if (!dentro(N, r, c) || !dentro(N, r + dr * (L - 1), c + dc * (L - 1))) continue;
          const s = schema(r, c, dr, dc, L), nuove = s.filter(ch => !ch).length;
          const cand = compatibili(indice, s);
          for (let t = 0; t < 6 && cand.length; t++) {
            const v = cand[Math.floor(Math.random() * cand.length)];
            if (legata(v.r)) continue;
            visti++;
            const punti = nuove + Math.random();
            if (!scelta || punti > scelta.punti) scelta = { v, r, c, dr, dc, punti };
            break;
          }
        }
      }
      if (scelta) piazza(scelta.v, scelta.r, scelta.c, scelta.dr, scelta.dc);
      else bloccate.add(k);
    }

    // 3. Parola segreta con le lettere avanzate, poi controllo che ogni parola compaia una volta sola.
    const n = vuote();
    if (n < smin || n > smax) return null;
    const adatte = tutte.filter(v => v.r.length === n && !legata(v.r) && v.def[lv.defSegreta].length);
    const note = adatte.filter(v => v.noto <= lv.noto), segrete = note.length ? note : adatte;
    if (!segrete.length) return null;
    const s = segrete[Math.floor(Math.random() * segrete.length)];
    const celle = [];
    g.forEach((v, k) => { if (v === null) celle.push(k); });
    celle.forEach((k, i) => { g[k] = s.r[i]; });
    if (parole.some(p => occorrenze(g, N, p.r) !== 1)) return null;

    parole.sort((a, b) => lv.definizioni ? a.len - b.len || a.r.localeCompare(b.r) : a.testo.localeCompare(b.testo));
    parole.forEach((p, i) => {
      const alt = p.voce.def[1].length ? p.voce.def[1] : p.voce.def.find(d => d.length);
      p.def = alt[Math.floor(Math.random() * alt.length)];
      p.colore = i % 6;
      delete p.voce;
    });
    const altS = s.def[lv.defSegreta];
    return { lato: N, griglia: g.join(""), parole, definizioni: !!lv.definizioni,
      segreta: { r: s.r, testo: s.testo, def: altS[Math.floor(Math.random() * altS.length)], celle }, risolta: false };
  }

  function genera(materie, livello) {
    const lv = LIVELLI[livello - 1];
    const tutte = E.voci(materie).filter(v => v.def.some(d => d.length));
    const pool = tutte.filter(v => v.noto <= lv.noto && v.r.length >= lv.min && v.r.length <= Math.min(lv.max, lv.lato));
    if (pool.length < 40) return null;
    const indice = creaIndice(pool);
    const t0 = performance.now();
    for (let i = 0; i < 60 && (i < 3 || performance.now() - t0 < 2500); i++) {
      const p = tentativo(pool, indice, tutte, lv);
      if (p) return Object.assign(p, { livello: lv.n, materie: materie.slice(), secondi: 0, aiuti: 0, completato: false, arreso: false, creato: Date.now() });
    }
    return null;
  }

  /* ---------- Interfaccia ---------- */

  function monta(radice) {
    const pref = Object.assign({ materie: [], livello: 2 }, E.memoria.leggi("crucipuzzle:pref", {}));
    let S = E.memoria.leggi("crucipuzzle:corrente", null);
    let timer = null, celle = [], trascina = null, attesa = null, cursore = 0;
    const NS = "http://www.w3.org/2000/svg";
    const salvaPref = () => E.memoria.scrivi("crucipuzzle:pref", pref);

    /* Impostazioni */
    const chips = el("div", { class: "chips", role: "group", "aria-label": "Materie" });
    const contatore = el("span", { class: "contatore" });
    function disegnaChips() {
      chips.innerHTML = "";
      chips.append(el("button", { class: "chip" + (pref.materie.length ? "" : " on"), "aria-pressed": String(!pref.materie.length),
        onclick: () => { pref.materie = []; salvaPref(); disegnaChips(); } }, "Misto (tutte)"));
      for (const m of E.MATERIE) {
        const n = (E.archivio[m.id] || []).length;
        if (!n) continue;
        const on = pref.materie.includes(m.id);
        chips.append(el("button", { class: "chip" + (on ? " on" : ""), "aria-pressed": String(on),
          onclick: () => { pref.materie = on ? pref.materie.filter(x => x !== m.id) : pref.materie.concat(m.id); salvaPref(); disegnaChips(); } },
          el("span", { class: "segno-chip", "aria-hidden": "true" }, on ? "✓" : ""), m.nome, el("small", null, String(n))));
      }
      contatore.textContent = etichetta(pref.materie) + " · " + E.voci(pref.materie).length.toLocaleString("it-IT") + " parole";
    }
    const livelli = el("div", { class: "livelli", role: "radiogroup", "aria-label": "Livello" });
    function disegnaLivelli() {
      livelli.innerHTML = "";
      LIVELLI.forEach(l => livelli.append(el("button", { class: "livello" + (pref.livello === l.n ? " on" : ""), role: "radio", "aria-checked": String(pref.livello === l.n),
        onclick: () => { pref.livello = l.n; salvaPref(); disegnaLivelli(); } }, el("b", null, String(l.n)), el("span", null, l.nome))));
    }
    const btnNuovo = el("button", { class: "primario", onclick: nuovo }, "Nuovo crucipuzzle");
    const pannello = el("details", { class: "impostazioni", open: window.innerWidth > 900 && !(S && S.parole && !S.completato) },
      el("summary", null, "Materie e livello"), el("div", { class: "corpo-imp" },
        el("div", { class: "riga-imp" }, el("h3", null, "Materie"), contatore), chips,
        el("p", { class: "suggerimento" }, "Tocca una o più materie; senza scelta si gioca con tutte. Dal livello 2 le parole vanno anche in diagonale, dal 3 anche all'indietro; all'Esperto si cercano partendo dalle definizioni."),
        el("div", { class: "riga-imp" }, el("h3", null, "Livello")), livelli,
        el("div", { class: "azioni-imp" }, btnNuovo)));

    /* Area di gioco */
    const info = el("span", { class: "info-partita" }), tempo = el("span", { class: "tempo" });
    const grigliaDom = el("div", { class: "griglia-cp", tabindex: "0", role: "application", "aria-label": "Griglia: trascina da una lettera all'ultima della parola, oppure tocca la prima e poi l'ultima" });
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "tratti-cp"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("preserveAspectRatio", "none");
    const titoloElenco = el("h3"), elenco = el("ol", { class: "elenco-cp" });
    const defSegreta = el("p", { class: "def-segreta" });
    const campoSegreta = el("input", { type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": "Parola segreta",
      onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); provaSegreta(); } } });
    const btnSegreta = el("button", { class: "secondario", onclick: provaSegreta }, "Prova");
    const boxSegreta = el("div", { class: "segreta-cp" }, el("h3", null, "Parola segreta"), defSegreta, el("div", { class: "riga-segreta" }, campoSegreta, btnSegreta));
    const esito = el("div", { class: "esito", hidden: true });

    const conferma = (etichetta, testoConferma, azione) => {
      const b = el("button", { class: "secondario" }, etichetta);
      let armato = null;
      b.addEventListener("click", () => {
        if (armato) { clearTimeout(armato); armato = null; b.textContent = etichetta; b.classList.remove("pericolo"); azione(); return; }
        b.textContent = testoConferma; b.classList.add("pericolo");
        armato = setTimeout(() => { armato = null; b.textContent = etichetta; b.classList.remove("pericolo"); }, 3000);
      });
      return b;
    };
    const strumenti = el("div", { class: "strumenti" },
      el("button", { class: "secondario", onclick: suggerisci }, "Suggerisci"),
      conferma("Soluzione", "Confermi? Mostra tutto", arrenditi),
      conferma("Azzera", "Confermi? Ricomincia", azzera),
      E.puoStampare ? E.pdf.menuPdf(o => E.pdf.pdfCrucipuzzle(S, Object.assign(o, { sottotitolo: sottotitolo() }))) : null);

    radice.append(pannello, el("section", { class: "partita-cp" },
      el("div", { class: "colonna-griglia" },
        el("div", { class: "testata-partita" }, info, tempo),
        el("div", { class: "contenitore-cp" }, grigliaDom, svg), boxSegreta, esito, strumenti),
      el("div", { class: "colonna-elenco" }, titoloElenco, elenco)));
    disegnaChips(); disegnaLivelli();

    function etichetta(materie) { return materie.length ? materie.map(E.nomeMateria).join(", ") : "Misto"; }
    function sottotitolo() { const lv = LIVELLI[S.livello - 1]; return "Livello " + lv.n + " · " + lv.nome + " · " + etichetta(S.materie); }
    function salva() { if (S) { S.secondi = timer ? timer.secondi : S.secondi; E.memoria.scrivi("crucipuzzle:corrente", S); } }
    const fine = p => [p.r0 + p.dr * (p.len - 1), p.c0 + p.dc * (p.len - 1)];
    const celleDi = p => Array.from({ length: p.len }, (_, i) => (p.r0 + p.dr * i) * S.lato + p.c0 + p.dc * i);

    function nuovo() {
      btnNuovo.disabled = true; btnNuovo.textContent = "Sto nascondendo le parole…";
      setTimeout(() => {
        const p = genera(pref.materie, pref.livello);
        btnNuovo.disabled = false; btnNuovo.textContent = "Nuovo crucipuzzle";
        if (!p) { E.avviso("Non ci sono abbastanza parole adatte: aggiungi materie o cambia livello.", "errore"); return; }
        S = p; attesa = null; salva(); avvia();
        pannello.open = false;
      }, 30);
    }

    function avvia() {
      if (timer) timer.ferma();
      timer = E.cronometro(tempo, S.secondi, s => { if (s % 5 === 0) salva(); });
      info.textContent = sottotitolo();
      const N = S.lato;
      grigliaDom.parentNode.style.setProperty("--lato", N);
      elenco.classList.toggle("con-def", S.definizioni);
      svg.setAttribute("viewBox", "0 0 " + N + " " + N);
      grigliaDom.innerHTML = "";
      celle = S.griglia.split("").map(ch => { const n = el("div", { class: "cella-cp" }, ch); grigliaDom.append(n); return n; });
      defSegreta.textContent = S.segreta.def + " (" + S.segreta.r.length + " lettere" + (S.segreta.testo.includes(" ") ? ", " + S.segreta.testo.split(" ").length + " parole" : "") + ")";
      campoSegreta.value = "";
      disegna();
      if (S.completato) mostraEsito(); else { esito.hidden = true; timer.avvia(); }
    }

    function tratto(da, a, classe, colore) {
      const l = document.createElementNS(NS, "line");
      l.setAttribute("x1", da[1] + 0.5); l.setAttribute("y1", da[0] + 0.5);
      l.setAttribute("x2", a[1] + 0.5); l.setAttribute("y2", a[0] + 0.5);
      l.setAttribute("class", classe);
      if (colore != null) l.style.stroke = "var(--cp-" + (colore + 1) + ")";
      svg.append(l);
      return l;
    }

    function disegna() {
      svg.innerHTML = "";
      S.parole.filter(p => p.trovata).forEach(p => tratto([p.r0, p.c0], fine(p), "trovata", p.colore));
      if (trascina) tratto(trascina.da, trascina.a, "selezione");
      const tutte = S.parole.every(p => p.trovata);
      const coperte = new Set(S.parole.filter(p => p.trovata).flatMap(celleDi));
      celle.forEach((n, k) => {
        n.classList.toggle("coperta", tutte && coperte.has(k));
        n.classList.toggle("segreta", S.risolta && S.segreta.celle.includes(k));
        n.classList.toggle("inizio", !!attesa && attesa[0] * S.lato + attesa[1] === k);
        n.classList.toggle("cursore", k === cursore);
      });
      elenco.innerHTML = "";
      S.parole.forEach(p => elenco.append(el("li", { class: p.trovata ? "trovata" : "" },
        S.definizioni ? [el("span", null, p.def + " (" + p.len + ")"), p.trovata ? el("b", null, p.testo) : null] : el("span", null, p.testo))));
      titoloElenco.textContent = (S.definizioni ? "Definizioni" : "Parole da trovare") + " · " + S.parole.filter(p => p.trovata).length + "/" + S.parole.length;
      campoSegreta.disabled = btnSegreta.disabled = S.risolta || S.completato;
      if (S.risolta) campoSegreta.value = S.segreta.testo;
    }

    /* Selezione: trascinamento, oppure tocco sulla prima e sull'ultima lettera */
    function cellaDa(e) {
      const b = grigliaDom.getBoundingClientRect(), N = S.lato;
      const c = Math.floor((e.clientX - b.left) / b.width * N), r = Math.floor((e.clientY - b.top) / b.height * N);
      return [Math.max(0, Math.min(N - 1, r)), Math.max(0, Math.min(N - 1, c))];
    }
    // Riporta la fine della selezione sulla riga, colonna o diagonale più vicina.
    function allinea(da, p) {
      const dr = p[0] - da[0], dc = p[1] - da[1];
      if (!dr && !dc) return da;
      const ang = Math.round(Math.atan2(dr, dc) / (Math.PI / 4)) * Math.PI / 4;
      const ur = Math.round(Math.sin(ang)), uc = Math.round(Math.cos(ang));
      let L = Math.max(Math.abs(dr), Math.abs(dc));
      while (L > 0 && !dentro(S.lato, da[0] + ur * L, da[1] + uc * L)) L--;
      return [da[0] + ur * L, da[1] + uc * L];
    }
    const uguali = (a, b) => a[0] === b[0] && a[1] === b[1];

    grigliaDom.addEventListener("pointerdown", e => {
      if (!S || S.completato) return;
      e.preventDefault();
      grigliaDom.setPointerCapture(e.pointerId);
      const p = cellaDa(e);
      trascina = { da: p, a: p };
      disegna();
    });
    grigliaDom.addEventListener("pointermove", e => {
      if (!trascina) return;
      const a = allinea(trascina.da, cellaDa(e));
      if (!uguali(a, trascina.a)) { trascina.a = a; disegna(); }
    });
    grigliaDom.addEventListener("pointerup", () => {
      if (!trascina) return;
      const t = trascina;
      trascina = null;
      if (!uguali(t.da, t.a)) { attesa = null; prova(t.da, t.a); } else tocco(t.da);
    });
    grigliaDom.addEventListener("pointercancel", () => { trascina = null; disegna(); });
    grigliaDom.addEventListener("keydown", e => {
      if (!S || S.completato) return;
      const N = S.lato, mappa = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
      if (mappa[e.key]) {
        e.preventDefault();
        const r = Math.floor(cursore / N) + mappa[e.key][0], c = cursore % N + mappa[e.key][1];
        if (dentro(N, r, c)) { cursore = r * N + c; disegna(); }
      } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tocco([Math.floor(cursore / N), cursore % N]); }
      else if (e.key === "Escape") { attesa = null; disegna(); }
    });

    function tocco(p) {
      cursore = p[0] * S.lato + p[1];
      if (attesa && !uguali(attesa, p)) { const da = attesa; attesa = null; prova(da, allinea(da, p)); return; }
      attesa = attesa ? null : p;
      disegna();
    }

    function prova(da, a) {
      const p = S.parole.find(x => !x.trovata && (uguali(da, [x.r0, x.c0]) && uguali(a, fine(x)) || uguali(a, [x.r0, x.c0]) && uguali(da, fine(x))));
      if (p) {
        p.trovata = true;
        disegna(); salva();
        if (S.parole.every(x => x.trovata) && !S.risolta) E.avviso("Tutte trovate! Le lettere rimaste, lette in ordine, formano la parola segreta.", "ok");
        verificaFine();
        return;
      }
      disegna();
      const l = tratto(da, a, "selezione errata");
      setTimeout(() => l.remove(), 450);
    }

    function provaSegreta() {
      if (!S || S.risolta) return;
      const t = E.normalizza(campoSegreta.value).replace(/ /g, "");
      if (!t) return;
      if (t !== S.segreta.r) { E.avviso("Non è la parola segreta: riprova.", "errore"); campoSegreta.select(); return; }
      S.risolta = true;
      E.avviso("Parola segreta indovinata!", "ok");
      disegna(); salva(); verificaFine();
    }

    function suggerisci() {
      if (!S || S.completato) return;
      const restanti = S.parole.filter(p => !p.trovata);
      if (!restanti.length) {
        S.aiuti++;
        E.avviso("Inizia così: " + S.segreta.r.slice(0, Math.ceil(S.segreta.r.length / 3)) + "…", "ok");
        salva(); return;
      }
      const p = restanti[Math.floor(Math.random() * restanti.length)];
      attesa = [p.r0, p.c0]; cursore = p.r0 * S.lato + p.c0;
      S.aiuti++;
      E.avviso("Una parola comincia dalla lettera evidenziata.", "ok");
      disegna(); salva();
    }

    function arrenditi() {
      if (!S || S.completato) return;
      S.parole.forEach(p => { p.trovata = true; });
      S.risolta = true; S.arreso = true; attesa = null;
      disegna(); verificaFine();
    }

    function azzera() {
      S.parole.forEach(p => { p.trovata = false; });
      Object.assign(S, { risolta: false, arreso: false, completato: false, aiuti: 0, secondi: 0 });
      attesa = null; salva(); avvia();
    }

    function verificaFine() {
      if (S.completato || !S.risolta || !S.parole.every(p => p.trovata)) return;
      S.completato = true;
      timer.ferma();
      S.secondi = timer.secondi;
      if (!S.arreso) {
        const st = E.memoria.leggi("stat:crucipuzzle", {});
        const s = st[S.livello] || (st[S.livello] = { risolti: 0, migliore: null });
        s.risolti++;
        if (!S.aiuti && (s.migliore == null || S.secondi < s.migliore)) s.migliore = S.secondi;
        E.memoria.scrivi("stat:crucipuzzle", st);
      }
      salva(); disegna(); mostraEsito();
    }

    function mostraEsito() {
      esito.hidden = false;
      esito.innerHTML = "";
      esito.append(
        el("strong", null, S.arreso ? "Soluzione mostrata" : "Crucipuzzle risolto!"),
        el("span", null, S.arreso ? "La parola segreta era " + S.segreta.testo + "." :
          "Tempo " + timer.fmt(S.secondi) + " · " + (S.aiuti ? S.aiuti + (S.aiuti === 1 ? " aiuto" : " aiuti") : "senza aiuti")),
        el("button", { class: "primario", onclick: nuovo }, "Nuovo crucipuzzle"));
    }

    document.addEventListener("visibilitychange", salva);
    if (S && S.parole && S.parole.length) avvia(); else nuovo();
    return { smonta() { if (timer) timer.ferma(); salva(); document.removeEventListener("visibilitychange", salva); } };
  }

  E.registraGioco({
    id: "crucipuzzle",
    nome: "Crucipuzzle",
    descrizione: "Parole nascoste nella griglia, per materia: con le lettere che avanzano si scopre la parola segreta.",
    livelli: LIVELLI,
    monta
  });
  E._crucipuzzle = { genera, occorrenze, LIVELLI };
})();
