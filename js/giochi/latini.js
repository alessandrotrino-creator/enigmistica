/* Futoshiki e Calcudoku: quadrati latini N×N (ogni numero una volta per riga e colonna) con segni
   di disuguaglianza o gabbie aritmetiche. Stesso risolutore, stessa interfaccia, soluzione sempre unica. */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  // Futoshiki — segni: frazione delle coppie vicine con un segno; extra: numeri dati oltre al minimo necessario.
  const LIV_FT = [
    { n: 1, nome: "Principiante", lato: 4, segni: 0.5,  extra: 3 },
    { n: 2, nome: "Facile",       lato: 5, segni: 0.45, extra: 3 },
    { n: 3, nome: "Medio",        lato: 5, segni: 0.35, extra: 0 },
    { n: 4, nome: "Difficile",    lato: 6, segni: 0.35, extra: 0 },
    { n: 5, nome: "Esperto",      lato: 7, segni: 0.3,  extra: 0 }
  ];
  // Calcudoku — op: operazioni ammesse; gabbia: celle massime per gabbia; singole: probabilità di una casella isolata.
  const LIV_CD = [
    { n: 1, nome: "Principiante", lato: 4, op: "+",    gabbia: 3, singole: 0.15 },
    { n: 2, nome: "Facile",       lato: 4, op: "+−",   gabbia: 3, singole: 0.1 },
    { n: 3, nome: "Medio",        lato: 5, op: "+−×",  gabbia: 3, singole: 0.06 },
    { n: 4, nome: "Difficile",    lato: 6, op: "+−×÷", gabbia: 4, singole: 0.04 },
    { n: 5, nome: "Esperto",      lato: 7, op: "+−×÷", gabbia: 4, singole: 0.02 }
  ];

  const bit = d => 1 << (d - 1);
  const conta = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
  const scegli = a => a[Math.floor(Math.random() * a.length)];
  const intervallo = n => Array.from({ length: n }, (_, i) => i);

  /* ---------- Risolutore ---------- */

  function latino(N) {
    const g = new Array(N * N).fill(0);
    (function riempi(i) {
      if (i === N * N) return true;
      const r = Math.floor(i / N), c = i % N;
      for (const d of E.mescola(intervallo(N).map(k => k + 1))) {
        let ok = true;
        for (let k = 0; k < N && ok; k++) if (g[r * N + k] === d || g[k * N + c] === d) ok = false;
        if (ok) { g[i] = d; if (riempi(i + 1)) return true; }
      }
      g[i] = 0;
      return false;
    })(0);
    return g;
  }

  // Vincoli in forma comoda per il risolutore: segni per casella, gabbia di ogni casella.
  function prepara(S) {
    const P = { N: S.lato };
    if (S.segni) {
      P.segniDi = intervallo(S.lato * S.lato).map(() => []);
      S.segni.forEach(s => { P.segniDi[s.a].push({ j: s.b, minore: true }); P.segniDi[s.b].push({ j: s.a, minore: false }); });
    }
    if (S.gabbie) {
      P.gabbie = S.gabbie; P.gabbiaDi = [];
      S.gabbie.forEach((q, k) => q.celle.forEach(i => { P.gabbiaDi[i] = k; }));
    }
    return P;
  }

  // La gabbia può ancora tornare mettendo d nella casella i?
  function possibile(q, g, i, d, N) {
    const vals = [d];
    let vuote = 0;
    for (const k of q.celle) if (k !== i) { if (g[k]) vals.push(g[k]); else vuote++; }
    const t = q.t;
    if (q.op === "") return d === t;
    if (q.op === "+") { const s = vals.reduce((a, b) => a + b, 0); return vuote ? s + vuote <= t && s + vuote * N >= t : s === t; }
    if (q.op === "×") { const p = vals.reduce((a, b) => a * b, 1); return vuote ? t % p === 0 && p * Math.pow(N, vuote) >= t : p === t; }
    if (q.op === "−") return vuote ? d + t <= N || d - t >= 1 : Math.abs(vals[0] - vals[1]) === t;
    if (q.op === "÷") return vuote ? d * t <= N || d % t === 0 : Math.max(vals[0], vals[1]) === t * Math.min(vals[0], vals[1]);
    return true;
  }

  function candidati(P, g, i) {
    const N = P.N, r = Math.floor(i / N), c = i % N;
    let m = (1 << N) - 1;
    for (let k = 0; k < N; k++) {
      const a = g[r * N + k], b = g[k * N + c];
      if (a && r * N + k !== i) m &= ~bit(a);
      if (b && k * N + c !== i) m &= ~bit(b);
    }
    // Segni: se il vicino è già scritto si confronta con lui, altrimenti si escludono solo gli estremi.
    if (P.segniDi) for (const s of P.segniDi[i]) {
      const v = g[s.j];
      for (let d = 1; d <= N; d++) if ((m & bit(d)) && (s.minore ? (v ? d >= v : d === N) : (v ? d <= v : d === 1))) m &= ~bit(d);
    }
    if (P.gabbie) {
      const q = P.gabbie[P.gabbiaDi[i]];
      for (let d = 1; d <= N; d++) if ((m & bit(d)) && !possibile(q, g, i, d, N)) m &= ~bit(d);
    }
    return m;
  }

  // Fino a "limite" soluzioni, con backtracking sulla casella più vincolata.
  function risolvi(P, g0, limite) {
    const g = g0.slice(), trovate = [];
    (function cerca() {
      let best = -1, bm = 0, bc = 99;
      for (let i = 0; i < g.length; i++) {
        if (g[i]) continue;
        const m = candidati(P, g, i), c = conta(m);
        if (!c) return;
        if (c < bc) { bc = c; best = i; bm = m; if (c === 1) break; }
      }
      if (best < 0) { trovate.push(g.slice()); return; }
      for (let d = 1; d <= P.N && trovate.length < limite; d++) if (bm & bit(d)) { g[best] = d; cerca(); }
      g[best] = 0;
    })();
    return trovate;
  }
  const diverse = (a, b) => intervallo(a.length).filter(i => a[i] !== b[i]);

  /* ---------- Generatori ---------- */

  function generaFutoshiki(lv) {
    const N = lv.lato, sol = latino(N), coppie = [];
    for (let i = 0; i < N * N; i++) {
      if (i % N < N - 1) coppie.push([i, i + 1]);
      if (i + N < N * N) coppie.push([i, i + N]);
    }
    const segni = E.mescola(coppie).slice(0, Math.round(coppie.length * lv.segni)).map(([a, b]) => sol[a] < sol[b] ? { a, b } : { a: b, b: a });
    const S = { tipo: "futoshiki", lato: N, segni, soluzione: sol };
    const P = prepara(S), date = new Array(N * N).fill(0);
    // Numeri dati dove due soluzioni differiscono, finché la soluzione è unica; poi via quelli superflui.
    for (let t = risolvi(P, date, 2); t.length > 1; t = risolvi(P, date, 2)) { const i = scegli(diverse(t[0], t[1])); date[i] = sol[i]; }
    for (const i of E.mescola(intervallo(N * N).filter(i => date[i]))) {
      date[i] = 0;
      if (risolvi(P, date, 2).length !== 1) date[i] = sol[i];
    }
    E.mescola(intervallo(N * N).filter(i => !date[i])).slice(0, lv.extra).forEach(i => { date[i] = sol[i]; });
    return Object.assign(S, { date });
  }

  function operazione(q, sol, lv) {
    const v = q.celle.map(i => sol[i]);
    if (v.length === 1) { q.op = ""; q.t = v[0]; return; }
    const ops = [], a = Math.max(...v), b = Math.min(...v);
    if (lv.op.includes("+")) ops.push("+");
    if (lv.op.includes("×")) ops.push("×");
    if (v.length === 2 && lv.op.includes("−")) ops.push("−", "−");
    if (v.length === 2 && lv.op.includes("÷") && a % b === 0 && b > 1) ops.push("÷", "÷", "÷");
    q.op = scegli(ops);
    q.t = q.op === "+" ? v.reduce((x, y) => x + y, 0) : q.op === "×" ? v.reduce((x, y) => x * y, 1) : q.op === "−" ? a - b : a / b;
  }

  function generaCalcudoku(lv) {
    const N = lv.lato;
    const vicini = i => [i - N, i + N, i % N ? i - 1 : -1, i % N < N - 1 ? i + 1 : -1].filter(k => k >= 0 && k < N * N);
    const collegata = celle => {
      const visti = new Set([celle[0]]), coda = [celle[0]];
      while (coda.length) for (const k of vicini(coda.pop())) if (celle.includes(k) && !visti.has(k)) { visti.add(k); coda.push(k); }
      return visti.size === celle.length;
    };
    for (let tent = 0; tent < 40; tent++) {
      const sol = latino(N), gabbiaDi = new Array(N * N).fill(-1), gabbie = [];
      for (const i of E.mescola(intervallo(N * N))) {
        if (gabbiaDi[i] >= 0) continue;
        const celle = [i], dim = Math.random() < lv.singole ? 1 : 2 + Math.floor(Math.random() * (lv.gabbia - 1));
        gabbiaDi[i] = gabbie.length;
        while (celle.length < dim) {
          const liberi = celle.flatMap(vicini).filter(k => gabbiaDi[k] < 0);
          if (!liberi.length) break;
          const k = scegli(liberi);
          gabbiaDi[k] = gabbie.length; celle.push(k);
        }
        gabbie.push({ celle });
      }
      gabbie.forEach(q => operazione(q, sol, lv));
      const S = { tipo: "calcudoku", lato: N, gabbie, soluzione: sol, date: new Array(N * N).fill(0) };
      // Se le soluzioni sono più d'una, una casella ambigua diventa una gabbia da sola (un numero dato).
      for (let giro = 0; giro < N * 2; giro++) {
        const t = risolvi(prepara(S), S.date, 2);
        if (t.length === 1) {
          gabbie.forEach(q => q.celle.sort((x, y) => x - y));
          return S;
        }
        if (!t.length) break;
        const scelta = E.mescola(diverse(t[0], t[1])).find(i => {
          const q = gabbie.find(x => x.celle.includes(i));
          return q.celle.length > 1 && collegata(q.celle.filter(k => k !== i));
        });
        if (scelta == null) break;
        const q = gabbie.find(x => x.celle.includes(scelta));
        q.celle = q.celle.filter(k => k !== scelta);
        operazione(q, sol, lv);
        gabbie.push({ celle: [scelta], op: "", t: sol[scelta] });
      }
    }
    return null;
  }

  function genera(tipo, livello) {
    const lv = (tipo === "futoshiki" ? LIV_FT : LIV_CD)[livello - 1];
    // Fra alcune griglie si tiene quella con meno numeri dati (caselle isolate, nel Calcudoku).
    const dati = S => tipo === "futoshiki" ? S.date.filter(Boolean).length : S.gabbie.filter(q => !q.op).length;
    let S = null;
    const t0 = performance.now();
    for (let k = 0; k < 8 && (k < 2 || performance.now() - t0 < 700); k++) {
      const p = tipo === "futoshiki" ? generaFutoshiki(lv) : generaCalcudoku(lv);
      if (p && (!S || dati(p) < dati(S))) S = p;
    }
    if (!S) return null;
    return Object.assign(S, { livello, valori: S.date.slice(), note: new Array(S.lato * S.lato).fill(0),
      errori: 0, aiuti: 0, secondi: 0, completato: false, arreso: false });
  }

  const etichettaGabbia = q => q.op ? q.t + q.op : String(q.t);
  // Una gabbia piena è giusta?
  function gabbiaGiusta(q, g, N) {
    if (q.celle.some(k => !g[k])) return true;
    return possibile(q, g, q.celle[0], g[q.celle[0]], N);
  }

  /* ---------- Interfaccia ---------- */

  function monta(radice, tipo) {
    const LIVELLI = tipo === "futoshiki" ? LIV_FT : LIV_CD, nome = tipo === "futoshiki" ? "Futoshiki" : "Calcudoku";
    const pref = Object.assign({ livello: 2, evidenziaErrori: false }, E.memoria.leggi(tipo + ":pref", {}));
    let S = E.memoria.leggi(tipo + ":corrente", null), P = null;
    let sel = 0, modoNote = false, timer = null, celle = [], segniDom = [], etichette = [];
    const storia = [];
    const salvaPref = () => E.memoria.scrivi(tipo + ":pref", pref);

    const livelli = el("div", { class: "livelli", role: "radiogroup", "aria-label": "Livello" });
    function disegnaLivelli() {
      livelli.innerHTML = "";
      LIVELLI.forEach(l => livelli.append(el("button", { class: "livello" + (pref.livello === l.n ? " on" : ""), role: "radio", "aria-checked": String(pref.livello === l.n),
        onclick: () => { pref.livello = l.n; salvaPref(); disegnaLivelli(); } }, el("b", null, String(l.n)), el("span", null, l.nome + " " + l.lato + "×" + l.lato))));
    }
    const cbErr = el("input", { type: "checkbox", id: tipo + "-errori", checked: pref.evidenziaErrori,
      onchange: e => { pref.evidenziaErrori = e.target.checked; salvaPref(); disegna(); } });
    const btnNuovo = el("button", { class: "primario", onclick: nuovo }, "Nuovo " + nome.toLowerCase());
    const regole = tipo === "futoshiki"
      ? "In ogni riga e in ogni colonna i numeri da 1 al lato della griglia compaiono una volta sola. I segni < e > fra due caselle indicano quale numero è minore: la punta guarda il più piccolo."
      : "In ogni riga e in ogni colonna i numeri da 1 al lato della griglia compaiono una volta sola. I numeri di ogni gabbia, combinati con l'operazione indicata, danno il risultato (per − e ÷ si parte dal più grande). Un numero può ripetersi in una gabbia, ma non nella stessa riga o colonna.";
    const pannello = el("details", { class: "impostazioni", open: window.innerWidth > 900 && !(S && S.soluzione && !S.completato) },
      el("summary", null, "Livello e regole"), el("div", { class: "corpo-imp" },
        el("p", { class: "suggerimento" }, regole),
        el("div", { class: "riga-imp" }, el("h3", null, "Livello")), livelli,
        el("label", { class: "opzione", for: tipo + "-errori" }, cbErr, " Segnala subito i numeri sbagliati"),
        el("div", { class: "azioni-imp" }, btnNuovo)));

    const info = el("span", { class: "info-partita" }), tempo = el("span", { class: "tempo" });
    const griglia = el("div", { class: "griglia-lt " + tipo, tabindex: "0", "aria-label": "Griglia del " + nome });
    const esito = el("div", { class: "esito", hidden: true });
    const tastierino = el("div", { class: "tastierino" });
    const btnNote = el("button", { class: "secondario", "aria-pressed": "false", onclick: () => {
      modoNote = !modoNote; btnNote.classList.toggle("on", modoNote); btnNote.setAttribute("aria-pressed", String(modoNote)); btnNote.textContent = modoNote ? "Note: attive" : "Note: spente";
    } }, "Note: spente");
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
      btnNote,
      el("button", { class: "secondario", onclick: () => inserisci(0) }, "Cancella"),
      el("button", { class: "secondario", onclick: annulla }, "Annulla mossa"),
      el("button", { class: "secondario", onclick: noteAutomatiche }, "Note automatiche"),
      el("button", { class: "secondario", onclick: controlla }, "Controlla"),
      el("button", { class: "secondario", onclick: suggerisci }, "Suggerimento"),
      conferma("Soluzione", "Confermi? Mostra tutto", arrenditi),
      conferma("Azzera", "Confermi? Ricomincia", azzera),
      E.puoStampare ? E.pdf.menuPdf(o => E.pdf.pdfLatino(S, Object.assign(o, { sottotitolo: sottotitolo() }))) : null);

    radice.append(pannello, el("section", { class: "partita-lt" },
      el("div", { class: "testata-partita" }, info, tempo), griglia, esito, tastierino, strumenti));
    disegnaLivelli();

    const N = () => S.lato;
    const riga = i => Math.floor(i / N()), col = i => i % N();
    const stessaLinea = (i, j) => riga(i) === riga(j) || col(i) === col(j);
    function sottotitolo() { const lv = LIVELLI[S.livello - 1]; return "Livello " + lv.n + " · " + lv.nome + " · " + S.lato + "×" + S.lato; }
    function salva() { if (S) { S.secondi = timer ? timer.secondi : S.secondi; E.memoria.scrivi(tipo + ":corrente", S); } }

    function nuovo() {
      btnNuovo.disabled = true; btnNuovo.textContent = "Sto preparando la griglia…";
      setTimeout(() => {
        const p = genera(tipo, pref.livello);
        btnNuovo.disabled = false; btnNuovo.textContent = "Nuovo " + nome.toLowerCase();
        if (!p) { E.avviso("Non sono riuscito a comporre la griglia: riprova.", "errore"); return; }
        S = p; storia.length = 0; salva(); avvia();
        pannello.open = false;
      }, 30);
    }

    function cella(i) {
      const n = el("div", { class: "cella-lt", "data-i": i });
      n.addEventListener("pointerdown", e => { e.preventDefault(); sel = i; disegna(); griglia.focus({ preventScroll: true }); });
      celle[i] = n;
      return n;
    }

    function avvia() {
      if (timer) timer.ferma();
      timer = E.cronometro(tempo, S.secondi, s => { if (s % 5 === 0) salva(); });
      P = prepara(S);
      info.textContent = sottotitolo();
      esito.hidden = true;
      const n = N();
      celle = []; segniDom = []; etichette = [];
      griglia.innerHTML = "";
      griglia.style.setProperty("--lato", n);
      if (tipo === "futoshiki") {
        // Griglia (2n−1)×(2n−1): caselle alternate a spazi per i segni.
        const tracce = Array(n - 1).fill("1fr .42fr").join(" ") + " 1fr";
        griglia.style.gridTemplateColumns = griglia.style.gridTemplateRows = tracce;
        for (let rr = 0; rr < 2 * n - 1; rr++) for (let cc = 0; cc < 2 * n - 1; cc++) {
          const r = rr >> 1, c = cc >> 1;
          if (rr % 2 === 0 && cc % 2 === 0) { griglia.append(cella(r * n + c)); continue; }
          if (rr % 2 && cc % 2) { griglia.append(el("span")); continue; }
          const a = r * n + c, b = rr % 2 ? a + n : a + 1;
          const s = S.segni.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
          const testo = !s ? "" : rr % 2 ? (s.a === a ? "∧" : "∨") : (s.a === a ? "<" : ">");
          const nodo = el("span", { class: "segno-ft", "aria-label": testo ? (s.a === a ? "minore" : "maggiore") : null }, testo);
          if (s) segniDom.push({ s, nodo });
          griglia.append(nodo);
        }
      } else {
        griglia.style.gridTemplateColumns = griglia.style.gridTemplateRows = "";
        for (let i = 0; i < n * n; i++) {
          const nodo = cella(i), q = P.gabbiaDi[i];
          if (i % n < n - 1) nodo.classList.add(P.gabbiaDi[i + 1] !== q ? "bd" : "fd");
          if (i + n < n * n) nodo.classList.add(P.gabbiaDi[i + n] !== q ? "bb" : "fb");
          const gabbia = S.gabbie[q];
          if (gabbia.celle[0] === i) { const e = el("span", { class: "etichetta" }, etichettaGabbia(gabbia)); etichette.push({ q: gabbia, nodo: e }); nodo.append(e); }
          griglia.append(nodo);
        }
      }
      celle.forEach(c => c.append(el("span", { class: "valore" })));
      tastierino.innerHTML = "";
      tastierino.style.gridTemplateColumns = "repeat(" + n + ", 1fr)";
      tastierino.style.maxWidth = n * 64 + "px";
      for (let d = 1; d <= n; d++) tastierino.append(el("button", { class: "tasto", "data-d": d, onclick: () => inserisci(d) }, String(d)));
      sel = S.date.findIndex(v => !v);
      if (sel < 0) sel = 0;
      disegna();
      if (S.completato) mostraEsito(); else timer.avvia();
    }

    function disegna() {
      if (!S || !celle.length) return;
      const n = N(), v = S.valori[sel], contatori = new Array(n + 1).fill(0);
      S.valori.forEach(x => { if (x) contatori[x]++; });
      celle.forEach((nodo, i) => {
        const x = S.valori[i], data = !!S.date[i];
        nodo.classList.toggle("data", data);
        nodo.classList.toggle("sel", i === sel);
        nodo.classList.toggle("zona", i !== sel && stessaLinea(i, sel));
        nodo.classList.toggle("uguale", !!v && x === v && i !== sel);
        nodo.classList.toggle("errata", !!x && !data && pref.evidenziaErrori && x !== S.soluzione[i]);
        nodo.classList.toggle("conflitto", !!x && S.valori.some((y, j) => j !== i && y === x && stessaLinea(i, j)));
        const val = nodo.querySelector(".valore"), vecchie = nodo.querySelector(".note");
        if (vecchie) vecchie.remove();
        val.textContent = x ? String(x) : "";
        if (!x && S.note[i]) {
          const box = el("div", { class: "note" });
          for (let d = 1; d <= n; d++) box.append(el("span", null, S.note[i] & bit(d) ? String(d) : ""));
          nodo.append(box);
        }
      });
      segniDom.forEach(({ s, nodo }) => nodo.classList.toggle("violato", !!S.valori[s.a] && !!S.valori[s.b] && S.valori[s.a] >= S.valori[s.b]));
      etichette.forEach(({ q, nodo }) => nodo.classList.toggle("violata", !gabbiaGiusta(q, S.valori, n)));
      tastierino.querySelectorAll(".tasto").forEach(b => b.classList.toggle("esaurito", contatori[+b.dataset.d] >= n));
    }

    function inserisci(d) {
      if (!S || S.completato || S.date[sel]) return;
      storia.push({ i: sel, v: S.valori[sel], n: S.note[sel] });
      if (modoNote && d) {
        if (S.valori[sel]) return;
        S.note[sel] ^= bit(d);
      } else {
        S.valori[sel] = S.valori[sel] === d ? 0 : d;
        S.note[sel] = 0;
        if (d && S.valori[sel] === d) {
          S.note.forEach((_, j) => { if (stessaLinea(j, sel)) S.note[j] &= ~bit(d); });
          if (d !== S.soluzione[sel]) S.errori++;
        }
      }
      disegna(); verificaFine(); salva();
    }

    function annulla() {
      const m = storia.pop();
      if (!m || S.completato) return;
      S.valori[m.i] = m.v; S.note[m.i] = m.n; sel = m.i;
      disegna(); salva();
    }

    function noteAutomatiche() {
      if (S.completato) return;
      S.note = S.valori.map((x, i) => (x ? 0 : candidati(P, S.valori, i)));
      S.aiuti++; disegna(); salva();
      E.avviso("Inseriti tutti i candidati possibili", "ok");
    }

    function controlla() {
      const sbagliate = S.valori.filter((x, i) => x && !S.date[i] && x !== S.soluzione[i]).length;
      S.aiuti++; salva();
      if (sbagliate) {
        celle.forEach((nodo, i) => { if (S.valori[i] && !S.date[i] && S.valori[i] !== S.soluzione[i]) nodo.classList.add("errata"); });
        E.avviso(sbagliate + (sbagliate === 1 ? " numero sbagliato" : " numeri sbagliati") + " (in rosso)", "errore");
      } else E.avviso("Finora nessun errore", "ok");
    }

    // Suggerisce una casella che ha un solo candidato, se c'è; altrimenti la prima vuota o sbagliata.
    function suggerisci() {
      if (S.completato) return;
      const g = S.valori.map((x, i) => (x === S.soluzione[i] ? x : 0));
      let scelta = g.findIndex((x, i) => !x && conta(candidati(P, g, i)) === 1), motivo = "qui può andare un solo numero";
      if (scelta < 0) { scelta = S.valori.findIndex((x, i) => x !== S.soluzione[i]); motivo = ""; }
      if (scelta < 0) return;
      sel = scelta;
      S.valori[scelta] = S.soluzione[scelta]; S.note[scelta] = 0; S.aiuti++;
      disegna(); verificaFine(); salva();
      E.avviso("Riga " + (riga(scelta) + 1) + ", colonna " + (col(scelta) + 1) + (motivo ? ": " + motivo : ""), "ok");
    }

    function arrenditi() { S.valori = S.soluzione.slice(); S.note.fill(0); S.arreso = true; verificaFine(); disegna(); salva(); }
    function azzera() {
      Object.assign(S, { valori: S.date.slice(), note: new Array(S.lato * S.lato).fill(0), errori: 0, aiuti: 0, secondi: 0, completato: false, arreso: false });
      storia.length = 0; salva(); avvia();
    }

    function verificaFine() {
      if (S.completato || !S.valori.every((x, i) => x === S.soluzione[i])) return;
      S.completato = true; timer.ferma(); S.secondi = timer.secondi;
      if (!S.arreso) {
        const st = E.memoria.leggi("stat:" + tipo, {});
        const s = st[S.livello] || (st[S.livello] = { risolti: 0, migliore: null });
        s.risolti++;
        if (!S.aiuti && (s.migliore == null || S.secondi < s.migliore)) s.migliore = S.secondi;
        E.memoria.scrivi("stat:" + tipo, st);
      }
      salva(); mostraEsito();
    }

    function mostraEsito() {
      esito.hidden = false; esito.innerHTML = "";
      esito.append(
        el("strong", null, S.arreso ? "Soluzione mostrata" : nome + " risolto!"),
        el("span", null, S.arreso ? "Prova con una nuova griglia." :
          "Tempo " + timer.fmt(S.secondi) + " · " + (S.errori ? S.errori + (S.errori === 1 ? " errore" : " errori") : "nessun errore") +
          " · " + (S.aiuti ? S.aiuti + (S.aiuti === 1 ? " aiuto" : " aiuti") : "senza aiuti")),
        el("button", { class: "primario", onclick: nuovo }, "Nuovo " + nome.toLowerCase()));
    }

    griglia.addEventListener("keydown", e => {
      if (!S) return;
      const n = N(), r = riga(sel), c = col(sel);
      const mosse = { ArrowLeft: r * n + (c + n - 1) % n, ArrowRight: r * n + (c + 1) % n, ArrowUp: ((r + n - 1) % n) * n + c, ArrowDown: ((r + 1) % n) * n + c };
      if (mosse[e.key] != null) { e.preventDefault(); sel = mosse[e.key]; disegna(); return; }
      if (/^[1-9]$/.test(e.key) && +e.key <= n) { e.preventDefault(); inserisci(+e.key); return; }
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { e.preventDefault(); inserisci(0); return; }
      if (e.key.toLowerCase() === "n") { e.preventDefault(); btnNote.click(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); annulla(); }
    });

    document.addEventListener("visibilitychange", salva);
    if (S && S.soluzione) avvia(); else nuovo();
    return { smonta() { if (timer) timer.ferma(); salva(); document.removeEventListener("visibilitychange", salva); } };
  }

  E.registraGioco({
    id: "futoshiki",
    nome: "Futoshiki",
    descrizione: "Numeri da 1 a N senza ripetizioni, guidati dai segni < e > fra le caselle.",
    livelli: LIV_FT,
    monta: r => monta(r, "futoshiki")
  });
  E.registraGioco({
    id: "calcudoku",
    nome: "Calcudoku",
    descrizione: "Gabbie con un risultato e un'operazione: calcolo mentale e logica in una griglia.",
    livelli: LIV_CD,
    monta: r => monta(r, "calcudoku")
  });
  E._latini = { genera, risolvi, prepara, etichettaGabbia, LIV_FT, LIV_CD };
})();
