/* Indovina la parola: tre indizi dal più difficile al più facile; meno indizi servono, più punti si fanno. */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  // noto: notorietà ammessa [minima, massima]; iniziale: si vede la prima lettera; parole: quante per partita.
  const LIVELLI = [
    { n: 1, nome: "Principiante", noto: [1, 1], iniziale: true,  parole: 8 },
    { n: 2, nome: "Facile",       noto: [1, 2], iniziale: true,  parole: 10 },
    { n: 3, nome: "Medio",        noto: [1, 2], iniziale: false, parole: 10 },
    { n: 4, nome: "Difficile",    noto: [2, 3], iniziale: false, parole: 10 },
    { n: 5, nome: "Esperto",      noto: [3, 3], iniziale: false, parole: 10 }
  ];
  const NOMI_INDIZI = ["difficile", "medio", "facile"];
  const scegli = a => a[Math.floor(Math.random() * a.length)];

  function genera(materie, livello, squadre) {
    const lv = LIVELLI[livello - 1];
    const viste = new Set(E.memoria.leggi("indovina:viste", []));
    const adatte = E.voci(materie).filter(v => v.def.every(d => d.length) && v.r.length >= 3 && v.r.length <= 16);
    let pool = adatte.filter(v => v.noto >= lv.noto[0] && v.noto <= lv.noto[1]);
    if (pool.length < lv.parole * 2) pool = adatte.filter(v => v.noto <= lv.noto[1]);
    if (pool.length < lv.parole) return null;
    const nuove = pool.filter(v => !viste.has(v.r));
    const scelte = E.mescola(nuove.length >= lv.parole ? nuove : pool.slice()).slice(0, lv.parole);
    E.memoria.scrivi("indovina:viste", [...viste].concat(scelte.map(v => v.r)).slice(-400));
    return {
      livello: lv.n, materie: materie.slice(), squadre,
      turni: scelte.map(v => ({ r: v.r, testo: v.testo, materia: v.materia,
        indizi: [scegli(v.def[2]), scegli(v.def[1]), scegli(v.def[0])], visti: 1, stato: "aperta", punti: 0, tentativi: 0 })),
      i: 0, punteggi: new Array(squadre).fill(0), completato: false, creato: Date.now()
    };
  }

  /* ---------- Interfaccia ---------- */

  function monta(radice) {
    const pref = Object.assign({ materie: [], livello: 2, squadre: 1 }, E.memoria.leggi("indovina:pref", {}));
    let S = E.memoria.leggi("indovina:corrente", null);
    const salvaPref = () => E.memoria.scrivi("indovina:pref", pref);
    const salva = () => { if (S) E.memoria.scrivi("indovina:corrente", S); };

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
    const sceltaSquadre = el("div", { class: "livelli squadre-ig", role: "radiogroup", "aria-label": "Giocatori" });
    function disegnaSquadre() {
      sceltaSquadre.innerHTML = "";
      [1, 2, 3, 4].forEach(n => sceltaSquadre.append(el("button", { class: "livello" + (pref.squadre === n ? " on" : ""), role: "radio", "aria-checked": String(pref.squadre === n),
        onclick: () => { pref.squadre = n; salvaPref(); disegnaSquadre(); } }, el("b", null, String(n)), el("span", null, n === 1 ? "da solo" : "squadre"))));
    }
    const btnNuovo = el("button", { class: "primario", onclick: nuovo }, "Nuova partita");
    const pannello = el("details", { class: "impostazioni", open: window.innerWidth > 900 && !(S && S.turni && !S.completato) },
      el("summary", null, "Materie, livello e giocatori"), el("div", { class: "corpo-imp" },
        el("div", { class: "riga-imp" }, el("h3", null, "Materie"), contatore), chips,
        el("div", { class: "riga-imp" }, el("h3", null, "Livello")), livelli,
        el("div", { class: "riga-imp" }, el("h3", null, "Giocatori")), sceltaSquadre,
        el("p", { class: "suggerimento" }, "Con più squadre si gioca a turno, una parola per squadra: comodo alla LIM. Primo indizio 3 punti, secondo 2, terzo 1."),
        el("div", { class: "azioni-imp" }, btnNuovo)));

    /* Area di gioco */
    const info = el("span", { class: "info-partita" }), punteggio = el("span", { class: "tempo" });
    const tabellone = el("div", { class: "tabellone-ig" });
    const carta = el("div", { class: "carta-ig", "aria-live": "polite" });
    const fine = el("div", { class: "fine-ig", hidden: true });
    const scala = E.memoria.leggi("indovina:scala", 2);
    const partita = el("section", { class: "partita-ig" }, el("div", { class: "testata-partita" }, info, punteggio), tabellone, carta, fine);
    radice.append(pannello, partita);
    disegnaChips(); disegnaLivelli(); disegnaSquadre();
    let dimensione = scala;
    const applicaScala = () => { partita.style.setProperty("--scala", String([0.9, 1, 1.15, 1.32, 1.55][dimensione - 1])); E.memoria.scrivi("indovina:scala", dimensione); };
    applicaScala();

    function etichetta(materie) { return materie.length ? materie.map(E.nomeMateria).join(", ") : "Misto"; }
    const nomeSquadra = i => "Squadra " + (i + 1);

    function nuovo() {
      const p = genera(pref.materie, pref.livello, pref.squadre);
      if (!p) { E.avviso("Non ci sono abbastanza parole con tre definizioni: aggiungi materie o cambia livello.", "errore"); return; }
      S = p; salva(); disegna();
      pannello.open = false;
    }

    function disegna() {
      const lv = LIVELLI[S.livello - 1], t = S.turni[S.i];
      info.textContent = "Livello " + lv.n + " · " + lv.nome + " · " + etichetta(S.materie);
      const tot = S.punteggi.reduce((a, b) => a + b, 0);
      punteggio.textContent = S.squadre > 1 ? "" : tot + " punti";
      tabellone.innerHTML = "";
      tabellone.hidden = S.squadre < 2;
      S.punteggi.forEach((p, i) => tabellone.append(el("span", { class: "squadra-ig" + (!S.completato && S.i % S.squadre === i ? " turno" : "") },
        el("span", null, nomeSquadra(i)), el("b", null, String(p)))));
      carta.hidden = S.completato; fine.hidden = !S.completato;
      if (S.completato) { disegnaFine(); return; }

      const aperta = t.stato === "aperta";
      const caselle = el("div", { class: "caselle-ig", "aria-label": t.r.length + " lettere" });
      let j = 0;
      t.testo.split("").forEach(ch => {
        if (ch === " ") { caselle.append(el("i", { class: "spazio" })); return; }
        const mostra = !aperta || (lv.iniziale && j === 0);
        caselle.append(el("i", { class: mostra ? "piena" : "" }, mostra ? t.r[j] : ""));
        j++;
      });
      const indizi = el("ol", { class: "indizi-ig" }, t.indizi.map((d, i) => i < t.visti || !aperta
        ? el("li", { class: i < t.visti ? "" : "extra" }, el("small", null, "Indizio " + NOMI_INDIZI[i] + (aperta ? " · vale " + (3 - i) + (3 - i === 1 ? " punto" : " punti") : "")), el("span", null, d))
        : el("li", { class: "nascosto" }, el("small", null, "Indizio " + NOMI_INDIZI[i]), el("span", null, "…"))));

      const campo = el("input", { type: "text", class: "risposta-ig", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": "La tua risposta",
        placeholder: "Scrivi la parola", onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); prova(campo); } } });
      const azioni = aperta
        ? el("div", { class: "azioni-ig" },
          el("button", { class: "primario", onclick: () => prova(campo) }, "Prova"),
          t.visti < 3 ? el("button", { class: "secondario", onclick: altroIndizio }, "Altro indizio (" + (3 - t.visti) + (3 - t.visti === 1 ? " punto" : " punti") + ")") : null,
          el("button", { class: "secondario", onclick: rivela }, t.visti < 3 ? "Salta" : "Rivela"))
        : el("div", { class: "azioni-ig" }, el("button", { class: "primario", onclick: avanti }, S.i + 1 < S.turni.length ? "Parola successiva" : "Vedi il risultato"));

      carta.innerHTML = "";
      carta.append(
        el("div", { class: "riga-carta" }, el("span", { class: "numero-ig" }, "Parola " + (S.i + 1) + " di " + S.turni.length +
          (S.squadre > 1 ? " · tocca alla " + nomeSquadra(S.i % S.squadre) : "")), el("em", { class: "tag-materia" }, E.nomeMateria(t.materia))),
        caselle, indizi,
        aperta ? el("div", { class: "riga-risposta" }, campo) :
          el("p", { class: "verdetto-ig " + (t.stato === "indovinata" ? "ok" : "no") }, t.stato === "indovinata"
            ? "Giusto! +" + t.punti + (t.punti === 1 ? " punto" : " punti") : "Era «" + t.testo + "»"),
        azioni,
        el("div", { class: "zoom" },
          el("button", { class: "secondario", "aria-label": "Rimpicciolisci il testo", onclick: () => { dimensione = Math.max(1, dimensione - 1); applicaScala(); } }, "A−"),
          el("button", { class: "secondario", "aria-label": "Ingrandisci il testo", onclick: () => { dimensione = Math.min(5, dimensione + 1); applicaScala(); } }, "A+")));
      if (aperta) campo.focus({ preventScroll: true });
      else azioni.querySelector("button").focus({ preventScroll: true });
    }

    function prova(campo) {
      const t = S.turni[S.i], r = E.normalizza(campo.value).replace(/ /g, "");
      if (!r) return;
      t.tentativi++;
      if (r !== t.r) {
        E.avviso("No, non è «" + campo.value.trim().toUpperCase() + "»", "errore");
        campo.value = ""; campo.classList.remove("scossa"); void campo.offsetWidth; campo.classList.add("scossa");
        salva(); return;
      }
      t.stato = "indovinata"; t.punti = 4 - t.visti;
      S.punteggi[S.i % S.squadre] += t.punti;
      salva(); disegna();
    }
    function altroIndizio() { const t = S.turni[S.i]; if (t.visti < 3) t.visti++; salva(); disegna(); }
    function rivela() { const t = S.turni[S.i]; t.stato = "saltata"; t.punti = 0; salva(); disegna(); }
    function avanti() {
      if (S.i + 1 < S.turni.length) S.i++;
      else {
        S.completato = true;
        const st = E.memoria.leggi("stat:indovina", {});
        const s = st[S.livello] || (st[S.livello] = { risolti: 0, migliore: null });
        s.risolti++;
        if (S.squadre === 1 && (s.migliore == null || S.punteggi[0] > s.migliore)) s.migliore = S.punteggi[0];
        E.memoria.scrivi("stat:indovina", st);
      }
      salva(); disegna();
    }

    function disegnaFine() {
      const max = S.turni.length * 3, alto = Math.max(...S.punteggi);
      const vincitrici = S.punteggi.map((p, i) => p === alto ? nomeSquadra(i) : null).filter(Boolean);
      fine.innerHTML = "";
      fine.append(
        el("strong", { class: "titolo-fine" }, S.squadre === 1 ? S.punteggi[0] + " punti su " + max
          : vincitrici.length > 1 ? "Pareggio: " + vincitrici.join(" e ") : "Vince la " + vincitrici[0] + "!"),
        el("ol", { class: "riepilogo-ig" }, S.turni.map((t, i) => el("li", { class: t.stato },
          el("b", null, t.testo), el("span", null, (S.squadre > 1 ? nomeSquadra(i % S.squadre) + " · " : "") +
            (t.stato === "indovinata" ? "+" + t.punti + " al " + ["primo", "secondo", "terzo"][t.visti - 1] + " indizio" : "non indovinata"))))),
        el("button", { class: "primario", onclick: nuovo }, "Nuova partita"));
    }

    if (S && S.turni && S.turni.length) disegna(); else nuovo();
    return { smonta() { salva(); } };
  }

  E.registraGioco({
    id: "indovina",
    nome: "Indovina la parola",
    descrizione: "Tre indizi, dal più enigmatico al più facile: meno ne usi, più punti fai. Anche a squadre.",
    livelli: LIVELLI,
    misura: "punti",
    monta
  });
  E._indovina = { genera, LIVELLI };
})();
