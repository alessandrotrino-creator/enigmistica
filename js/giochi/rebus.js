/* Rebus: figure (emoji) con lettere scritte sopra; i loro nomi, letti in ordine e raggruppati diversamente,
   danno la frase risolutiva. Archivio originale in data/rebus/ (figure.js, facili, medi, difficili). */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  // fonti: da quali archivi si pesca (1 facili, 2 medi, 3 difficili); nomi: i nomi delle figure si vedono subito.
  const LIVELLI = [
    { n: 1, nome: "Principiante", fonti: [1],    nomi: true,  rebus: 6 },
    { n: 2, nome: "Facile",       fonti: [1],    nomi: false, rebus: 6 },
    { n: 3, nome: "Medio",        fonti: [2],    nomi: false, rebus: 6 },
    { n: 4, nome: "Difficile",    fonti: [2, 3], nomi: false, rebus: 6 },
    { n: 5, nome: "Esperto",      fonti: [3],    nomi: false, rebus: 6 }
  ];
  const lettere = s => E.normalizza(s).replace(/ /g, "");

  // "s PERA NASO-n" → tessere [{ lettere: "S", figura: "PERA" }, { figura: "NASO", togli: "N" }], più eventuali
  // lettere finali. Minuscolo = lettere scritte sulla figura successiva; "-x" = lettera barrata da togliere dal nome.
  function tessere(lettura) {
    const out = [];
    let sospese = "";
    for (const t of lettura.trim().split(/\s+/)) {
      const m = /^([A-Z]+)(?:-([a-z]+))?$/.exec(t);
      if (m) { out.push({ lettere: sospese.toUpperCase(), figura: m[1], togli: (m[2] || "").toUpperCase() }); sospese = ""; }
      else sospese += t;
    }
    if (sospese) out.push({ lettere: sospese.toUpperCase(), figura: null, togli: "" });
    return out;
  }
  // Il nome della figura meno le lettere barrate (si toglie la prima occorrenza di ciascuna): ROSA − R → OSA.
  function letta(figura, togli) {
    let n = figura;
    for (const ch of togli || "") { const i = n.indexOf(ch); if (i >= 0) n = n.slice(0, i) + n.slice(i + 1); }
    return n;
  }
  const sequenza = l => tessere(l).map(t => t.lettere + (t.figura ? letta(t.figura, t.togli) : "")).join("");
  // Un rebus vale se le lettere tornano, se nessuna figura (letta) coincide con una parola intera della soluzione
  // e se non è fatto solo di figure intere accostate (PALLA MANO): sarebbero troppo facili.
  function valido(l, s, figure) {
    const tt = tessere(l);
    if (!tt.every(t => !t.figura || (figure[t.figura] && [...t.togli].every(ch => t.figura.includes(ch))))) return false;
    if (sequenza(l) !== lettere(s)) return false;
    const parole = new Set(E.normalizza(s.replace(/['’]/g, " ")).split(/\s+/));
    if (tt.some(t => t.figura && parole.has(letta(t.figura, t.togli)))) return false;
    return !tt.every(t => t.figura && !t.lettere && !t.togli);
  }
  const testoLettura = l => tessere(l).map(t => [t.lettere, t.figura ? t.figura + (t.togli ? " − " + t.togli : "") : ""].filter(Boolean).join(" ")).join(" ");
  // Lunghezze delle parole della soluzione ("L'arte" → 1, 4).
  const diagramma = sol => E.normalizza(sol.replace(/['’]/g, " ")).split(/\s+/).filter(Boolean).map(w => w.length);

  function genera(livello, squadre) {
    const lv = LIVELLI[livello - 1], A = E.archivioRebus;
    const viste = new Set(E.memoria.leggi("rebus:viste", []));
    const validi = lv.fonti.flatMap(f => (A.livelli[f] || []).map(([l, s]) => ({ l, s, f })))
      .filter(x => valido(x.l, x.s, A.figure));
    if (!validi.length) return null;
    const nuovi = E.mescola(validi.filter(x => !viste.has(x.s))), vecchi = E.mescola(validi.filter(x => viste.has(x.s)));
    // Nei livelli misti si mettono prima i più facili.
    const scelti = nuovi.concat(vecchi).slice(0, lv.rebus).sort((a, b) => a.f - b.f);
    E.memoria.scrivi("rebus:viste", [...viste].concat(scelti.map(x => x.s)).slice(-300));
    return { livello, squadre, i: 0, punteggi: new Array(squadre).fill(0), completato: false,
      giochi: scelti.map(x => ({ lettura: x.l, soluzione: x.s, nomi: lv.nomi, prima: false, indizi: 0, stato: "aperto", punti: 0 })) };
  }

  /* ---------- Interfaccia ---------- */

  function monta(radice) {
    const pref = Object.assign({ livello: 2, squadre: 1 }, E.memoria.leggi("rebus:pref", {}));
    let S = E.memoria.leggi("rebus:corrente", null);
    const salvaPref = () => E.memoria.scrivi("rebus:pref", pref);
    const salva = () => { if (S) E.memoria.scrivi("rebus:corrente", S); };

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
      el("summary", null, "Livello, giocatori e regole"), el("div", { class: "corpo-imp" },
        el("p", { class: "suggerimento" }, "Dai un nome a ogni figura e leggilo insieme alle lettere scritte sopra, nell'ordine; una lettera barrata va tolta dal nome (🌹 con R barrata si legge OSA). Le lettere che ottieni, divise in un altro modo, formano la frase risolutiva: i numeri dicono quante lettere ha ogni parola. Ogni rebus vale 3 punti, ogni indizio ne toglie uno."),
        el("div", { class: "riga-imp" }, el("h3", null, "Livello")), livelli,
        el("div", { class: "riga-imp" }, el("h3", null, "Giocatori")), sceltaSquadre,
        el("div", { class: "azioni-imp" }, btnNuovo)));

    const info = el("span", { class: "info-partita" }), punteggio = el("span", { class: "tempo" });
    const tabellone = el("div", { class: "tabellone-ig" });
    const carta = el("div", { class: "carta-ig carta-rb", "aria-live": "polite" });
    const fine = el("div", { class: "fine-ig", hidden: true });
    let dimensione = E.memoria.leggi("rebus:scala", 2);
    const partita = el("section", { class: "partita-ig" }, el("div", { class: "testata-partita" }, info, punteggio), tabellone, carta, fine);
    const applicaScala = () => { partita.style.setProperty("--scala", String([0.9, 1, 1.15, 1.32, 1.55][dimensione - 1])); E.memoria.scrivi("rebus:scala", dimensione); };
    radice.append(pannello, partita);
    disegnaLivelli(); disegnaSquadre(); applicaScala();

    const nomeSquadra = i => "Squadra " + (i + 1);
    const punti = n => n + (n === 1 ? " punto" : " punti");

    function nuovo() {
      const p = genera(pref.livello, pref.squadre);
      if (!p) { E.avviso("Nessun rebus disponibile per questo livello.", "errore"); return; }
      S = p; salva(); disegna();
      pannello.open = false;
    }

    function disegna() {
      const lv = LIVELLI[S.livello - 1], g = S.giochi[S.i], A = E.archivioRebus;
      info.textContent = "Livello " + lv.n + " · " + lv.nome;
      punteggio.textContent = S.squadre > 1 ? "" : punti(S.punteggi[0]);
      tabellone.innerHTML = "";
      tabellone.hidden = S.squadre < 2;
      S.punteggi.forEach((p, i) => tabellone.append(el("span", { class: "squadra-ig" + (!S.completato && S.i % S.squadre === i ? " turno" : "") },
        el("span", null, nomeSquadra(i)), el("b", null, String(p)))));
      carta.hidden = S.completato; fine.hidden = !S.completato;
      if (S.completato) { disegnaFine(); return; }

      const aperto = g.stato === "aperto", mostraNomi = g.nomi || !aperto;
      const figure = el("div", { class: "figure-rb" }, tessere(g.lettura).map(t => t.figura
        ? el("figure", { class: "tessera-rb" },
          // Sopra la figura: a sinistra le lettere da aggiungere, a destra quelle barrate da togliere.
          el("span", { class: "segni-rb" },
            t.lettere ? el("b", { class: "lettere-rb" }, t.lettere) : null,
            t.togli ? el("s", { class: "togli-rb", "aria-label": "togli " + t.togli }, t.togli) : null),
          el("span", { class: "emoji-rb", role: "img", "aria-label": mostraNomi ? t.figura.toLowerCase() : "figura" }, A.figure[t.figura]),
          el("figcaption", null, mostraNomi ? t.figura : " "))
        : el("figure", { class: "tessera-rb sole-lettere" }, el("span", { class: "segni-rb" }), el("b", { class: "lettere-rb" }, t.lettere), el("figcaption", null, " "))));
      const dia = diagramma(g.soluzione);
      const campo = aperto ? el("input", { type: "text", class: "risposta-ig", autocomplete: "off", autocapitalize: "characters", spellcheck: "false",
        "aria-label": "Frase risolutiva", placeholder: dia.map(n => "·".repeat(n)).join(" "),
        onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); prova(campo); } } }) : null;
      const azioni = aperto
        ? el("div", { class: "azioni-ig" },
          el("button", { class: "primario", onclick: () => prova(campo) }, "Prova"),
          !g.nomi ? el("button", { class: "secondario", onclick: () => { g.nomi = true; g.indizi++; salva(); disegna(); } }, "Nomi delle figure (−1)") : null,
          // La prima lettura svela anche i nomi delle figure: se non erano ancora visibili, costa due punti.
          !g.prima ? el("button", { class: "secondario", onclick: () => { if (!g.nomi) { g.nomi = true; g.indizi++; } g.prima = true; g.indizi++; salva(); disegna(); } }, "Prima lettura (" + (g.nomi ? "−1" : "−2") + ")") : null,
          el("button", { class: "secondario", onclick: rivela }, "Rivela"))
        : el("div", { class: "azioni-ig" }, el("button", { class: "primario", onclick: avanti }, S.i + 1 < S.giochi.length ? "Rebus successivo" : "Vedi il risultato"));

      carta.innerHTML = "";
      carta.append(...[
        el("div", { class: "riga-carta" }, el("span", { class: "numero-ig" }, "Rebus " + (S.i + 1) + " di " + S.giochi.length +
          (S.squadre > 1 ? " · tocca alla " + nomeSquadra(S.i % S.squadre) : "")), el("em", { class: "tag-materia" }, "Frase: " + dia.join(", "))),
        figure,
        g.prima || !aperto ? el("p", { class: "lettura-rb" }, el("small", null, "Prima lettura"), testoLettura(g.lettura)) : null,
        aperto ? el("div", { class: "riga-risposta" }, campo)
          : el("p", { class: "verdetto-ig " + (g.stato === "risolto" ? "ok" : "no") }, g.stato === "risolto" ? "Giusto! +" + punti(g.punti) + ": " : "Soluzione: ", el("span", { class: "soluzione-rb" }, g.soluzione)),
        azioni,
        el("div", { class: "zoom" },
          el("button", { class: "secondario", "aria-label": "Rimpicciolisci", onclick: () => { dimensione = Math.max(1, dimensione - 1); applicaScala(); } }, "A−"),
          el("button", { class: "secondario", "aria-label": "Ingrandisci", onclick: () => { dimensione = Math.min(5, dimensione + 1); applicaScala(); } }, "A+"))
      ].filter(Boolean));
      (campo || azioni.querySelector("button")).focus({ preventScroll: true });
    }

    function prova(campo) {
      const g = S.giochi[S.i], r = lettere(campo.value.replace(/['’]/g, ""));
      if (!r) return;
      if (r !== lettere(g.soluzione.replace(/['’]/g, ""))) {
        E.avviso("Non è la soluzione: riprova", "errore");
        campo.classList.remove("scossa"); void campo.offsetWidth; campo.classList.add("scossa");
        return;
      }
      g.stato = "risolto"; g.punti = Math.max(1, 3 - g.indizi);
      S.punteggi[S.i % S.squadre] += g.punti;
      salva(); disegna();
    }
    function rivela() { const g = S.giochi[S.i]; g.stato = "rivelato"; g.punti = 0; salva(); disegna(); }
    function avanti() {
      if (S.i + 1 < S.giochi.length) S.i++;
      else {
        S.completato = true;
        const st = E.memoria.leggi("stat:rebus", {});
        const s = st[S.livello] || (st[S.livello] = { risolti: 0, migliore: null });
        s.risolti++;
        if (S.squadre === 1 && (s.migliore == null || S.punteggi[0] > s.migliore)) s.migliore = S.punteggi[0];
        E.memoria.scrivi("stat:rebus", st);
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
          el("b", null, g.soluzione),
          el("span", null, (S.squadre > 1 ? nomeSquadra(i % S.squadre) + " · " : "") + (g.stato === "risolto" ? "+" + g.punti : "non risolto"))))),
        el("button", { class: "primario", onclick: nuovo }, "Nuova partita"));
    }

    if (S && S.giochi && S.giochi.length) disegna(); else nuovo();
    return { smonta() { salva(); } };
  }

  E.registraGioco({
    id: "rebus",
    nome: "Rebus",
    descrizione: "Figure e lettere da leggere in ordine: le stesse lettere, divise in un altro modo, danno la frase.",
    livelli: LIVELLI,
    misura: "punti",
    monta
  });
  E._rebus = { genera, tessere, letta, sequenza, valido, diagramma, LIVELLI };
})();
