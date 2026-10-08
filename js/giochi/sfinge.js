/* Sfinge: i giochi dell'enigmistica classica (zeppe, aggiunte, cambi, sciarade, anagrammi, bifronti)
   costruiti con le coppie di data/sfinge/ e le definizioni dell'archivio del cruciverba. */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  const TIPI = [
    { id: "zeppe",     nome: "Zeppe e scarti" },
    { id: "aggiunte",  nome: "Aggiunte ed elisioni" },
    { id: "cambi",     nome: "Cambi di lettera" },
    { id: "sciarade",  nome: "Sciarade" },
    { id: "anagrammi", nome: "Anagrammi" },
    { id: "bifronti",  nome: "Bifronti e palindromi" }
  ];
  // noto: notorietà massima delle parole; def: definizione di partenza (0 facile, 1 media, 2 difficile).
  const LIVELLI = [
    { n: 1, nome: "Principiante", noto: 1, def: 0, iniziali: true,  giochi: 8 },
    { n: 2, nome: "Facile",       noto: 2, def: 0, iniziali: false, giochi: 10 },
    { n: 3, nome: "Medio",        noto: 2, def: 1, iniziali: false, giochi: 10 },
    { n: 4, nome: "Difficile",    noto: 3, def: 1, iniziali: false, giochi: 10 },
    { n: 5, nome: "Esperto",      noto: 3, def: 2, iniziali: false, giochi: 10 }
  ];
  const scegli = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- Parole per i giochi di parole ---------- */

  // Indice parola → voci dell'archivio (preferendo le materie italiane), costruito al primo uso.
  let indice = null;
  function voceDi(r) {
    if (!indice) {
      indice = new Map();
      for (const v of E.voci()) {
        if (v.nParole !== 1) continue;
        const l = indice.get(v.r) || indice.set(v.r, []).get(v.r);
        if (v.materia === "inglese") l.push(v); else l.unshift(v);
      }
    }
    return indice.get(r) || [];
  }
  const notoDi = r => Math.min(...voceDi(r).map(v => v.noto), 9);
  const escluse = () => new Set(E.enigmi.escluse || []);
  // Parola adatta ai giochi di parole: nell'archivio fuori dall'inglese, non sigla, con una vocale, non esclusa.
  function buona(r, esc) {
    const vv = voceDi(r);
    return r.length >= 3 && /[AEIOU]/.test(r) && !(esc || escluse()).has(r) && vv.some(v => v.materia !== "inglese") &&
      !vv.some(v => v.def.flat().some(d => /\bsigla|abbreviaz|acronimo/i.test(d)));
  }

  // Una definizione della parola al livello chiesto (o più facile), che non nomini le altre parole del gioco.
  function definizione(r, livello, altre) {
    const vv = voceDi(r).filter(v => v.materia !== "inglese");
    const vietate = altre.filter(a => a !== r && a.length >= 3);
    for (let i = livello; i >= 0; i--) {
      const buone = vv.flatMap(v => v.def[i]).filter(d => !vietate.some(a => E.normalizza(d).replace(/ /g, "").includes(a)));
      if (buone.length) return scegli(buone);
    }
    for (let i = livello + 1; i < 3; i++) {
      const buone = vv.flatMap(v => v.def[i]).filter(d => !vietate.some(a => E.normalizza(d).replace(/ /g, "").includes(a)));
      if (buone.length) return scegli(buone);
    }
    return null;
  }

  /* ---------- Costruzione dei giochi ---------- */

  // Dalla voce dei dati al gioco: nome, schema delle lunghezze, parole nell'ordine in cui si risolvono.
  function enigma(tipo, dato) {
    const lung = a => a.map(w => w.length);
    if (tipo === "zeppe") {
      const [c, l] = dato, zeppa = Math.random() < 0.6;
      return zeppa ? { nome: "Zeppa", regola: "Aggiungi una lettera all'interno della prima parola.", parole: [c, l], schema: lung([c, l]).join(" → ") }
        : { nome: "Scarto", regola: "Togli una lettera dall'interno della prima parola.", parole: [l, c], schema: lung([l, c]).join(" → ") };
    }
    if (tipo === "aggiunte") {
      const [c, l] = dato, dove = l.slice(1) === c ? "iniziale" : "finale", aggiunta = Math.random() < 0.6;
      return aggiunta ? { nome: "Aggiunta " + dove, regola: "Aggiungi una lettera " + (dove === "iniziale" ? "all'inizio" : "alla fine") + " della prima parola.", parole: [c, l], schema: lung([c, l]).join(" → ") }
        : { nome: "Elisione " + dove, regola: "Togli la " + (dove === "iniziale" ? "prima" : "ultima") + " lettera della prima parola.", parole: [l, c], schema: lung([l, c]).join(" → ") };
    }
    if (tipo === "cambi") {
      const p = E.mescola(dato.slice());
      return { nome: "Cambio di lettera", regola: "Cambia una sola lettera della prima parola.", parole: p, schema: String(p[0].length) };
    }
    if (tipo === "sciarade") return { nome: "Sciarada", regola: "Le prime due parole, unite, formano la terza.", parole: dato.slice(), schema: dato[0].length + " + " + dato[1].length + " = " + dato[2].length };
    if (tipo === "anagrammi") {
      const p = E.mescola(dato.slice()).slice(0, 2);
      return { nome: "Anagramma", regola: "Con le stesse lettere della prima parola, in un altro ordine, forma la seconda.", parole: p, schema: String(p[0].length) };
    }
    if (dato.length === 1) return { nome: "Palindromo", regola: "Una parola che si legge uguale nei due sensi.", parole: dato.slice(), schema: String(dato[0].length) };
    const p = E.mescola(dato.slice());
    return { nome: "Bifronte", regola: "La seconda parola è la prima letta al contrario.", parole: p, schema: p[0].length + " ↔ " + p[1].length };
  }

  function genera(tipi, livello, squadre) {
    const lv = LIVELLI[livello - 1], esc = escluse();
    const viste = new Set(E.memoria.leggi("sfinge:viste", []));
    const chiave = (tipo, d) => tipo + ":" + d.join("/");
    const candidati = noto => tipi.flatMap(tipo => (E.enigmi[tipo] || []).map(d => ({ tipo, d })))
      .filter(x => x.d.every(w => buona(w, esc) && notoDi(w) <= noto));
    let pool = candidati(lv.noto);
    if (pool.length < lv.giochi * 2) pool = candidati(3);
    if (!pool.length) return null;
    // Si alternano i tipi scelti, preferendo i giochi non ancora visti.
    const perTipo = tipi.map(t => E.mescola(pool.filter(x => x.tipo === t)).sort((a, b) => viste.has(chiave(a.tipo, a.d)) - viste.has(chiave(b.tipo, b.d)))).filter(l => l.length);
    const scelti = [];
    for (let i = 0; scelti.length < lv.giochi && perTipo.some(l => l.length); i++) {
      const l = perTipo[i % perTipo.length];
      if (!l.length) continue;
      const x = l.shift(), g = enigma(x.tipo, x.d);
      const defs = g.parole.map(w => [0, 1, 2].map(i => definizione(w, i, g.parole)));
      if (defs.some(d => !d[lv.def] && !d[0])) continue;
      scelti.push(Object.assign(g, { tipo: x.tipo, chiave: chiave(x.tipo, x.d), defs, indizi: 0, risolte: g.parole.map(() => false), stato: "aperto", punti: 0 }));
    }
    if (!scelti.length) return null;
    E.memoria.scrivi("sfinge:viste", [...viste].concat(scelti.map(g => g.chiave)).slice(-600));
    return { livello: lv.n, tipi: tipi.slice(), squadre, giochi: E.mescola(scelti), i: 0, punteggi: new Array(squadre).fill(0), completato: false };
  }

  /* ---------- Interfaccia ---------- */

  function monta(radice) {
    const pref = Object.assign({ tipi: TIPI.map(t => t.id), livello: 2, squadre: 1 }, E.memoria.leggi("sfinge:pref", {}));
    let S = E.memoria.leggi("sfinge:corrente", null);
    const salvaPref = () => E.memoria.scrivi("sfinge:pref", pref);
    const salva = () => { if (S) E.memoria.scrivi("sfinge:corrente", S); };

    const chips = el("div", { class: "chips", role: "group", "aria-label": "Tipi di gioco" });
    function disegnaChips() {
      chips.innerHTML = "";
      for (const t of TIPI) {
        const n = (E.enigmi[t.id] || []).length;
        if (!n) continue;
        const on = pref.tipi.includes(t.id);
        chips.append(el("button", { class: "chip" + (on ? " on" : ""), "aria-pressed": String(on), onclick: () => {
          pref.tipi = on ? pref.tipi.filter(x => x !== t.id) : pref.tipi.concat(t.id);
          if (!pref.tipi.length) pref.tipi = [t.id];
          salvaPref(); disegnaChips();
        } }, el("span", { class: "segno-chip", "aria-hidden": "true" }, on ? "✓" : ""), t.nome, el("small", null, String(n))));
      }
    }
    const livelli = el("div", { class: "livelli", role: "radiogroup", "aria-label": "Livello" });
    function disegnaLivelli() {
      livelli.innerHTML = "";
      LIVELLI.forEach(l => livelli.append(el("button", { class: "livello" + (pref.livello === l.n ? " on" : ""), role: "radio", "aria-checked": String(pref.livello === l.n),
        onclick: () => { pref.livello = l.n; salvaPref(); disegnaLivelli(); } }, el("b", null, String(l.n)), el("span", null, l.nome))));
    }
    const sceltaSquadre = el("div", { class: "livelli squadre-ig", role: "radiogroup", "aria-label": "Giocatori" });
    function disegnaSquadre() {
      sceltaSquadre.innerHTML = "";
      [1, 2, 3, 4].forEach(n => sceltaSquadre.append(el("button", { class: "livello" + (pref.squadre === n ? " on" : ""), role: "radio", "aria-checked": String(pref.squadre === n),
        onclick: () => { pref.squadre = n; salvaPref(); disegnaSquadre(); } }, el("b", null, String(n)), el("span", null, n === 1 ? "da solo" : "squadre"))));
    }
    const btnNuovo = el("button", { class: "primario", onclick: nuovo }, "Nuova partita");
    const pannello = el("details", { class: "impostazioni", open: window.innerWidth > 900 && !(S && S.giochi && !S.completato) },
      el("summary", null, "Giochi, livello e giocatori"), el("div", { class: "corpo-imp" },
        el("div", { class: "riga-imp" }, el("h3", null, "Giochi")), chips,
        el("div", { class: "riga-imp" }, el("h3", null, "Livello")), livelli,
        el("div", { class: "riga-imp" }, el("h3", null, "Giocatori")), sceltaSquadre,
        el("p", { class: "suggerimento" }, "Ogni gioco vale 3 punti; ogni indizio ne toglie uno. Le definizioni vengono dall'archivio del cruciverba."),
        el("div", { class: "azioni-imp" }, btnNuovo)));

    const info = el("span", { class: "info-partita" }), punteggio = el("span", { class: "tempo" });
    const tabellone = el("div", { class: "tabellone-ig" });
    const carta = el("div", { class: "carta-ig carta-sf", "aria-live": "polite" });
    const fine = el("div", { class: "fine-ig", hidden: true });
    let dimensione = E.memoria.leggi("sfinge:scala", 2);
    const partita = el("section", { class: "partita-ig" }, el("div", { class: "testata-partita" }, info, punteggio), tabellone, carta, fine);
    const applicaScala = () => { partita.style.setProperty("--scala", String([0.9, 1, 1.15, 1.32, 1.55][dimensione - 1])); E.memoria.scrivi("sfinge:scala", dimensione); };
    radice.append(pannello, partita);
    disegnaChips(); disegnaLivelli(); disegnaSquadre(); applicaScala();

    const nomeSquadra = i => "Squadra " + (i + 1);
    const etichettaTipi = tipi => tipi.length === TIPI.length ? "Tutti i giochi" : tipi.map(t => TIPI.find(x => x.id === t).nome).join(", ");
    // Definizione mostrata: quella del livello, o più facile dopo il primo indizio.
    const defMostrata = (g, j) => {
      const lv = LIVELLI[S.livello - 1], i = g.facili ? 0 : lv.def;
      return g.defs[j][i] || g.defs[j].find(Boolean);
    };

    function nuovo() {
      const p = genera(pref.tipi, pref.livello, pref.squadre);
      if (!p) { E.avviso("Non ci sono abbastanza giochi per questa scelta: aggiungi tipi o cambia livello.", "errore"); return; }
      S = p; salva(); disegna();
      pannello.open = false;
    }

    function disegna() {
      const lv = LIVELLI[S.livello - 1], g = S.giochi[S.i];
      info.textContent = "Livello " + lv.n + " · " + lv.nome + " · " + etichettaTipi(S.tipi);
      punteggio.textContent = S.squadre > 1 ? "" : S.punteggi[0] + (S.punteggi[0] === 1 ? " punto" : " punti");
      tabellone.innerHTML = "";
      tabellone.hidden = S.squadre < 2;
      S.punteggi.forEach((p, i) => tabellone.append(el("span", { class: "squadra-ig" + (!S.completato && S.i % S.squadre === i ? " turno" : "") },
        el("span", null, nomeSquadra(i)), el("b", null, String(p)))));
      carta.hidden = S.completato; fine.hidden = !S.completato;
      if (S.completato) { disegnaFine(); return; }

      const aperto = g.stato === "aperto";
      const campi = [];
      const righe = g.parole.map((w, j) => {
        const fatta = g.risolte[j] || !aperto;
        const etichetta = g.tipo === "sciarade" ? ["Prima parte", "Seconda parte", "L'intero"][j] : g.parole.length === 1 ? "La parola" : ["Prima parola", "Seconda parola"][j];
        const campo = fatta ? null : el("input", { type: "text", class: "risposta-ig", autocomplete: "off", autocapitalize: "characters", spellcheck: "false",
          maxlength: String(w.length), "aria-label": etichetta, placeholder: (lv.iniziali || g.iniziali ? w[0] : "") + "·".repeat(w.length - (lv.iniziali || g.iniziali ? 1 : 0)),
          oninput: e => { if (E.normalizza(e.target.value).replace(/ /g, "").length === w.length) prova(j, e.target); },
          onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); prova(j, e.target); } } });
        if (campo) campi.push(campo);
        return el("li", { class: "riga-sf" + (g.risolte[j] ? " giusta" : !aperto ? " mostrata" : "") },
          el("small", null, etichetta + " (" + w.length + ")"),
          el("span", { class: "def-sf" }, defMostrata(g, j)),
          fatta ? el("b", { class: "parola-sf" }, w) : campo);
      });

      const azioni = aperto
        ? el("div", { class: "azioni-ig" },
          !g.iniziali && !lv.iniziali ? el("button", { class: "secondario", onclick: indizio }, !g.facili && lv.def > 0 ? "Definizioni più facili (−1)" : "Mostra le iniziali (−1)") : null,
          el("button", { class: "secondario", onclick: rivela }, "Rivela"))
        : el("div", { class: "azioni-ig" }, el("button", { class: "primario", onclick: avanti }, S.i + 1 < S.giochi.length ? "Gioco successivo" : "Vedi il risultato"));

      carta.innerHTML = "";
      carta.append(...[
        el("div", { class: "riga-carta" }, el("span", { class: "numero-ig" }, "Gioco " + (S.i + 1) + " di " + S.giochi.length +
          (S.squadre > 1 ? " · tocca alla " + nomeSquadra(S.i % S.squadre) : "")), el("em", { class: "tag-materia" }, TIPI.find(t => t.id === g.tipo).nome)),
        el("div", { class: "titolo-sf" }, el("strong", null, g.nome), el("span", null, "(" + g.schema + ")")),
        el("p", { class: "regola-sf" }, g.regola),
        el("ol", { class: "righe-sf" }, righe),
        aperto ? null : el("p", { class: "verdetto-ig " + (g.stato === "risolto" ? "ok" : "no") }, g.stato === "risolto"
          ? "Giusto! +" + g.punti + (g.punti === 1 ? " punto" : " punti") : "Ecco la soluzione"),
        azioni,
        el("div", { class: "zoom" },
          el("button", { class: "secondario", "aria-label": "Rimpicciolisci il testo", onclick: () => { dimensione = Math.max(1, dimensione - 1); applicaScala(); } }, "A−"),
          el("button", { class: "secondario", "aria-label": "Ingrandisci il testo", onclick: () => { dimensione = Math.min(5, dimensione + 1); applicaScala(); } }, "A+"))
      ].filter(Boolean));
      if (campi.length) campi[0].focus({ preventScroll: true });
      else azioni.querySelector("button").focus({ preventScroll: true });
    }

    function prova(j, campo) {
      const g = S.giochi[S.i], r = E.normalizza(campo.value).replace(/ /g, "");
      if (!r || g.stato !== "aperto") return;
      if (r !== g.parole[j]) {
        if (r.length === g.parole[j].length) {
          E.avviso("No, non è «" + r + "»", "errore");
          campo.value = ""; campo.classList.remove("scossa"); void campo.offsetWidth; campo.classList.add("scossa");
        }
        return;
      }
      g.risolte[j] = true;
      if (g.risolte.every(Boolean)) {
        g.stato = "risolto"; g.punti = Math.max(1, 3 - g.indizi);
        S.punteggi[S.i % S.squadre] += g.punti;
      }
      salva(); disegna();
    }
    // Primo indizio: definizioni più facili (se il livello non le usa già); poi le iniziali. Un punto ciascuno.
    function indizio() {
      const g = S.giochi[S.i];
      if (!g.facili && LIVELLI[S.livello - 1].def > 0) g.facili = true; else g.iniziali = true;
      g.indizi++; salva(); disegna();
    }
    function rivela() { const g = S.giochi[S.i]; g.stato = "rivelato"; g.punti = 0; salva(); disegna(); }
    function avanti() {
      if (S.i + 1 < S.giochi.length) S.i++;
      else {
        S.completato = true;
        const st = E.memoria.leggi("stat:sfinge", {});
        const s = st[S.livello] || (st[S.livello] = { risolti: 0, migliore: null });
        s.risolti++;
        if (S.squadre === 1 && (s.migliore == null || S.punteggi[0] > s.migliore)) s.migliore = S.punteggi[0];
        E.memoria.scrivi("stat:sfinge", st);
      }
      salva(); disegna();
    }

    function disegnaFine() {
      const max = S.giochi.length * 3, alto = Math.max(...S.punteggi);
      const vincitrici = S.punteggi.map((p, i) => p === alto ? nomeSquadra(i) : null).filter(Boolean);
      fine.innerHTML = "";
      fine.append(
        el("strong", { class: "titolo-fine" }, S.squadre === 1 ? S.punteggi[0] + " punti su " + max
          : vincitrici.length > 1 ? "Pareggio: " + vincitrici.join(" e ") : "Vince la " + vincitrici[0] + "!"),
        el("ol", { class: "riepilogo-ig" }, S.giochi.map((g, i) => el("li", { class: g.stato === "risolto" ? "" : "saltata" },
          el("b", null, g.nome + ": " + g.parole.join(g.tipo === "sciarade" ? " + " : " → ").replace(/ \+ (\w+)$/, " = $1")),
          el("span", null, (S.squadre > 1 ? nomeSquadra(i % S.squadre) + " · " : "") + (g.stato === "risolto" ? "+" + g.punti : "non risolto"))))),
        el("button", { class: "primario", onclick: nuovo }, "Nuova partita"));
    }

    if (S && S.giochi && S.giochi.length) disegna(); else nuovo();
    return { smonta() { salva(); } };
  }

  E.registraGioco({
    id: "sfinge",
    nome: "Sfinge",
    descrizione: "Zeppe, aggiunte, cambi di lettera, sciarade, anagrammi e bifronti: l'enigmistica classica, anche a squadre.",
    livelli: LIVELLI,
    misura: "punti",
    monta
  });
  E._sfinge = { genera, voceDi, notoDi, buona, definizione, escluse, TIPI, LIVELLI };
})();
