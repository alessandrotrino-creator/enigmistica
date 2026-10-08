/* Nonogrammi: si anneriscono le caselle seguendo i numeri di righe e colonne; alla fine compare un disegno.
   Disegni da data/nonogrammi/ oppure griglie astratte generate. Tutte risolvibili con la sola logica,
   riga per riga: dove non basta si aggiunge qualche casella già data. */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  // lati: dimensioni ammesse per i disegni; astratto: [righe, colonne] delle griglie generate;
  // liscio: forme compatte (più facili) invece di rumore.
  const LIVELLI = [
    { n: 1, nome: "Principiante", lati: [4, 6],   astratto: [5, 5],   liscio: true },
    { n: 2, nome: "Facile",       lati: [7, 10],  astratto: [8, 8],   liscio: true },
    { n: 3, nome: "Medio",        lati: [10, 12], astratto: [10, 10], liscio: true },
    { n: 4, nome: "Difficile",    lati: [13, 16], astratto: [15, 15], liscio: false },
    { n: 5, nome: "Esperto",      lati: [17, 25], astratto: [20, 20], liscio: false }
  ];
  const TIPI = [{ id: "disegni", nome: "Disegni" }, { id: "astratti", nome: "Astratti" }, { id: "misti", nome: "Misti" }];

  /* ---------- Risolutore ---------- */

  const indizi = linea => { const out = []; let n = 0; for (const v of linea) { if (v) n++; else if (n) { out.push(n); n = 0; } } if (n) out.push(n); return out; };

  // Una riga: -1 sconosciuta, 0 vuota, 1 piena. Restituisce la riga dedotta o null se impossibile.
  function deduciRiga(riga, ind) {
    const n = riga.length, k = ind.length, memo = new Map();
    function ok(i, j) {
      if (j === k) { for (let x = i; x < n; x++) if (riga[x] === 1) return false; return true; }
      if (i >= n) return false;
      const chiave = i * (k + 1) + j;
      if (memo.has(chiave)) return memo.get(chiave);
      let r = riga[i] !== 1 && ok(i + 1, j);
      if (!r && blocco(i, j)) r = ok(Math.min(n, i + ind[j] + 1), j + 1);
      memo.set(chiave, r);
      return r;
    }
    function blocco(i, j) {
      const L = ind[j];
      if (i + L > n) return false;
      for (let x = i; x < i + L; x++) if (riga[x] === 0) return false;
      return i + L === n || riga[i + L] !== 1;
    }
    if (!ok(0, 0)) return null;
    const puo0 = new Array(n).fill(false), puo1 = new Array(n).fill(false), visti = new Set();
    (function segna(i, j) {
      const chiave = i * (k + 1) + j;
      if (visti.has(chiave)) return;
      visti.add(chiave);
      if (j === k) { for (let x = i; x < n; x++) puo0[x] = true; return; }
      if (i >= n) return;
      if (riga[i] !== 1 && ok(i + 1, j)) { puo0[i] = true; segna(i + 1, j); }
      if (blocco(i, j)) {
        const dopo = Math.min(n, i + ind[j] + 1);
        if (ok(dopo, j + 1)) {
          for (let x = i; x < i + ind[j]; x++) puo1[x] = true;
          if (i + ind[j] < n) puo0[i + ind[j]] = true;
          segna(dopo, j + 1);
        }
      }
    })(0, 0);
    return riga.map((v, x) => (puo0[x] && puo1[x] ? -1 : puo1[x] ? 1 : 0));
  }

  // Deduce riga per riga e colonna per colonna finché si può. g: array R*C di -1/0/1.
  function deduci(g, R, C, ir, ic) {
    g = g.slice();
    for (let cambiato = true; cambiato;) {
      cambiato = false;
      for (let r = 0; r < R; r++) {
        const riga = g.slice(r * C, r * C + C), d = deduciRiga(riga, ir[r]);
        if (!d) return null;
        d.forEach((v, c) => { if (v !== riga[c]) { g[r * C + c] = v; cambiato = true; } });
      }
      for (let c = 0; c < C; c++) {
        const col = Array.from({ length: R }, (_, r) => g[r * C + c]), d = deduciRiga(col, ic[c]);
        if (!d) return null;
        d.forEach((v, r) => { if (v !== col[r]) { g[r * C + c] = v; cambiato = true; } });
      }
    }
    return g;
  }

  // Caselle date necessarie perché la sola logica arrivi in fondo (vuoto se non serve nulla).
  function caselleDate(sol, R, C) {
    const ir = intervallo(R).map(r => indizi(sol.slice(r * C, r * C + C)));
    const ic = intervallo(C).map(c => indizi(intervallo(R).map(r => sol[r * C + c])));
    const date = [];
    for (;;) {
      const g = new Array(R * C).fill(-1);
      date.forEach(k => { g[k] = sol[k]; });
      const d = deduci(g, R, C, ir, ic);
      const ignote = d ? intervallo(R * C).filter(k => d[k] === -1) : [];
      if (!ignote.length) return date;
      // Si svela preferibilmente una casella piena.
      const piene = ignote.filter(k => sol[k]);
      date.push((piene.length ? piene : ignote)[Math.floor(Math.random() * (piene.length || ignote.length))]);
    }
  }
  function intervallo(n) { return Array.from({ length: n }, (_, i) => i); }

  /* ---------- Generatori ---------- */

  // Griglia astratta: rumore casuale (ammorbidito nei livelli facili), a volte simmetrico;
  // si tiene quella con meno caselle date.
  function astratto(R, C, liscio) {
    let migliore = null;
    const t0 = performance.now();
    for (let t = 0; t < 40 && (t < 5 || performance.now() - t0 < 1200); t++) {
      let g = intervallo(R * C).map(() => (Math.random() < (liscio ? 0.55 : 0.52) ? 1 : 0));
      const specchio = Math.random() < 0.5;
      if (specchio) g = g.map((v, k) => g[Math.floor(k / C) * C + Math.min(k % C, C - 1 - k % C)]);
      // Una passata di "maggioranza" fra i vicini per avere forme compatte.
      if (liscio) g = g.map((v, k) => {
        const r = Math.floor(k / C), c = k % C;
        let n = 0, tot = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < R && cc < C) { tot++; n += g[rr * C + cc]; }
        }
        return n * 2 > tot ? 1 : n * 2 < tot ? 0 : v;
      });
      const piene = g.filter(Boolean).length;
      if (piene < R * C * 0.4 || piene > R * C * (liscio ? 0.7 : 0.62)) continue;
      const date = caselleDate(g, R, C);
      if (!migliore || date.length < migliore.date.length) migliore = { sol: g, date };
      if (!date.length) break;
    }
    return migliore;
  }

  function genera(livello, tipo) {
    const lv = LIVELLI[livello - 1];
    const disegni = E.disegniNonogrammi.filter(d => {
      const R = d.righe.length, C = d.righe[0].length;
      return Math.max(R, C) >= lv.lati[0] && Math.max(R, C) <= lv.lati[1] && d.righe.every(r => r.length === C && /^[#.]+$/.test(r));
    });
    const usaDisegno = disegni.length && (tipo === "disegni" || (tipo === "misti" && Math.random() < 0.6));
    if (usaDisegno) {
      // Lo stesso soggetto può esistere in più misure: si ricorda titolo e dimensione.
      const chiave = d => d.titolo + " " + d.righe[0].length + "x" + d.righe.length;
      const visti = new Set(E.memoria.leggi("nonogrammi:visti", []));
      const nuovi = disegni.filter(d => !visti.has(chiave(d))), d = (nuovi.length ? nuovi : disegni)[Math.floor(Math.random() * (nuovi.length || disegni.length))];
      E.memoria.scrivi("nonogrammi:visti", [...visti].concat(chiave(d)).slice(-200));
      const R = d.righe.length, C = d.righe[0].length, sol = d.righe.join("").split("").map(ch => (ch === "#" ? 1 : 0));
      return nuovaPartita(livello, d.titolo, R, C, sol, caselleDate(sol, R, C));
    }
    const [R, C] = lv.astratto, a = astratto(R, C, lv.liscio);
    return a && nuovaPartita(livello, null, R, C, a.sol, a.date);
  }
  function nuovaPartita(livello, titolo, R, C, sol, date) {
    const celle = new Array(R * C).fill(0);
    date.forEach(k => { celle[k] = sol[k] ? 1 : 2; });
    return { livello, titolo, righe: R, colonne: C, soluzione: sol, date, celle, aiuti: 0, errori: 0, secondi: 0, completato: false, arreso: false };
  }

  /* ---------- Interfaccia ---------- */

  function monta(radice) {
    const pref = Object.assign({ livello: 2, tipo: "misti", evidenziaErrori: false }, E.memoria.leggi("nonogrammi:pref", {}));
    let S = E.memoria.leggi("nonogrammi:corrente", null), timer = null, celleDom = [], indR = [], indC = [], strumento = "pieno", tratto = null;
    const salvaPref = () => E.memoria.scrivi("nonogrammi:pref", pref);

    const livelli = el("div", { class: "livelli", role: "radiogroup", "aria-label": "Livello" });
    function disegnaLivelli() {
      livelli.innerHTML = "";
      LIVELLI.forEach(l => livelli.append(el("button", { class: "livello" + (pref.livello === l.n ? " on" : ""), role: "radio", "aria-checked": String(pref.livello === l.n),
        onclick: () => { pref.livello = l.n; salvaPref(); disegnaLivelli(); } }, el("b", null, String(l.n)), el("span", null, l.nome + " · fino a " + l.lati[1] + "×" + l.lati[1]))));
    }
    const tipi = el("div", { class: "chips", role: "radiogroup", "aria-label": "Tipo" });
    function disegnaTipi() {
      tipi.innerHTML = "";
      TIPI.forEach(t => tipi.append(el("button", { class: "chip" + (pref.tipo === t.id ? " on" : ""), role: "radio", "aria-checked": String(pref.tipo === t.id),
        onclick: () => { pref.tipo = t.id; salvaPref(); disegnaTipi(); } }, t.nome)));
    }
    const cbErr = el("input", { type: "checkbox", id: "ng-errori", checked: pref.evidenziaErrori, onchange: e => { pref.evidenziaErrori = e.target.checked; salvaPref(); disegna(); } });
    const btnNuovo = el("button", { class: "primario", onclick: nuovo }, "Nuovo nonogramma");
    const pannello = el("details", { class: "impostazioni", open: window.innerWidth > 900 && !(S && S.soluzione && !S.completato) },
      el("summary", null, "Livello, tipo e regole"), el("div", { class: "corpo-imp" },
        el("p", { class: "suggerimento" }, "I numeri a sinistra di ogni riga e sopra ogni colonna dicono quante caselle consecutive annerire, nell'ordine, con almeno una casella vuota fra un gruppo e l'altro. Segna con una croce le caselle che sei sicuro restino vuote. Tieni premuto e trascina per segnarne molte insieme; tasto destro per la croce."),
        el("div", { class: "riga-imp" }, el("h3", null, "Tipo")), tipi,
        el("div", { class: "riga-imp" }, el("h3", null, "Livello")), livelli,
        el("label", { class: "opzione", for: "ng-errori" }, cbErr, " Segnala subito le caselle sbagliate"),
        el("div", { class: "azioni-imp" }, btnNuovo)));

    const info = el("span", { class: "info-partita" }), tempo = el("span", { class: "tempo" });
    const griglia = el("div", { class: "griglia-ng", role: "grid", "aria-label": "Nonogramma" });
    const esito = el("div", { class: "esito", hidden: true });
    const btnPieno = el("button", { class: "secondario on", "aria-pressed": "true", onclick: () => scegliStrumento("pieno") }, "■ Annerisci");
    const btnCroce = el("button", { class: "secondario", "aria-pressed": "false", onclick: () => scegliStrumento("croce") }, "✕ Croce");
    function scegliStrumento(s) {
      strumento = s;
      btnPieno.classList.toggle("on", s === "pieno"); btnPieno.setAttribute("aria-pressed", String(s === "pieno"));
      btnCroce.classList.toggle("on", s === "croce"); btnCroce.setAttribute("aria-pressed", String(s === "croce"));
    }
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
      el("span", { class: "zoom", role: "group", "aria-label": "Strumento" }, btnPieno, btnCroce),
      el("button", { class: "secondario", onclick: controlla }, "Controlla"),
      el("button", { class: "secondario", onclick: suggerisci }, "Suggerimento"),
      conferma("Soluzione", "Confermi? Mostra tutto", arrenditi),
      conferma("Azzera", "Confermi? Ricomincia", azzera),
      E.puoStampare ? E.pdf.menuPdf(o => E.pdf.pdfNonogramma(S, Object.assign(o, { sottotitolo: sottotitolo() }))) : null);
    radice.append(pannello, el("section", { class: "partita-ng" }, el("div", { class: "testata-partita" }, info, tempo),
      el("div", { class: "contenitore-ng" }, griglia), esito, strumenti));
    disegnaLivelli(); disegnaTipi();

    const salva = () => { if (S) { S.secondi = timer ? timer.secondi : S.secondi; E.memoria.scrivi("nonogrammi:corrente", S); } };
    function sottotitolo() { const lv = LIVELLI[S.livello - 1]; return "Livello " + lv.n + " · " + lv.nome + " · " + S.righe + "×" + S.colonne + (S.titolo ? " · disegno" : " · astratto"); }

    function nuovo() {
      btnNuovo.disabled = true; btnNuovo.textContent = "Sto preparando la griglia…";
      setTimeout(() => {
        const p = genera(pref.livello, pref.tipo);
        btnNuovo.disabled = false; btnNuovo.textContent = "Nuovo nonogramma";
        if (!p) { E.avviso("Non sono riuscito a preparare la griglia: riprova.", "errore"); return; }
        S = p; salva(); avvia();
        pannello.open = false;
      }, 30);
    }

    function avvia() {
      if (timer) timer.ferma();
      timer = E.cronometro(tempo, S.secondi, s => { if (s % 5 === 0) salva(); });
      info.textContent = sottotitolo();
      esito.hidden = true;
      const R = S.righe, C = S.colonne;
      const ir = intervallo(R).map(r => indizi(S.soluzione.slice(r * C, r * C + C)));
      const ic = intervallo(C).map(c => indizi(intervallo(R).map(r => S.soluzione[r * C + c])));
      // Dimensione delle caselle: tutto deve stare nella larghezza disponibile.
      const largInd = Math.max(1, ...ir.map(x => x.length)), altInd = Math.max(1, ...ic.map(x => x.length));
      const spazio = Math.min(griglia.parentNode.clientWidth || 700, 760);
      const cella = Math.max(13, Math.min(36, Math.floor(spazio / (C + largInd * 0.62 + 0.5))));
      griglia.style.setProperty("--cella", cella + "px");
      griglia.style.gridTemplateColumns = "auto repeat(" + C + ", var(--cella))";
      griglia.style.gridTemplateRows = "auto repeat(" + R + ", var(--cella))";
      griglia.innerHTML = ""; celleDom = []; indR = []; indC = [];
      griglia.classList.remove("finito");
      griglia.append(el("span", { class: "angolo-ng" }, S.titolo && S.completato ? S.titolo : ""));
      ic.forEach((x, c) => { const n = el("span", { class: "ind-col" + (c % 5 === 4 && c < C - 1 ? " d5" : "") }, (x.length ? x : [0]).map(v => el("b", null, String(v)))); n.style.minHeight = altInd * 1.15 + "em"; indC.push(n); griglia.append(n); });
      for (let r = 0; r < R; r++) {
        const n = el("span", { class: "ind-riga" + (r % 5 === 4 && r < R - 1 ? " b5" : "") }, (ir[r].length ? ir[r] : [0]).map(v => el("b", null, String(v))));
        indR.push(n); griglia.append(n);
        for (let c = 0; c < C; c++) {
          const k = r * C + c, d = el("span", { class: "cella-ng" + (c % 5 === 4 || c === C - 1 ? " d5" : "") + (r % 5 === 4 || r === R - 1 ? " b5" : "") + (r === 0 ? " r0" : ""), "data-k": k });
          celleDom.push(d); griglia.append(d);
        }
      }
      S._ir = ir; S._ic = ic;
      disegna();
      if (S.completato) mostraEsito(); else timer.avvia();
    }

    function disegna() {
      if (!S || !celleDom.length) return;
      const R = S.righe, C = S.colonne, date = new Set(S.date);
      celleDom.forEach((d, k) => {
        const v = S.celle[k];
        d.classList.toggle("piena", v === 1);
        d.classList.toggle("croce", v === 2);
        d.classList.toggle("data", date.has(k));
        d.classList.toggle("errata", pref.evidenziaErrori && !date.has(k) && ((v === 1 && !S.soluzione[k]) || (v === 2 && S.soluzione[k])));
      });
      const uguali = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
      for (let r = 0; r < R; r++) indR[r].classList.toggle("fatta", uguali(indizi(S.celle.slice(r * C, r * C + C).map(v => v === 1 ? 1 : 0)), S._ir[r]));
      for (let c = 0; c < C; c++) indC[c].classList.toggle("fatta", uguali(indizi(intervallo(R).map(r => S.celle[r * C + c] === 1 ? 1 : 0)), S._ic[c]));
    }

    /* Tratti: il primo tocco decide che cosa scrivere, poi lo si applica lungo la riga o la colonna. */
    const kDa = e => { const t = e.target.closest(".cella-ng"); return t ? +t.dataset.k : null; };
    function applica(k, valore) {
      if (S.date.includes(k) || S.celle[k] === valore) return;
      S.celle[k] = valore;
      if (valore === 1 && !S.soluzione[k]) S.errori++;
    }
    griglia.addEventListener("contextmenu", e => { if (e.target.closest(".cella-ng")) e.preventDefault(); });
    griglia.addEventListener("pointerdown", e => {
      const k = kDa(e);
      if (k == null || !S || S.completato) return;
      e.preventDefault();
      griglia.setPointerCapture(e.pointerId);
      const tipo = e.button === 2 ? "croce" : strumento, attuale = S.celle[k];
      const valore = tipo === "pieno" ? (attuale === 1 ? 0 : 1) : (attuale === 2 ? 0 : 2);
      tratto = { da: k, valore, asse: null };
      applica(k, valore); disegna();
    });
    griglia.addEventListener("pointermove", e => {
      if (!tratto) return;
      const t = document.elementFromPoint(e.clientX, e.clientY), cella = t && t.closest(".cella-ng");
      if (!cella) return;
      const C = S.colonne, k = +cella.dataset.k, r0 = Math.floor(tratto.da / C), c0 = tratto.da % C, r = Math.floor(k / C), c = k % C;
      if (!tratto.asse && k !== tratto.da) tratto.asse = r === r0 ? "riga" : c === c0 ? "colonna" : null;
      if (!tratto.asse) return;
      // Si riempie tutto il tratto dall'inizio alla posizione attuale, lungo l'asse scelto.
      if (tratto.asse === "riga") for (let x = Math.min(c0, c); x <= Math.max(c0, c); x++) applica(r0 * C + x, tratto.valore);
      else for (let y = Math.min(r0, r); y <= Math.max(r0, r); y++) applica(y * C + c0, tratto.valore);
      disegna();
    });
    const fineTratto = () => { if (!tratto) return; tratto = null; salva(); verificaFine(); };
    griglia.addEventListener("pointerup", fineTratto);
    griglia.addEventListener("pointercancel", fineTratto);

    function controlla() {
      const date = new Set(S.date);
      const sbagliate = intervallo(S.celle.length).filter(k => !date.has(k) && ((S.celle[k] === 1 && !S.soluzione[k]) || (S.celle[k] === 2 && S.soluzione[k])));
      S.aiuti++; salva();
      if (sbagliate.length) {
        sbagliate.forEach(k => celleDom[k].classList.add("errata"));
        E.avviso(sbagliate.length + (sbagliate.length === 1 ? " casella sbagliata" : " caselle sbagliate") + " (in rosso)", "errore");
      } else E.avviso("Finora nessun errore", "ok");
    }

    // Suggerisce una casella che si deduce da ciò che è già giusto; altrimenti ne svela una piena mancante.
    function suggerisci() {
      if (S.completato) return;
      const R = S.righe, C = S.colonne;
      const noto = S.celle.map((v, k) => (v === 1 && S.soluzione[k] ? 1 : v === 2 && !S.soluzione[k] ? 0 : -1));
      const d = deduci(noto, R, C, S._ir, S._ic) || noto;
      const nuove = intervallo(R * C).filter(k => noto[k] === -1 && d[k] !== -1);
      const candidate = nuove.length ? nuove : intervallo(R * C).filter(k => S.soluzione[k] && S.celle[k] !== 1);
      if (!candidate.length) return;
      const k = candidate[Math.floor(Math.random() * candidate.length)];
      S.celle[k] = S.soluzione[k] ? 1 : 2; S.aiuti++;
      disegna(); salva();
      celleDom[k].classList.add("lampo"); setTimeout(() => celleDom[k] && celleDom[k].classList.remove("lampo"), 1200);
      E.avviso("Riga " + (Math.floor(k / C) + 1) + ", colonna " + (k % C + 1) + (nuove.length ? ": si deduce dai numeri" : ""), "ok");
      verificaFine();
    }

    function arrenditi() { S.celle = S.soluzione.map(v => (v ? 1 : 2)); S.arreso = true; disegna(); verificaFine(); salva(); }
    function azzera() {
      const p = nuovaPartita(S.livello, S.titolo, S.righe, S.colonne, S.soluzione, S.date);
      S = p; salva(); avvia();
    }

    function verificaFine() {
      if (S.completato || !S.celle.every((v, k) => (v === 1) === !!S.soluzione[k])) return;
      S.completato = true; timer.ferma(); S.secondi = timer.secondi;
      if (!S.arreso) {
        const st = E.memoria.leggi("stat:nonogrammi", {});
        const s = st[S.livello] || (st[S.livello] = { risolti: 0, migliore: null });
        s.risolti++;
        if (!S.aiuti && (s.migliore == null || S.secondi < s.migliore)) s.migliore = S.secondi;
        E.memoria.scrivi("stat:nonogrammi", st);
      }
      salva(); mostraEsito();
    }

    function mostraEsito() {
      griglia.classList.add("finito");
      griglia.querySelector(".angolo-ng").textContent = S.titolo || "";
      esito.hidden = false; esito.innerHTML = "";
      esito.append(
        el("strong", null, S.arreso ? "Soluzione mostrata" : S.titolo ? "Hai disegnato: " + S.titolo + "!" : "Nonogramma risolto!"),
        el("span", null, S.arreso ? (S.titolo ? "Era: " + S.titolo + "." : "Prova con una nuova griglia.") :
          "Tempo " + timer.fmt(S.secondi) + " · " + (S.aiuti ? S.aiuti + (S.aiuti === 1 ? " aiuto" : " aiuti") : "senza aiuti")),
        el("button", { class: "primario", onclick: nuovo }, "Nuovo nonogramma"));
    }

    document.addEventListener("visibilitychange", salva);
    if (S && S.soluzione) avvia(); else nuovo();
    return { smonta() { if (timer) timer.ferma(); salva(); document.removeEventListener("visibilitychange", salva); } };
  }

  E.registraGioco({
    id: "nonogrammi",
    nome: "Nonogrammi",
    descrizione: "Annerisci le caselle seguendo i numeri: alla fine compare un disegno. Anche griglie astratte, infinite.",
    livelli: LIVELLI,
    monta
  });
  E._nonogrammi = { genera, deduci, deduciRiga, caselleDate, indizi, LIVELLI };
})();
