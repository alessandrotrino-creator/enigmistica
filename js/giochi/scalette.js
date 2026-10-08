/* Scalette: da una parola all'altra cambiando una lettera per volta, passando solo per parole dell'archivio.
   Il numero di passi è sempre il minimo possibile, quindi ogni scaletta completa è giusta. */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  // lettere: lunghezze possibili; passi: [minimo, massimo]; noto: notorietà delle parole del percorso proposto;
  // indizi: le definizioni dei gradini si vedono subito.
  const LIVELLI = [
    { n: 1, nome: "Principiante", lettere: [4],    passi: [3, 3],  noto: 1, indizi: true },
    { n: 2, nome: "Facile",       lettere: [4],    passi: [4, 4],  noto: 2, indizi: true },
    { n: 3, nome: "Medio",        lettere: [4, 5], passi: [5, 5],  noto: 2, indizi: false },
    { n: 4, nome: "Difficile",    lettere: [4, 5], passi: [6, 7],  noto: 3, indizi: false },
    { n: 5, nome: "Esperto",      lettere: [4, 5], passi: [8, 12], noto: 3, indizi: false }
  ];
  const scegli = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- Grafo delle parole ---------- */

  // Parole di una lunghezza collegate quando differiscono per una lettera (secchi con un jolly per posizione).
  const grafi = {};
  function grafo(L, noto) {
    const k = L + ":" + noto;
    if (grafi[k]) return grafi[k];
    const S = E._sfinge, esc = S.escluse();
    const parole = [...new Set(E.voci().filter(v => v.nParole === 1 && v.r.length === L).map(v => v.r))]
      .filter(r => S.buona(r, esc) && S.notoDi(r) <= noto);
    const secchi = new Map(), vicini = new Map(parole.map(w => [w, []]));
    parole.forEach(w => { for (let i = 0; i < L; i++) { const c = w.slice(0, i) + "_" + w.slice(i + 1); (secchi.get(c) || secchi.set(c, []).get(c)).push(w); } });
    secchi.forEach(l => l.forEach(a => l.forEach(b => { if (a !== b) vicini.get(a).push(b); })));
    return (grafi[k] = { parole, vicini, insieme: new Set(parole) });
  }
  function distanze(G, da) {
    const d = new Map([[da, 0]]), coda = [da];
    for (let i = 0; i < coda.length; i++) for (const v of G.vicini.get(coda[i]) || []) if (!d.has(v)) { d.set(v, d.get(coda[i]) + 1); coda.push(v); }
    return d;
  }
  // Un percorso minimo casuale da "da" ad "a", scendendo lungo le distanze da "a".
  function percorso(G, da, a) {
    const d = distanze(G, a), strada = [da];
    while (strada[strada.length - 1] !== a) {
      const w = strada[strada.length - 1];
      strada.push(scegli(G.vicini.get(w).filter(v => d.get(v) === d.get(w) - 1)));
    }
    return strada;
  }
  const unaLettera = (a, b) => a.length === b.length && [...a].filter((ch, i) => ch !== b[i]).length === 1;

  function genera(livello) {
    const lv = LIVELLI[livello - 1], t0 = performance.now();
    let migliore = null;
    for (let t = 0; t < 400 && (t < 20 || performance.now() - t0 < 1500); t++) {
      const L = scegli(lv.lettere), G = grafo(L, lv.noto), Gt = grafo(L, 3);
      const da = scegli(G.parole);
      if (!G.vicini.get(da).length) continue;
      const d = distanze(G, da), voglio = lv.passi[0] + Math.floor(Math.random() * (lv.passi[1] - lv.passi[0] + 1));
      // Il percorso deve essere minimo anche con tutte le parole ammesse nelle risposte.
      const dt = distanze(Gt, da);
      const arrivi = [...d.keys()].filter(w => d.get(w) === voglio && dt.get(w) === voglio);
      if (arrivi.length) { migliore = { da, a: scegli(arrivi), G, L }; break; }
      const lontani = [...d.keys()].filter(w => d.get(w) >= lv.passi[0] && d.get(w) === dt.get(w));
      if (lontani.length && (!migliore || d.get(lontani[0]) > migliore.passi)) {
        const a = lontani.reduce((x, y) => (d.get(y) > d.get(x) ? y : x));
        migliore = { da, a, G, L, passi: d.get(a) };
      }
    }
    if (!migliore) return null;
    const strada = percorso(migliore.G, migliore.da, migliore.a);
    return { livello, lato: migliore.L, strada, righe: strada.slice(1, -1).map(() => ""), indizi: [], aiuti: 0, secondi: 0, completato: false, arreso: false };
  }

  /* ---------- Interfaccia ---------- */

  function monta(radice) {
    const pref = Object.assign({ livello: 2 }, E.memoria.leggi("scalette:pref", {}));
    let S = E.memoria.leggi("scalette:corrente", null), timer = null, Gt = null, dFine = null, campi = [];
    const salvaPref = () => E.memoria.scrivi("scalette:pref", pref);

    const livelli = el("div", { class: "livelli", role: "radiogroup", "aria-label": "Livello" });
    function disegnaLivelli() {
      livelli.innerHTML = "";
      LIVELLI.forEach(l => livelli.append(el("button", { class: "livello" + (pref.livello === l.n ? " on" : ""), role: "radio", "aria-checked": String(pref.livello === l.n),
        onclick: () => { pref.livello = l.n; salvaPref(); disegnaLivelli(); } },
        el("b", null, String(l.n)), el("span", null, l.nome + " · " + (l.passi[0] === l.passi[1] ? l.passi[0] : l.passi[0] + "–" + l.passi[1]) + " passi"))));
    }
    const btnNuovo = el("button", { class: "primario", onclick: nuovo }, "Nuova scaletta");
    const pannello = el("details", { class: "impostazioni", open: window.innerWidth > 900 && !(S && S.strada && !S.completato) },
      el("summary", null, "Livello e regole"), el("div", { class: "corpo-imp" },
        el("p", { class: "suggerimento" }, "Dalla parola in alto a quella in basso cambiando una sola lettera per gradino. Ogni gradino deve essere una parola dell'archivio. I gradini sono il minimo indispensabile: se una parola ti porta fuori strada, la scaletta te lo segnala."),
        el("div", { class: "riga-imp" }, el("h3", null, "Livello")), livelli,
        el("div", { class: "azioni-imp" }, btnNuovo)));

    const info = el("span", { class: "info-partita" }), tempo = el("span", { class: "tempo" });
    const scala = el("ol", { class: "scala-sc" });
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
      conferma("Soluzione", "Confermi? Mostra tutto", arrenditi),
      conferma("Azzera", "Confermi? Ricomincia", azzera));
    radice.append(pannello, el("section", { class: "partita-sc" }, el("div", { class: "testata-partita" }, info, tempo), scala, esito, strumenti));
    disegnaLivelli();

    const salva = () => { if (S) { S.secondi = timer ? timer.secondi : S.secondi; E.memoria.scrivi("scalette:corrente", S); } };
    const passi = () => S.strada.length - 1;
    const parola = k => (k === 0 ? S.strada[0] : k === passi() ? S.strada[passi()] : S.righe[k - 1]);
    // Stato di un gradino: vuoto, incompleto, sconosciuta, salto (più di una lettera), fuori strada, ok.
    function stato(k) {
      const w = parola(k);
      if (!w) return "vuoto";
      if (w.length < S.lato) return "incompleto";
      if (!Gt.insieme.has(w)) return "sconosciuta";
      const prima = parola(k - 1);
      if (k > 1 && stato(k - 1) !== "ok") return "attesa";
      if (!unaLettera(prima, w)) return "salto";
      if (dFine.get(w) !== passi() - k) return "fuori";
      return "ok";
    }
    const MESSAGGI = { sconosciuta: "Non è nell'archivio", salto: "Cambia una lettera sola rispetto al gradino sopra", fuori: "È una parola giusta, ma da qui non arrivi in tempo", attesa: "Prima sistema il gradino sopra" };

    function nuovo() {
      btnNuovo.disabled = true; btnNuovo.textContent = "Sto cercando le parole…";
      setTimeout(() => {
        const p = genera(pref.livello);
        btnNuovo.disabled = false; btnNuovo.textContent = "Nuova scaletta";
        if (!p) { E.avviso("Non ho trovato una scaletta adatta: riprova.", "errore"); return; }
        S = p; salva(); avvia();
        pannello.open = false;
      }, 30);
    }

    function avvia() {
      if (timer) timer.ferma();
      timer = E.cronometro(tempo, S.secondi, s => { if (s % 5 === 0) salva(); });
      Gt = grafo(S.lato, 3);
      dFine = distanze(Gt, S.strada[passi()]);
      const lv = LIVELLI[S.livello - 1];
      info.textContent = "Livello " + lv.n + " · " + lv.nome + " · " + passi() + " passi, parole di " + S.lato + " lettere";
      esito.hidden = true;
      disegna();
      if (S.completato) mostraEsito(); else { timer.avvia(); vaiAlProssimo(); }
    }
    // Il cursore va al primo gradino non ancora giusto, alla fine del testo già scritto.
    function vaiAlProssimo() {
      const c = campi.find((x, i) => x && !x.disabled && stato(i + 1) !== "ok");
      if (!c) return;
      c.focus({ preventScroll: true });
      c.setSelectionRange(c.value.length, c.value.length);
    }

    function caselle(w, prima, k) {
      return el("span", { class: "caselle-ig caselle-sc" }, Array.from({ length: S.lato }, (_, i) =>
        el("i", { class: (w && w[i] ? "piena" : "") + (w && prima && w.length === S.lato && w[i] !== prima[i] ? " cambiata" : "") + (k === 0 || k === passi() ? " fissa" : "") }, (w && w[i]) || "")));
    }
    // Il gradino suggerito: un vicino del gradino sopra che resta sulla strada più breve (quello previsto, se possibile).
    function suggerita(k) {
      const sopra = k === 1 || stato(k - 1) === "ok" ? parola(k - 1) : S.strada[k - 1];
      if (unaLettera(sopra, S.strada[k]) && dFine.get(S.strada[k]) === passi() - k) return S.strada[k];
      return (Gt.vicini.get(sopra) || []).find(v => dFine.get(v) === passi() - k) || S.strada[k];
    }
    // La definizione di una parola resta la stessa per tutta la partita.
    const defDi = w => {
      S.defs = S.defs || {};
      if (!(w in S.defs)) S.defs[w] = E._sfinge.definizione(w, LIVELLI[S.livello - 1].indizi ? 0 : 1, []) || "";
      return S.defs[w];
    };

    function disegna() {
      const lv = LIVELLI[S.livello - 1], fine = S.completato;
      scala.innerHTML = ""; campi = [];
      for (let k = 0; k <= passi(); k++) {
        const fissa = k === 0 || k === passi(), w = parola(k), st = fissa ? "ok" : stato(k);
        const riga = el("li", { class: "gradino" + (fissa ? " estremo" : "") + (!fissa ? " " + st : "") });
        if (fissa) {
          riga.append(el("span", { class: "num-sc" }, k === 0 ? "Da" : "A"), caselle(w, null, k), el("span", { class: "def-sc" }, defDi(w)));
        } else {
          const campo = el("input", { class: "input-sc", type: "text", maxlength: String(S.lato), autocomplete: "off", autocapitalize: "characters", spellcheck: "false",
            "aria-label": "Gradino " + k, value: w, disabled: fine || S.indizi.includes("r" + k) ? true : null,
            oninput: e => {
              S.righe[k - 1] = E.normalizza(e.target.value).replace(/ /g, "").slice(0, S.lato);
              aggiornaRiga(k, e.target);
            },
            onkeydown: e => {
              if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); (campi[k] || campi[k - 1]).focus(); }
              if (e.key === "ArrowUp" && campi[k - 2]) { e.preventDefault(); campi[k - 2].focus(); }
            } });
          campi[k - 1] = campo;
          const mostraDef = lv.indizi || S.indizi.includes("d" + k) || fine;
          riga.append(el("span", { class: "num-sc" }, String(k)),
            el("span", { class: "campo-sc" }, caselle(w, parola(k - 1), k), campo),
            el("span", { class: "def-sc" }, mostraDef ? defDi(fine && !S.righe[k - 1] ? S.strada[k] : suggerita(k)) : "",
              MESSAGGI[st] ? el("em", { class: "avviso-sc" }, MESSAGGI[st]) : null),
            fine ? null : el("span", { class: "aiuti-sc" },
              mostraDef ? null : el("button", { class: "secondario", onclick: () => { S.indizi.push("d" + k); S.aiuti++; salva(); disegna(); } }, "Indizio"),
              el("button", { class: "secondario", onclick: () => mostra(k) }, "Mostra")));
        }
        scala.append(riga);
      }
    }

    // Aggiorna solo le caselle e lo stato mentre si scrive, senza ridisegnare (il campo resta attivo).
    function aggiornaRiga(k, campo) {
      const li = campo.closest(".gradino");
      li.querySelector(".caselle-sc").replaceWith(caselle(parola(k), parola(k - 1), k));
      if ((parola(k) || "").length === S.lato) {
        disegna(); salva();
        if (stato(k) === "ok") vaiAlProssimo();
        else { campi[k - 1].focus(); campi[k - 1].setSelectionRange(S.lato, S.lato); }
        verificaFine();
      }
    }

    function mostra(k) {
      S.righe[k - 1] = suggerita(k);
      S.aiuti++;
      salva(); disegna(); verificaFine();
      if (!S.completato) vaiAlProssimo();
    }

    function arrenditi() {
      if (S.completato) return;
      S.righe = S.strada.slice(1, -1); S.arreso = true;
      verificaFine(); disegna();
    }
    function azzera() {
      Object.assign(S, { righe: S.strada.slice(1, -1).map(() => ""), indizi: [], aiuti: 0, secondi: 0, completato: false, arreso: false });
      salva(); avvia();
    }

    function verificaFine() {
      if (S.completato) return;
      for (let k = 1; k < passi(); k++) if (stato(k) !== "ok") return;
      if (!unaLettera(parola(passi() - 1), parola(passi()))) return;
      S.completato = true; timer.ferma(); S.secondi = timer.secondi;
      if (!S.arreso) {
        const st = E.memoria.leggi("stat:scalette", {});
        const s = st[S.livello] || (st[S.livello] = { risolti: 0, migliore: null });
        s.risolti++;
        if (!S.aiuti && (s.migliore == null || S.secondi < s.migliore)) s.migliore = S.secondi;
        E.memoria.scrivi("stat:scalette", st);
      }
      salva(); disegna(); mostraEsito();
    }

    function mostraEsito() {
      esito.hidden = false; esito.innerHTML = "";
      esito.append(
        el("strong", null, S.arreso ? "Soluzione mostrata" : "Scaletta completata!"),
        el("span", null, S.arreso ? "Una delle strade possibili: " + S.strada.join(" → ") :
          "Tempo " + timer.fmt(S.secondi) + " · " + (S.aiuti ? S.aiuti + (S.aiuti === 1 ? " aiuto" : " aiuti") : "senza aiuti")),
        el("button", { class: "primario", onclick: nuovo }, "Nuova scaletta"));
    }

    document.addEventListener("visibilitychange", salva);
    if (S && S.strada) avvia(); else nuovo();
    return { smonta() { if (timer) timer.ferma(); salva(); document.removeEventListener("visibilitychange", salva); } };
  }

  E.registraGioco({
    id: "scalette",
    nome: "Scalette",
    descrizione: "Da una parola all'altra cambiando una lettera per volta: GATTO, GATTI, PATTI…",
    livelli: LIVELLI,
    monta
  });
  E._scalette = { genera, grafo, distanze, LIVELLI };
})();
