/* Sudoku: generatore con soluzione unica, difficoltà valutata con tecniche di risoluzione "umane". */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  // date: caselle iniziali minime; tecniche: 1 solo singoli nudi, 2 singoli, 3 coppie e incastri; serve: tecnica richiesta.
  const LIVELLI = [
    { n: 1, nome: "Principiante", date: 44, tecniche: 1 },
    { n: 2, nome: "Facile",       date: 37, tecniche: 2 },
    { n: 3, nome: "Medio",        date: 31, tecniche: 2 },
    { n: 4, nome: "Difficile",    date: 27, tecniche: 3, serve: 3 },
    { n: 5, nome: "Esperto",      date: 22, tecniche: 9, serve: 9 }
  ];

  const RIGA = i => Math.floor(i / 9), COL = i => i % 9, BOX = i => Math.floor(RIGA(i) / 3) * 3 + Math.floor(COL(i) / 3);
  const UNITA = [];
  for (let u = 0; u < 9; u++) {
    UNITA.push(Array.from({ length: 9 }, (_, j) => u * 9 + j));
    UNITA.push(Array.from({ length: 9 }, (_, j) => j * 9 + u));
    UNITA.push(Array.from({ length: 9 }, (_, j) => (Math.floor(u / 3) * 3 + Math.floor(j / 3)) * 9 + (u % 3) * 3 + (j % 3)));
  }
  const VICINI = Array.from({ length: 81 }, (_, i) => {
    const s = new Set();
    for (let j = 0; j < 81; j++) if (j !== i && (RIGA(j) === RIGA(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j);
    return [...s];
  });
  const bit = d => 1 << (d - 1);
  const conta = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
  const cifra = m => 31 - Math.clz32(m) + 1;

  function candidati(g, i) {
    let m = 511;
    for (const j of VICINI[i]) if (g[j]) m &= ~bit(g[j]);
    return m;
  }

  // Conta le soluzioni (fino a limite) con backtracking sulla casella più vincolata.
  function soluzioni(g, limite) {
    g = g.slice();
    let n = 0;
    (function cerca() {
      let best = -1, bm = 0, bc = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const m = candidati(g, i), c = conta(m);
        if (c === 0) return;
        if (c < bc) { bc = c; best = i; bm = m; if (c === 1) break; }
      }
      if (best < 0) { n++; return; }
      for (let d = 1; d <= 9 && n < limite; d++) if (bm & bit(d)) { g[best] = d; cerca(); }
      g[best] = 0;
    })();
    return n;
  }

  function completa() {
    const g = new Array(81).fill(0);
    (function riempi(i) {
      if (i === 81) return true;
      const cifre = E.mescola([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const m = candidati(g, i);
      for (const d of cifre) if (m & bit(d)) { g[i] = d; if (riempi(i + 1)) return true; }
      g[i] = 0;
      return false;
    })(0);
    return g;
  }

  // Risolutore logico: restituisce la tecnica più difficile usata (1, 2, 3) oppure 9 se non basta.
  function valuta(g0, maxTec) {
    const g = g0.slice();
    const c = g.map((v, i) => (v ? 0 : candidati(g, i)));
    let massima = 0;
    const metti = (i, d) => {
      g[i] = d; c[i] = 0;
      for (const j of VICINI[i]) c[j] &= ~bit(d);
    };
    for (;;) {
      if (g.every(Boolean)) return massima || 1;
      let fatto = false;
      for (let i = 0; i < 81; i++) if (!g[i] && conta(c[i]) === 1) { metti(i, cifra(c[i])); fatto = true; }
      if (fatto) { massima = Math.max(massima, 1); continue; }
      if (g.some((v, i) => !v && !c[i])) return 99;
      if (maxTec < 2) return 9;
      for (const u of UNITA) {
        for (let d = 1; d <= 9; d++) {
          const dove = u.filter(i => !g[i] && (c[i] & bit(d)));
          if (dove.length === 1) { metti(dove[0], d); fatto = true; }
        }
      }
      if (fatto) { massima = Math.max(massima, 2); continue; }
      if (maxTec < 3) return 9;
      // Incastri casella-linea (pointing / claiming)
      for (const u of UNITA) for (let d = 1; d <= 9; d++) {
        const dove = u.filter(i => !g[i] && (c[i] & bit(d)));
        if (dove.length < 2) continue;
        for (const v of UNITA) {
          if (v === u || !dove.every(i => v.includes(i))) continue;
          for (const j of v) if (!dove.includes(j) && !g[j] && (c[j] & bit(d))) { c[j] &= ~bit(d); fatto = true; }
        }
      }
      // Coppie e terne nude
      for (const u of UNITA) {
        const vuote = u.filter(i => !g[i]);
        for (const a of vuote) {
          const m = c[a], n = conta(m);
          if (n < 2 || n > 3) continue;
          const gruppo = vuote.filter(i => (c[i] & ~m) === 0);
          if (gruppo.length !== n) continue;
          for (const j of vuote) if (!gruppo.includes(j) && (c[j] & m)) { c[j] &= ~m; fatto = true; }
        }
      }
      if (fatto) { massima = Math.max(massima, 3); continue; }
      return 9;
    }
  }

  function genera(livello) {
    const lv = LIVELLI[livello - 1];
    let migliore = null;
    const t0 = performance.now();
    for (let tent = 0; tent < 30 && (tent < 2 || performance.now() - t0 < 2500); tent++) {
      const sol = completa();
      const g = sol.slice();
      let date = 81;
      // Rimozione a coppie simmetriche, come nei sudoku da rivista.
      const ordine = E.mescola(Array.from({ length: 41 }, (_, i) => i));
      for (const i of ordine) {
        if (date <= lv.date) break;
        const j = 80 - i, coppia = i === j ? [i] : [i, j];
        const prima = coppia.map(x => g[x]);
        coppia.forEach(x => { g[x] = 0; });
        const ok = soluzioni(g, 2) === 1 && (lv.tecniche >= 9 || valuta(g, lv.tecniche) <= lv.tecniche);
        if (ok) date -= coppia.length; else coppia.forEach((x, t) => { g[x] = prima[t]; });
      }
      const tec = valuta(g, 3);
      const voto = (lv.serve ? (tec >= lv.serve ? 0 : 10) : 0) + Math.max(0, date - lv.date);
      if (!migliore || voto < migliore.voto) migliore = { voto, g, sol };
      if (voto === 0) break;
    }
    return {
      livello, date: migliore.g, soluzione: migliore.sol,
      valori: migliore.g.slice(), note: new Array(81).fill(0),
      errori: 0, aiuti: 0, secondi: 0, completato: false, arreso: false
    };
  }

  /* ---------- Interfaccia ---------- */

  function monta(radice) {
    const pref = E.memoria.leggi("sudoku:pref", { livello: 2, evidenziaErrori: false });
    let S = E.memoria.leggi("sudoku:corrente", null);
    let sel = 40, modoNote = false, timer = null, celle = [];
    const storia = [];

    const livelli = el("div", { class: "livelli", role: "radiogroup", "aria-label": "Livello" });
    function disegnaLivelli() {
      livelli.innerHTML = "";
      LIVELLI.forEach(l => livelli.append(el("button", {
        class: "livello" + (pref.livello === l.n ? " on" : ""), role: "radio", "aria-checked": String(pref.livello === l.n),
        onclick: () => { pref.livello = l.n; E.memoria.scrivi("sudoku:pref", pref); disegnaLivelli(); }
      }, el("b", null, String(l.n)), el("span", null, l.nome))));
    }
    const cbErr = el("input", { type: "checkbox", id: "sd-errori", checked: pref.evidenziaErrori,
      onchange: e => { pref.evidenziaErrori = e.target.checked; E.memoria.scrivi("sudoku:pref", pref); disegna(); } });
    const btnNuovo = el("button", { class: "primario", onclick: nuovo }, "Nuovo sudoku");
    radice.append(el("details", { class: "impostazioni", open: window.innerWidth > 900 }, el("summary", null, "Livello"), el("div", { class: "corpo-imp" },
      el("div", { class: "riga-imp" }, el("h3", null, "Livello")), livelli,
      el("label", { class: "opzione", for: "sd-errori" }, cbErr, " Segnala subito i numeri sbagliati"),
      el("div", { class: "azioni-imp" }, btnNuovo))));

    const info = el("span", { class: "info-partita" });
    const tempo = el("span", { class: "tempo" });
    const griglia = el("div", { class: "griglia-sd", tabindex: "0", "aria-label": "Griglia del sudoku" });
    const esito = el("div", { class: "esito", hidden: true });
    const btnNote = el("button", { class: "secondario", "aria-pressed": "false", onclick: () => { modoNote = !modoNote; btnNote.classList.toggle("on", modoNote); btnNote.setAttribute("aria-pressed", String(modoNote)); btnNote.textContent = modoNote ? "Note: attive" : "Note: spente"; } }, "Note: spente");
    const tastierino = el("div", { class: "tastierino" },
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => el("button", { class: "tasto", "data-d": d, onclick: () => inserisci(d) }, String(d))));
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
      E.puoStampare ? E.pdf.menuPdf(o => E.pdf.pdfSudoku(S, Object.assign(o, { sottotitolo: "Livello " + S.livello + " · " + LIVELLI[S.livello - 1].nome }))) : null);

    radice.append(el("section", { class: "partita-sd" },
      el("div", { class: "testata-partita" }, info, tempo),
      griglia, esito, tastierino, strumenti));

    for (let i = 0; i < 81; i++) {
      const n = el("div", { class: "cella-sd", "data-i": i });
      if (COL(i) % 3 === 2 && COL(i) < 8) n.classList.add("bordo-d");
      if (RIGA(i) % 3 === 2 && RIGA(i) < 8) n.classList.add("bordo-b");
      n.addEventListener("pointerdown", e => { e.preventDefault(); sel = i; disegna(); griglia.focus({ preventScroll: true }); });
      celle.push(n); griglia.append(n);
    }
    disegnaLivelli();

    function salva() { if (S) { S.secondi = timer ? timer.secondi : S.secondi; E.memoria.scrivi("sudoku:corrente", S); } }

    function nuovo() {
      btnNuovo.disabled = true; btnNuovo.textContent = "Sto preparando la griglia…";
      setTimeout(() => {
        S = genera(pref.livello);
        btnNuovo.disabled = false; btnNuovo.textContent = "Nuovo sudoku";
        storia.length = 0; salva(); avvia();
      }, 30);
    }

    function avvia() {
      if (timer) timer.ferma();
      timer = E.cronometro(tempo, S.secondi, s => { if (s % 5 === 0) salva(); });
      const lv = LIVELLI[S.livello - 1];
      info.textContent = "Livello " + lv.n + " · " + lv.nome + " · " + S.date.filter(Boolean).length + " numeri dati";
      sel = S.date.findIndex(v => !v);
      esito.hidden = true;
      disegna();
      if (S.completato) mostraEsito(); else timer.avvia();
    }

    function disegna() {
      if (!S) return;
      const v = S.valori[sel];
      const contatori = new Array(10).fill(0);
      S.valori.forEach(x => { if (x) contatori[x]++; });
      celle.forEach((n, i) => {
        const x = S.valori[i], data = !!S.date[i];
        n.classList.remove("data", "sel", "zona", "uguale", "errata", "conflitto");
        if (data) n.classList.add("data");
        if (i === sel) n.classList.add("sel");
        else if (VICINI[sel].includes(i)) n.classList.add("zona");
        if (v && x === v && i !== sel) n.classList.add("uguale");
        if (x && !data && pref.evidenziaErrori && x !== S.soluzione[i]) n.classList.add("errata");
        if (x && VICINI[i].some(j => S.valori[j] === x)) n.classList.add("conflitto");
        n.innerHTML = "";
        if (x) n.textContent = x;
        else if (S.note[i]) {
          const box = el("div", { class: "note" });
          for (let d = 1; d <= 9; d++) box.append(el("span", null, S.note[i] & bit(d) ? String(d) : ""));
          n.append(box);
        }
      });
      tastierino.querySelectorAll(".tasto").forEach(b => b.classList.toggle("esaurito", contatori[+b.dataset.d] >= 9));
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
          for (const j of VICINI[sel]) S.note[j] &= ~bit(d);
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
      for (let i = 0; i < 81; i++) S.note[i] = S.valori[i] ? 0 : candidati(S.valori, i);
      S.aiuti++; disegna(); salva();
      E.avviso("Inseriti tutti i candidati possibili", "ok");
    }

    function controlla() {
      const sbagliate = S.valori.filter((x, i) => x && !S.date[i] && x !== S.soluzione[i]).length;
      S.aiuti++; salva();
      if (sbagliate) {
        celle.forEach((n, i) => { if (S.valori[i] && !S.date[i] && S.valori[i] !== S.soluzione[i]) n.classList.add("errata"); });
        E.avviso(sbagliate + (sbagliate === 1 ? " numero sbagliato" : " numeri sbagliati") + " (in rosso)", "errore");
      } else E.avviso("Finora nessun errore", "ok");
    }

    // Suggerisce la casella più facile: un singolo nudo se c'è, altrimenti un singolo nascosto.
    function suggerisci() {
      if (S.completato) return;
      const g = S.valori.map((x, i) => (x === S.soluzione[i] ? x : 0));
      let scelta = -1, motivo = "";
      for (let i = 0; i < 81 && scelta < 0; i++) if (!g[i] && conta(candidati(g, i)) === 1) { scelta = i; motivo = "in questa casella può andare un solo numero"; }
      if (scelta < 0) for (const u of UNITA) {
        for (let d = 1; d <= 9 && scelta < 0; d++) {
          const dove = u.filter(i => !g[i] && (candidati(g, i) & bit(d)));
          if (dove.length === 1) { scelta = dove[0]; motivo = "il " + d + " può stare solo qui nel suo gruppo"; }
        }
        if (scelta >= 0) break;
      }
      if (scelta < 0) scelta = S.valori.findIndex((x, i) => x !== S.soluzione[i]);
      if (scelta < 0) return;
      sel = scelta;
      S.valori[scelta] = S.soluzione[scelta]; S.note[scelta] = 0; S.aiuti++;
      for (const j of VICINI[scelta]) S.note[j] &= ~bit(S.soluzione[scelta]);
      disegna(); verificaFine(); salva();
      E.avviso("Riga " + (RIGA(scelta) + 1) + ", colonna " + (COL(scelta) + 1) + (motivo ? ": " + motivo : ""), "ok");
    }

    function arrenditi() { S.valori = S.soluzione.slice(); S.note.fill(0); S.arreso = true; verificaFine(); disegna(); salva(); }
    function azzera() {
      Object.assign(S, { valori: S.date.slice(), note: new Array(81).fill(0), errori: 0, aiuti: 0, secondi: 0, completato: false, arreso: false });
      storia.length = 0; salva(); avvia();
    }

    function verificaFine() {
      if (S.completato || !S.valori.every((x, i) => x === S.soluzione[i])) return;
      S.completato = true; timer.ferma(); S.secondi = timer.secondi;
      if (!S.arreso) {
        const st = E.memoria.leggi("stat:sudoku", {});
        const s = st[S.livello] || (st[S.livello] = { risolti: 0, migliore: null });
        s.risolti++;
        if (!S.aiuti && (s.migliore == null || S.secondi < s.migliore)) s.migliore = S.secondi;
        E.memoria.scrivi("stat:sudoku", st);
      }
      salva(); mostraEsito();
    }

    function mostraEsito() {
      esito.hidden = false; esito.innerHTML = "";
      esito.append(
        el("strong", null, S.arreso ? "Soluzione mostrata" : "Sudoku risolto!"),
        el("span", null, S.arreso ? "Prova con una nuova griglia." :
          "Tempo " + timer.fmt(S.secondi) + " · " + (S.errori ? S.errori + (S.errori === 1 ? " errore" : " errori") : "nessun errore") +
          " · " + (S.aiuti ? S.aiuti + (S.aiuti === 1 ? " aiuto" : " aiuti") : "senza aiuti")),
        el("button", { class: "primario", onclick: nuovo }, "Nuovo sudoku"));
    }

    function stampa(conSoluzione) {
      const area = document.getElementById("area-stampa");
      const lv = LIVELLI[S.livello - 1];
      area.innerHTML = "";
      const g = el("div", { class: "sudoku-stampa" });
      for (let i = 0; i < 81; i++) {
        const v = conSoluzione ? S.soluzione[i] : S.date[i];
        const n = el("div", { class: (S.date[i] ? "data" : "") + (COL(i) % 3 === 2 && COL(i) < 8 ? " bd" : "") + (RIGA(i) % 3 === 2 && RIGA(i) < 8 ? " bb" : "") }, v ? String(v) : "");
        g.append(n);
      }
      area.append(el("h1", null, "Sudoku" + (conSoluzione ? " — soluzione" : "")), el("p", null, "Livello " + lv.n + " (" + lv.nome + ")"), g);
      window.print();
    }

    griglia.addEventListener("keydown", e => {
      if (!S) return;
      const mosse = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 };
      if (mosse[e.key] != null) {
        e.preventDefault();
        const r = RIGA(sel), c = COL(sel);
        if (e.key === "ArrowLeft") sel = r * 9 + (c + 8) % 9;
        if (e.key === "ArrowRight") sel = r * 9 + (c + 1) % 9;
        if (e.key === "ArrowUp") sel = ((r + 8) % 9) * 9 + c;
        if (e.key === "ArrowDown") sel = ((r + 1) % 9) * 9 + c;
        disegna(); return;
      }
      if (/^[1-9]$/.test(e.key)) { e.preventDefault(); inserisci(+e.key); return; }
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { e.preventDefault(); inserisci(0); return; }
      if (e.key.toLowerCase() === "n") { e.preventDefault(); btnNote.click(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); annulla(); }
    });

    document.addEventListener("visibilitychange", salva);
    if (S && S.soluzione) avvia(); else nuovo();
    return { smonta() { if (timer) timer.ferma(); salva(); document.removeEventListener("visibilitychange", salva); } };
  }

  E.registraGioco({
    id: "sudoku",
    nome: "Sudoku",
    descrizione: "Griglie sempre diverse con soluzione unica, dalla prima partita alle tecniche avanzate.",
    livelli: LIVELLI,
    monta
  });
  E._sudoku = { genera, valuta, soluzioni, LIVELLI };
})();
