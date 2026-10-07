/* Cruciverba a schema libero: generatore, griglia interattiva, stampa. */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  // lato: dimensione massima dello schema; noto: notorietà massima delle parole;
  // defs: quali definizioni usare (0 facile, 1 media, 2 difficile); obiettivo: parole da piazzare;
  // lunga: a volte il seme è una parola rara (notorietà 3) più lunga del lato, fino a lunga lettere.
  const LIVELLI = [
    { n: 1, nome: "Principiante", lato: 9,  noto: 1, defs: [0],       min: 3, max: 7,  obiettivo: 14, lunghezze: true,  materia: true },
    { n: 2, nome: "Facile",       lato: 11, noto: 2, defs: [0, 0, 1], min: 3, max: 9,  obiettivo: 21, lunghezze: true,  materia: true },
    { n: 3, nome: "Medio",        lato: 13, noto: 2, defs: [1],       min: 2, max: 11, obiettivo: 30, lunghezze: false, materia: false },
    { n: 4, nome: "Difficile",    lato: 15, noto: 3, defs: [1, 2, 2], min: 2, max: 13, obiettivo: 40, lunghezze: false, materia: false },
    { n: 5, nome: "Esperto",      lato: 15, noto: 3, defs: [2],       min: 2, max: 15, obiettivo: 48, lunghezze: false, materia: false, lunga: 17 }
  ];

  /* ---------- Generatore ---------- */

  // obbligate: voci da inserire per prime (la prima fa da seme). Lo schema è R righe × N colonne.
  function tentativo(pool, lv, obbligate) {
    obbligate = obbligate ? [].concat(obbligate) : [];
    const R = lv.righe || lv.lato, N = lv.colonne || lv.lato, griglia = new Array(R * N).fill(null);
    const usoO = new Uint8Array(R * N), usoV = new Uint8Array(R * N);
    const perLettera = {};
    const piazzate = [], usate = new Set();
    const vuota = (r, c) => r < 0 || c < 0 || r >= R || c >= N || griglia[r * N + c] === null;

    function incroci(w, r, c, oriz) {
      const L = w.length, dr = oriz ? 0 : 1, dc = oriz ? 1 : 0;
      if (r < 0 || c < 0 || r + dr * (L - 1) >= R || c + dc * (L - 1) >= N) return -1;
      if (!vuota(r - dr, c - dc) || !vuota(r + dr * L, c + dc * L)) return -1;
      let x = 0;
      for (let i = 0; i < L; i++) {
        const rr = r + dr * i, cc = c + dc * i, k = rr * N + cc, v = griglia[k];
        if (v !== null) {
          if (v !== w[i] || (oriz ? usoO[k] : usoV[k])) return -1;
          x++;
        } else if (oriz ? (!vuota(rr - 1, cc) || !vuota(rr + 1, cc)) : (!vuota(rr, cc - 1) || !vuota(rr, cc + 1))) {
          return -1;
        }
      }
      return x;
    }

    function piazza(voce, r, c, oriz, x) {
      const w = voce.r, dr = oriz ? 0 : 1, dc = oriz ? 1 : 0;
      for (let i = 0; i < w.length; i++) {
        const k = (r + dr * i) * N + (c + dc * i);
        if (griglia[k] === null) { griglia[k] = w[i]; (perLettera[w[i]] || (perLettera[w[i]] = [])).push(k); }
        (oriz ? usoO : usoV)[k] = 1;
      }
      piazzate.push({ voce, r, c, oriz, x });
      usate.add(w);
    }

    function migliorePosizione(voce) {
      const w = voce.r;
      let best = null;
      for (let i = 0; i < w.length; i++) {
        const celle = perLettera[w[i]];
        if (!celle) continue;
        for (const k of celle) {
          const r = Math.floor(k / N), c = k % N;
          for (const oriz of [true, false]) {
            if (oriz ? usoO[k] : usoV[k]) continue;
            const r0 = oriz ? r : r - i, c0 = oriz ? c - i : c;
            const x = incroci(w, r0, c0, oriz);
            if (x < 1) continue;
            const s = x * 4 + w.length * 0.25 + Math.random() * 2;
            if (!best || s > best.s) best = { r: r0, c: c0, oriz, x, s };
          }
        }
      }
      return best;
    }

    // Prima parola: quella richiesta, oppure una delle più lunghe; orizzontale al centro.
    const lunghe = pool.filter(v => !v.riempitivo && v.r.length >= Math.min(N - 2, 6) && v.r.length <= N);
    const seme = obbligate[0] || (lunghe.length ? lunghe : pool)[Math.floor(Math.random() * (lunghe.length || pool.length))];
    if (!seme || seme.r.length > Math.max(R, N)) return null;
    if (seme.r.length <= N) piazza(seme, Math.floor(R / 2), Math.floor((N - seme.r.length) / 2), true, 0);
    else piazza(seme, Math.floor((R - seme.r.length) / 2), Math.floor(N / 2), false, 0);

    // Le altre parole obbligatorie, in due passate (alcune trovano posto solo dopo altre).
    for (let passata = 0; passata < 2; passata++) {
      for (const v of obbligate.slice(1)) {
        if (usate.has(v.r)) continue;
        const p = migliorePosizione(v);
        if (p) piazza(v, p.r, p.c, p.oriz, p.x);
      }
    }
    const obbligatePiazzate = obbligate.filter(v => usate.has(v.r)).length;

    let fallimenti = 0;
    while (piazzate.length < lv.obiettivo && fallimenti < 3) {
      const campione = [];
      for (let t = 0; t < 160 && campione.length < 110; t++) {
        const v = pool[Math.floor(Math.random() * pool.length)];
        if (!usate.has(v.r)) campione.push(v);
      }
      let scelta = null;
      for (const v of campione) {
        const p = migliorePosizione(v);
        if (!p) continue;
        const s = p.s - (v.riempitivo ? 3 : 0);
        if (!scelta || s > scelta.s) scelta = { v, p, s };
      }
      if (!scelta) { fallimenti++; continue; }
      fallimenti = 0;
      piazza(scelta.v, scelta.p.r, scelta.p.c, scelta.p.oriz, scelta.p.x);
    }

    const lettere = griglia.filter(v => v !== null).length;
    const tot = piazzate.reduce((a, p) => a + p.x, 0);
    const riemp = piazzate.filter(p => p.voce.riempitivo).length;
    return { R, N, griglia, piazzate, obbligatePiazzate, punteggio: obbligatePiazzate * 1000 + piazzate.length * 4 + tot * 3 + lettere * 0.5 - riemp * 2 };
  }

  // Materie effettive: le incluse (o tutte, se nessuna è inclusa) meno le escluse.
  function materieScelte(incluse, escluse) {
    const disponibili = E.MATERIE.map(m => m.id).filter(id => (E.archivio[id] || []).length);
    return (incluse.length ? incluse : disponibili).filter(id => disponibili.includes(id) && !escluse.includes(id));
  }

  function etichettaScelta(incluse, escluse) {
    if (incluse.length) return incluse.filter(id => !escluse.includes(id)).map(E.nomeMateria).join(", ");
    return "Misto" + (escluse.length ? " senza " + escluse.map(E.nomeMateria).join(", ") : "");
  }

  // Parole (normalizzate) di tutte le definizioni di una voce.
  const paroleDef = v => new Set(E.normalizza(v.def.flat().join(" ")).split(" ").filter(Boolean));

  // Voci da tenere lontane dalla parola obbligata: la contengono, sono citate nelle sue
  // definizioni o la citano nelle proprie (es. SVEVO, «Autore de La coscienza di Zeno»).
  function nonLegate(pool, s) {
    const defS = paroleDef(s), defSUnite = E.normalizza(s.def.flat().join(" ")).replace(/ /g, "");
    const chiave = s.testo.split(" ").filter(w => w.length >= 4);
    return pool.filter(v => {
      if (v.r === s.r) return true;
      if (v.r.length >= 4 && (s.r.includes(v.r) || defS.has(v.r) || (v.nParole > 1 && defSUnite.includes(v.r)))) return false;
      const defV = paroleDef(v);
      return !chiave.some(w => defV.has(w)) && !defV.has(s.r);
    });
  }

  // parola: facoltativa; va al centro dello schema anche se è di un'altra materia o più lunga del lato.
  function genera(incluse, escluse, livello, incroci, parola) {
    let lv = LIVELLI[livello - 1];
    let obbligata = null;
    const materie = materieScelte(incluse, escluse);
    if (parola) {
      const r = E.normalizza(parola).replace(/ /g, "");
      obbligata = E.voci().find(v => v.r === r);
      if (!obbligata) return { errore: "«" + parola.trim() + "» non è nell'archivio: controlla l'ortografia o aggiungila al file di una materia." };
    } else if (lv.lunga && Math.random() < 0.35) {
      // Parola difficile: rara e più lunga del lato, dalle materie scelte.
      const rare = E.voci(materie).filter(v => v.noto === 3 && v.r.length > lv.lato && v.r.length <= lv.lunga && v.def[2] && v.def[2].length);
      if (rare.length) obbligata = rare[Math.floor(Math.random() * rare.length)];
    }
    if (obbligata && obbligata.r.length > lv.lato) {
      const lato = obbligata.r.length;
      lv = Object.assign({}, lv, { lato, max: Math.max(lv.max, lato), obiettivo: Math.round(lv.obiettivo * lato * lato / (lv.lato * lv.lato)) });
    }
    const adatta = v => v.noto <= lv.noto && v.r.length >= lv.min && v.r.length <= Math.min(lv.max, lv.lato) && v.def.some(d => d.length);
    let pool = E.voci(materie).filter(adatta);
    if (!materie.length) return null;
    if (incluse.length && incroci && !materie.includes("generale") && !escluse.includes("generale")) {
      pool = pool.concat((E.archivio.generale || [])
        .filter(v => adatta(v) && v.r.length <= 5)
        .map(v => Object.assign({}, v, { riempitivo: true })));
    }
    if (obbligata) pool = nonLegate(pool, obbligata);
    if (pool.length < 15) return null;

    let migliore = null;
    const t0 = performance.now();
    for (let i = 0; i < 40 && (i < 6 || performance.now() - t0 < 900); i++) {
      const t = tentativo(pool, lv, obbligata);
      if (t && (!migliore || t.punteggio > migliore.punteggio)) migliore = t;
    }
    const p = migliore && componi(migliore, lv, materie);
    if (p) p.etichetta = etichettaScelta(incluse, escluse);
    return p;
  }

  // Ritaglia lo schema, numera le caselle e sceglie le definizioni.
  function componi(t, lv, materie) {
    const { N, griglia, piazzate } = t;
    let r0 = t.R || N, r1 = 0, c0 = N, c1 = 0;
    griglia.forEach((v, k) => {
      if (v === null) return;
      const r = Math.floor(k / N), c = k % N;
      r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    });
    const righe = r1 - r0 + 1, colonne = c1 - c0 + 1;
    const soluzione = [];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) soluzione.push(griglia[r * N + c]);

    const inizi = {};
    piazzate.forEach(p => { const k = (p.r - r0) * colonne + (p.c - c0); (inizi[k] || (inizi[k] = [])).push(p); });
    const numeri = new Array(soluzione.length).fill(0);
    const parole = [];
    let n = 0;
    for (let k = 0; k < soluzione.length; k++) {
      if (!inizi[k]) continue;
      numeri[k] = ++n;
      for (const p of inizi[k]) {
        const v = p.voce;
        let i = lv.defs[Math.floor(Math.random() * lv.defs.length)];
        if (!v.def[i].length) i = v.def.findIndex(d => d.length);
        const alternative = v.def[i], testoDef = alternative[Math.floor(Math.random() * alternative.length)];
        let suff = [];
        if (v.nParole > 1) suff.push(v.nParole + " parole");
        if (lv.lunghezze) suff.push(String(v.r.length));
        parole.push({
          num: n, oriz: p.oriz, r: Math.floor(k / colonne), c: k % colonne, len: v.r.length,
          risposta: v.r, testo: v.testo, def: testoDef + (suff.length ? " (" + suff.join(", ") + ")" : ""),
          materia: v.materia
        });
      }
    }
    return {
      livello: lv.n, materie, righe, colonne, soluzione, numeri, parole,
      inserite: soluzione.map(v => (v === null ? null : "")),
      rivelate: [], secondi: 0, aiuti: 0, completato: false, creato: Date.now()
    };
  }

  /* ---------- Interfaccia ---------- */

  function monta(radice) {
    const pref = Object.assign({ materie: [], escluse: [], livello: 2, incroci: true }, E.memoria.leggi("cruciverba:pref", {}));
    let S = E.memoria.leggi("cruciverba:corrente", null);
    let sel = { r: 0, c: 0, oriz: true };
    let timer = null;
    let celleDom = [];
    const liDi = new Map();

    /* Pannello impostazioni */
    const chipsMaterie = el("div", { class: "chips", role: "group", "aria-label": "Materie" });
    const contatore = el("span", { class: "contatore" });
    function disegnaChips() {
      chipsMaterie.innerHTML = "";
      const misto = !pref.materie.length && !pref.escluse.length;
      chipsMaterie.append(el("button", {
        class: "chip" + (misto ? " on" : ""), "aria-pressed": String(misto),
        title: "Tutte le materie",
        onclick: () => { pref.materie = []; pref.escluse = []; salvaPref(); disegnaChips(); }
      }, "Misto (tutte)"));
      // Ogni tocco: neutra → inclusa → esclusa → neutra.
      for (const m of E.MATERIE) {
        const n = (E.archivio[m.id] || []).length;
        if (!n) continue;
        const inclusa = pref.materie.includes(m.id), esclusa = pref.escluse.includes(m.id);
        chipsMaterie.append(el("button", {
          class: "chip" + (inclusa ? " on" : esclusa ? " no" : ""),
          "aria-label": m.nome + (inclusa ? ", inclusa" : esclusa ? ", esclusa" : ""),
          title: inclusa ? "Inclusa: tocca per escluderla" : esclusa ? "Esclusa: tocca per toglierla dalla scelta" : "Tocca per includerla",
          onclick: () => {
            if (inclusa) { pref.materie = pref.materie.filter(x => x !== m.id); pref.escluse.push(m.id); }
            else if (esclusa) pref.escluse = pref.escluse.filter(x => x !== m.id);
            else pref.materie.push(m.id);
            salvaPref(); disegnaChips();
          }
        }, el("span", { class: "segno-chip", "aria-hidden": "true" }, inclusa ? "✓" : esclusa ? "✕" : ""), m.nome, el("small", null, String(n))));
      }
      const scelte = materieScelte(pref.materie, pref.escluse);
      const n = E.voci(scelte).length;
      contatore.textContent = etichettaScelta(pref.materie, pref.escluse) + " · " + n.toLocaleString("it-IT") + " parole";
      opzIncroci.hidden = !pref.materie.length || scelte.includes("generale") || pref.escluse.includes("generale");
    }
    const livelli = el("div", { class: "livelli", role: "radiogroup", "aria-label": "Livello" });
    function disegnaLivelli() {
      livelli.innerHTML = "";
      LIVELLI.forEach(l => livelli.append(el("button", {
        class: "livello" + (pref.livello === l.n ? " on" : ""), role: "radio", "aria-checked": String(pref.livello === l.n),
        onclick: () => { pref.livello = l.n; salvaPref(); disegnaLivelli(); }
      }, el("b", null, String(l.n)), el("span", null, l.nome))));
    }
    const cbIncroci = el("input", { type: "checkbox", id: "cv-incroci", checked: pref.incroci, onchange: e => { pref.incroci = e.target.checked; salvaPref(); } });
    const opzIncroci = el("label", { class: "opzione", for: "cv-incroci" }, cbIncroci, " Aggiungi parole comuni per facilitare gli incroci");
    function salvaPref() { E.memoria.scrivi("cruciverba:pref", pref); }

    const btnNuovo = el("button", { class: "primario", onclick: nuovo }, "Nuovo cruciverba");
    const campoParola = el("input", { type: "text", id: "cv-parola", placeholder: "es. VULCANO", autocomplete: "off", spellcheck: "false",
      onkeydown: e => { if (e.key === "Enter") nuovo(); } });
    const pannello = el("details", { class: "impostazioni", open: window.innerWidth > 900 },
      el("summary", null, "Materie e livello"), el("div", { class: "corpo-imp" },
      el("div", { class: "riga-imp" }, el("h3", null, "Materie"), contatore), chipsMaterie,
      el("p", { class: "suggerimento" }, "Tocca una materia per includerla (✓), di nuovo per escluderla (✕), una terza volta per tornare neutra. Senza materie incluse si gioca con tutte, tranne le escluse."),
      opzIncroci,
      el("div", { class: "riga-imp" }, el("h3", null, "Livello")), livelli,
      el("label", { class: "campo-parola", for: "cv-parola" }, el("span", null, "Parola da inserire (facoltativa)"), campoParola),
      el("div", { class: "azioni-imp" }, btnNuovo))
    );

    /* Area di gioco */
    const barra = el("div", { class: "def-corrente", "aria-live": "polite" });
    const grigliaDom = el("div", { class: "griglia-cv" });
    const input = el("input", { class: "input-nascosto", type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": "Inserisci lettera" });
    const tempo = el("span", { class: "tempo" });
    const info = el("span", { class: "info-partita" });
    const esito = el("div", { class: "esito", hidden: true });
    const listaO = el("ol", { class: "definizioni" });
    const listaV = el("ol", { class: "definizioni" });

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
      el("button", { class: "secondario", onclick: controlla }, "Controlla"),
      el("button", { class: "secondario", onclick: () => rivela("lettera") }, "Rivela lettera"),
      el("button", { class: "secondario", onclick: () => rivela("parola") }, "Rivela parola"),
      conferma("Soluzione", "Confermi? Mostra tutto", () => rivela("tutto")),
      conferma("Azzera", "Confermi? Cancella", azzera),
      E.puoStampare ? E.pdf.menuPdf(o => E.pdf.pdfCruciverba(S, Object.assign(o, infoPdf()))) : null
    );

    // Dimensione del testo delle definizioni (barra in alto ed elenchi), da 1 a 5.
    let scala = E.memoria.leggi("cruciverba:scala", 2);
    const misura = el("span", { class: "misura-testo" });
    const applicaScala = () => {
      gioco.style.setProperty("--scala", String([0.9, 1, 1.15, 1.32, 1.55][scala - 1]));
      misura.textContent = "Testo " + scala + "/5";
      gioco.toggleAttribute("data-grande", scala >= 4);
      E.memoria.scrivi("cruciverba:scala", scala);
    };
    const zoom = el("span", { class: "zoom", role: "group", "aria-label": "Dimensione delle definizioni" },
      el("button", { class: "secondario", "aria-label": "Rimpicciolisci le definizioni", onclick: () => { scala = Math.max(1, scala - 1); applicaScala(); } }, "A−"),
      misura,
      el("button", { class: "secondario", "aria-label": "Ingrandisci le definizioni", onclick: () => { scala = Math.min(5, scala + 1); applicaScala(); } }, "A+"));

    const gioco = el("section", { class: "partita-cv" },
      el("div", { class: "colonna-griglia" },
        el("div", { class: "testata-partita" }, info, zoom, tempo),
        barra, el("div", { class: "contenitore-griglia" }, grigliaDom, input), esito, strumenti),
      el("div", { class: "colonna-definizioni" },
        el("div", { class: "blocco-def" }, el("h3", null, "Orizzontali"), listaO),
        el("div", { class: "blocco-def" }, el("h3", null, "Verticali"), listaV))
    );

    radice.append(pannello, gioco);
    disegnaChips(); disegnaLivelli(); applicaScala();

    /* Logica */
    function nuovo() {
      btnNuovo.disabled = true; btnNuovo.textContent = "Sto componendo lo schema…";
      setTimeout(() => {
        const p = genera(pref.materie, pref.escluse, pref.livello, pref.incroci, campoParola.value.trim());
        btnNuovo.disabled = false; btnNuovo.textContent = "Nuovo cruciverba";
        if (p && p.errore) { E.avviso(p.errore, "errore"); return; }
        if (!p) { E.avviso("Parole insufficienti per questa scelta: aggiungi materie o abbassa il livello.", "errore"); return; }
        S = p; salva(); avvia();
      }, 30);
    }

    function salva() { if (S) { S.secondi = timer ? timer.secondi : S.secondi; E.memoria.scrivi("cruciverba:corrente", S); } }
    const k = (r, c) => r * S.colonne + c;
    const isLettera = (r, c) => r >= 0 && c >= 0 && r < S.righe && c < S.colonne && S.soluzione[k(r, c)] !== null;

    function parolaDi(r, c, oriz) {
      return S.parole.find(p => p.oriz === oriz &&
        (oriz ? p.r === r && c >= p.c && c < p.c + p.len : p.c === c && r >= p.r && r < p.r + p.len));
    }
    const celleParola = p => Array.from({ length: p.len }, (_, i) => p.oriz ? [p.r, p.c + i] : [p.r + i, p.c]);

    function avvia() {
      if (timer) timer.ferma();
      timer = E.cronometro(tempo, S.secondi, s => { if (s % 5 === 0) salva(); });
      const lv = LIVELLI[S.livello - 1];
      const nomi = S.etichetta || "Misto";
      info.textContent = "Livello " + lv.n + " · " + lv.nome + " · " + nomi;
      esito.hidden = true;

      grigliaDom.style.setProperty("--colonne", S.colonne);
      grigliaDom.style.setProperty("--righe", S.righe);
      grigliaDom.innerHTML = "";
      celleDom = S.soluzione.map((v, i) => {
        const r = Math.floor(i / S.colonne), c = i % S.colonne;
        if (v === null) { const n = el("div", { class: "cella nera", "aria-hidden": "true" }); grigliaDom.append(n); return n; }
        const n = el("div", { class: "cella", "data-r": r, "data-c": c },
          S.numeri[i] ? el("span", { class: "num" }, String(S.numeri[i])) : null,
          el("span", { class: "lettera" }));
        n.addEventListener("pointerdown", e => { e.preventDefault(); clicCella(r, c); });
        grigliaDom.append(n);
        return n;
      });

      const voce = p => {
        const li = el("li", { "data-num": p.num, onclick: () => { sel = { r: p.r, c: p.c, oriz: p.oriz }; primaVuota(p); aggiorna(); input.focus({ preventScroll: true }); } },
          el("b", null, String(p.num)), el("span", null, p.def,
            lv.materia && S.materie.length !== 1 ? el("em", { class: "tag-materia" }, E.nomeMateria(p.materia)) : null));
        liDi.set(p, li);
        return li;
      };
      listaO.innerHTML = ""; listaV.innerHTML = "";
      S.parole.filter(p => p.oriz).sort((a, b) => a.num - b.num).forEach(p => listaO.append(voce(p)));
      S.parole.filter(p => !p.oriz).sort((a, b) => a.num - b.num).forEach(p => listaV.append(voce(p)));

      const prima = S.parole.find(p => p.oriz) || S.parole[0];
      sel = { r: prima.r, c: prima.c, oriz: prima.oriz };
      disegnaLettere(); aggiorna();
      if (S.completato) mostraEsito(); else timer.avvia();
    }

    function primaVuota(p) {
      const v = celleParola(p).find(([r, c]) => !S.inserite[k(r, c)]);
      if (v) { sel.r = v[0]; sel.c = v[1]; }
    }

    function clicCella(r, c) {
      if (sel.r === r && sel.c === c) {
        if (parolaDi(r, c, !sel.oriz)) sel.oriz = !sel.oriz;
      } else {
        sel.r = r; sel.c = c;
        if (!parolaDi(r, c, sel.oriz)) sel.oriz = !sel.oriz;
      }
      aggiorna();
      input.focus({ preventScroll: true });
    }

    function disegnaLettere() {
      S.soluzione.forEach((v, i) => {
        if (v === null) return;
        const n = celleDom[i];
        n.querySelector(".lettera").textContent = S.inserite[i] || "";
        n.classList.toggle("rivelata", S.rivelate.includes(i));
      });
      S.parole.forEach(p => liDi.has(p) && liDi.get(p).classList.toggle("fatta", celleParola(p).every(([r, c]) => S.inserite[k(r, c)])));
    }

    function aggiorna() {
      celleDom.forEach(n => n.classList.remove("attiva", "cursore"));
      S.parole.forEach(p => liDi.has(p) && liDi.get(p).classList.remove("attiva", "incrocio"));
      const p = parolaDi(sel.r, sel.c, sel.oriz) || parolaDi(sel.r, sel.c, !sel.oriz);
      if (!p) return;
      sel.oriz = p.oriz;
      celleParola(p).forEach(([r, c]) => celleDom[k(r, c)].classList.add("attiva"));
      celleDom[k(sel.r, sel.c)].classList.add("cursore");
      liDi.get(p).classList.add("attiva");
      const altra = parolaDi(sel.r, sel.c, !sel.oriz);
      if (altra) liDi.get(altra).classList.add("incrocio");
      scorriIn(liDi.get(p));
      barra.innerHTML = "";
      barra.append(el("b", null, p.num + (p.oriz ? " orizz." : " vert.")), " ", p.def);
    }

    function scorriIn(li) {
      const box = li.parentElement;
      if (!box || box.scrollHeight <= box.clientHeight) return;
      const top = li.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top + li.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top - box.clientHeight / 3;
    }

    function scrivi(lettera) {
      if (S.completato) return;
      const i = k(sel.r, sel.c);
      if (S.rivelate.includes(i)) { avanza(1); return; }
      S.inserite[i] = lettera;
      celleDom[i].classList.remove("errata");
      disegnaLettere();
      avanza(1);
      verificaFine();
      salva();
    }

    function avanza(d) {
      const p = parolaDi(sel.r, sel.c, sel.oriz);
      if (!p) return;
      const dr = sel.oriz ? 0 : d, dc = sel.oriz ? d : 0;
      const r = sel.r + dr, c = sel.c + dc;
      if (isLettera(r, c) && parolaDi(r, c, sel.oriz) === p) { sel.r = r; sel.c = c; }
      else if (d > 0) prossimaParola(1);
      aggiorna();
    }

    function prossimaParola(d) {
      const ord = S.parole.slice().sort((a, b) => (a.oriz === b.oriz ? a.num - b.num : a.oriz ? -1 : 1));
      const p = parolaDi(sel.r, sel.c, sel.oriz);
      let i = ord.indexOf(p);
      for (let t = 0; t < ord.length; t++) {
        i = (i + d + ord.length) % ord.length;
        const q = ord[i];
        if (celleParola(q).some(([r, c]) => !S.inserite[k(r, c)]) || t === ord.length - 1) {
          sel = { r: q.r, c: q.c, oriz: q.oriz }; primaVuota(q); break;
        }
      }
      aggiorna();
    }

    function muovi(dr, dc) {
      let r = sel.r + dr, c = sel.c + dc;
      while (r >= 0 && c >= 0 && r < S.righe && c < S.colonne) {
        if (isLettera(r, c)) {
          sel.r = r; sel.c = c;
          const vuoleOriz = dc !== 0;
          if (parolaDi(r, c, vuoleOriz)) sel.oriz = vuoleOriz;
          aggiorna(); return;
        }
        r += dr; c += dc;
      }
    }

    input.addEventListener("keydown", e => {
      if (!S) return;
      const mappa = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
      if (mappa[e.key]) { e.preventDefault(); muovi(...mappa[e.key]); return; }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (S.completato) return;
        const i = k(sel.r, sel.c);
        if (S.inserite[i] && !S.rivelate.includes(i)) S.inserite[i] = "";
        else if (e.key === "Backspace") {
          avanza(-1);
          const j = k(sel.r, sel.c);
          if (!S.rivelate.includes(j)) S.inserite[j] = "";
        }
        celleDom[k(sel.r, sel.c)].classList.remove("errata");
        disegnaLettere(); aggiorna(); salva();
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); prossimaParola(e.shiftKey ? -1 : 1); return; }
      if (e.key === " ") { e.preventDefault(); if (parolaDi(sel.r, sel.c, !sel.oriz)) { sel.oriz = !sel.oriz; aggiorna(); } return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const l = E.normalizza(e.key).replace(/ /g, "");
        e.preventDefault();
        if (l) scrivi(l);
      }
    });
    // Tastiere virtuali che non comunicano il tasto premuto.
    input.addEventListener("input", () => {
      const lettere = E.normalizza(input.value).replace(/ /g, "");
      input.value = "";
      for (const l of lettere) scrivi(l);
    });

    function controlla() {
      let errori = 0, vuote = 0;
      S.soluzione.forEach((v, i) => {
        if (v === null) return;
        if (!S.inserite[i]) { vuote++; return; }
        const sbagliata = S.inserite[i] !== v;
        celleDom[i].classList.toggle("errata", sbagliata);
        if (sbagliata) errori++;
      });
      S.aiuti++; salva();
      E.avviso(errori ? errori + (errori === 1 ? " lettera sbagliata" : " lettere sbagliate") + " (in rosso)"
        : vuote ? "Finora tutto giusto! Mancano " + vuote + " caselle" : "Tutto giusto!", errori ? "errore" : "ok");
    }

    function rivela(cosa) {
      if (S.completato) return;
      let celle = [];
      if (cosa === "lettera") celle = [[sel.r, sel.c]];
      else if (cosa === "parola") { const p = parolaDi(sel.r, sel.c, sel.oriz); if (p) celle = celleParola(p); }
      else S.soluzione.forEach((v, i) => { if (v !== null) celle.push([Math.floor(i / S.colonne), i % S.colonne]); });
      celle.forEach(([r, c]) => {
        const i = k(r, c);
        if (S.inserite[i] !== S.soluzione[i]) { S.inserite[i] = S.soluzione[i]; if (!S.rivelate.includes(i)) S.rivelate.push(i); }
        celleDom[i].classList.remove("errata");
      });
      S.aiuti += cosa === "tutto" ? 0 : 1;
      if (cosa === "tutto") S.arreso = true;
      disegnaLettere(); verificaFine(); salva();
    }

    function azzera() {
      S.inserite = S.soluzione.map(v => (v === null ? null : ""));
      S.rivelate = []; S.aiuti = 0; S.completato = false; S.arreso = false; S.secondi = 0;
      celleDom.forEach(n => n.classList.remove("errata"));
      salva(); avvia();
    }

    function verificaFine() {
      const fatto = S.soluzione.every((v, i) => v === null || S.inserite[i] === v);
      if (!fatto || S.completato) return;
      S.completato = true;
      timer.ferma();
      S.secondi = timer.secondi;
      if (!S.arreso) {
        const st = E.memoria.leggi("stat:cruciverba", {});
        const s = st[S.livello] || (st[S.livello] = { risolti: 0, migliore: null });
        s.risolti++;
        if (!S.aiuti && (s.migliore == null || S.secondi < s.migliore)) s.migliore = S.secondi;
        E.memoria.scrivi("stat:cruciverba", st);
      }
      salva(); mostraEsito();
    }

    function mostraEsito() {
      esito.hidden = false;
      esito.innerHTML = "";
      esito.append(
        el("strong", null, S.arreso ? "Soluzione mostrata" : "Cruciverba risolto!"),
        el("span", null, S.arreso ? "Prova con un nuovo schema." :
          "Tempo " + timer.fmt(S.secondi) + " · " + (S.aiuti ? S.aiuti + (S.aiuti === 1 ? " aiuto" : " aiuti") : "senza aiuti")),
        el("button", { class: "primario", onclick: nuovo }, "Nuovo cruciverba"));
    }

    function infoPdf() {
      const lv = LIVELLI[S.livello - 1], mio = S.materie[0] === "mie";
      return { titolo: mio && S.etichetta ? S.etichetta : "Cruciverba", sottotitolo: mio ? "Nome ______________________" : "Livello " + lv.n + " · " + lv.nome + " · " + (S.etichetta || "Misto") };
    }

    function stampa(conSoluzione) {
      const area = document.getElementById("area-stampa");
      area.innerHTML = "";
      const lv = LIVELLI[S.livello - 1];
      const g = el("div", { class: "griglia-stampa", style: "--colonne:" + S.colonne });
      S.soluzione.forEach((v, i) => g.append(v === null ? el("div", { class: "nera" }) :
        el("div", null, S.numeri[i] ? el("span", null, String(S.numeri[i])) : null, conSoluzione ? el("b", null, v) : null)));
      const lista = oriz => el("ol", null, S.parole.filter(p => p.oriz === oriz).sort((a, b) => a.num - b.num)
        .map(p => el("li", null, el("b", null, p.num + ". "), p.def)));
      area.append(
        el("h1", null, "Cruciverba" + (conSoluzione ? " — soluzione" : "")),
        el("p", null, "Livello " + lv.n + " (" + lv.nome + ") · " + (S.etichetta || "Misto")),
        g,
        el("div", { class: "def-stampa" }, el("div", null, el("h2", null, "Orizzontali"), lista(true)), el("div", null, el("h2", null, "Verticali"), lista(false))));
      window.print();
    }

    document.addEventListener("visibilitychange", salva);
    if (S && S.parole && S.parole.length) avvia(); else nuovo();

    return { smonta() { if (timer) timer.ferma(); salva(); document.removeEventListener("visibilitychange", salva); } };
  }

  E.registraGioco({
    id: "cruciverba",
    nome: "Cruciverba",
    descrizione: "Schemi sempre nuovi, per materia o misti, con definizioni dalla più facile alla più enigmatica.",
    monta
  });
  E._cruciverba = { genera, tentativo, materieScelte, LIVELLI };
})();
