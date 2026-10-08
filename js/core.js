/* Enigmistica — nucleo: registro dei giochi, archivio parole, utilità comuni.
   Per aggiungere un gioco: Enigmistica.registraGioco({ id, nome, descrizione, monta(contenitore) }). */
(function () {
  "use strict";

  const MATERIE = [
    { id: "cultura",     nome: "Cultura generale" },
    { id: "generale",    nome: "Parole comuni" },
    { id: "italiano",    nome: "Italiano" },
    { id: "letteratura", nome: "Letteratura" },
    { id: "storia",      nome: "Storia" },
    { id: "geografia",   nome: "Geografia" },
    { id: "scienze",     nome: "Scienze" },
    { id: "matematica",  nome: "Matematica" },
    { id: "tecnologia",  nome: "Tecnologia" },
    { id: "natura",      nome: "Natura" },
    { id: "arte",        nome: "Arte" },
    { id: "musica",      nome: "Musica" },
    { id: "cinema",      nome: "Cinema e TV" },
    { id: "sport",       nome: "Sport" },
    { id: "mitologia",   nome: "Miti e religioni" },
    { id: "cucina",      nome: "Cucina" },
    { id: "inglese",     nome: "Inglese" },
    { id: "civica",      nome: "Educazione civica" }
  ];

  const archivio = {};      // materia -> [voce]
  const avvisi = [];        // problemi trovati nei dati
  const giochi = [];

  // Toglie accenti e caratteri non alfabetici: "Città" -> "CITTA".
  function normalizza(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z ]/g, "");
  }

  // Ogni voce: [RISPOSTA, notorietà, facile, media, difficile]; ogni definizione può essere
  // una stringa o un elenco di alternative. Se la stessa risposta ricompare nella stessa materia
  // (per esempio in un file di ampliamento), le nuove definizioni si aggiungono a quelle esistenti.
  function parole(materia, lista) {
    const dest = archivio[materia] || (archivio[materia] = []);
    const indice = new Map(dest.map(v => [v.r, v]));
    const alternative = d => (Array.isArray(d) ? d : [d]).map(x => String(x || "").trim()).filter(Boolean);
    for (const e of lista) {
      if (!Array.isArray(e) || e.length < 5) { avvisi.push(materia + ": voce malformata " + JSON.stringify(e)); continue; }
      const testo = normalizza(String(e[0])).trim().replace(/\s+/g, " ");
      const r = testo.replace(/ /g, "");
      if (r.length < 2 || r.length > 21) { avvisi.push(materia + ": lunghezza non valida " + e[0]); continue; }
      const def = [e[2], e[3], e[4]].map(alternative);
      const esistente = indice.get(r);
      if (esistente) {
        def.forEach((d, i) => d.forEach(x => { if (!esistente.def[i].includes(x)) esistente.def[i].push(x); }));
        continue;
      }
      const voce = {
        r,                                   // risposta da inserire nello schema
        testo,                               // con eventuali spazi
        nParole: testo.split(" ").length,
        noto: Math.min(3, Math.max(1, +e[1] || 2)),
        def,                                 // [[facili], [medie], [difficili]]
        materia
      };
      indice.set(r, voce);
      dest.push(voce);
    }
  }

  function contaDefinizioni(materia) {
    return (archivio[materia] || []).reduce((n, v) => n + v.def[0].length + v.def[1].length + v.def[2].length, 0);
  }

  function voci(materieScelte) {
    const ids = materieScelte && materieScelte.length ? materieScelte : Object.keys(archivio);
    return ids.flatMap(id => archivio[id] || []);
  }

  function nomeMateria(id) {
    if (id === "mie") return "Le mie parole";
    const m = MATERIE.find(m => m.id === id);
    return m ? m.nome : id;
  }

  // Giochi della Sfinge (data/sfinge/*.js): coppie o gruppi di parole dell'archivio, per tipo
  // (zeppe, aggiunte, cambi, sciarade, anagrammi, bifronti); "escluse" elenca le parole da non usare nei giochi di parole.
  const enigmi = {};
  function sfinge(tipo, lista) { (enigmi[tipo] || (enigmi[tipo] = [])).push(...lista); }

  // Rebus (data/rebus/*.js): figure (nome → emoji) e rebus per livello, [prima lettura, soluzione].
  const archivioRebus = { figure: {}, livelli: {} };
  function figureRebus(f) { Object.assign(archivioRebus.figure, f); }
  function rebus(livello, lista) { (archivioRebus.livelli[livello] || (archivioRebus.livelli[livello] = [])).push(...lista); }

  // Nonogrammi (data/nonogrammi/*.js): disegni { titolo, righe: ["#..#", ...] }.
  const disegniNonogrammi = [];
  function nonogrammi(lista) { disegniNonogrammi.push(...lista); }

  function registraGioco(g) { giochi.push(g); }

  // Memoria locale, tollerante agli errori (finestre private, archiviazione bloccata).
  const memoria = {
    leggi(chiave, predefinito) {
      try { const v = localStorage.getItem("enigmistica:" + chiave); return v == null ? predefinito : JSON.parse(v); }
      catch (_) { return predefinito; }
    },
    scrivi(chiave, valore) {
      try { localStorage.setItem("enigmistica:" + chiave, JSON.stringify(valore)); } catch (_) {}
    },
    togli(chiave) { try { localStorage.removeItem("enigmistica:" + chiave); } catch (_) {} }
  };

  function mescola(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function el(tag, attrs, ...figli) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k === "html") n.innerHTML = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const f of figli.flat()) if (f != null && f !== false) n.append(f.nodeType ? f : document.createTextNode(f));
    return n;
  }

  // Cronometro con pausa automatica quando la pagina non è visibile.
  function cronometro(nodo, iniziale, aggiornato) {
    let secondi = iniziale || 0, attivo = false, id = null;
    const fmt = s => (s >= 3600 ? Math.floor(s / 3600) + ":" : "") +
      String(Math.floor(s / 60) % 60).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    const disegna = () => { nodo.textContent = fmt(secondi); };
    const tick = () => { if (!document.hidden) { secondi++; disegna(); aggiornato && aggiornato(secondi); } };
    disegna();
    return {
      avvia() { if (!attivo) { attivo = true; id = setInterval(tick, 1000); } },
      ferma() { attivo = false; clearInterval(id); },
      get secondi() { return secondi; },
      fmt
    };
  }

  // La stampa funziona aprendo il file in locale; nelle anteprime incorporate di solito è bloccata.
  const puoStampare = (function () { try { return window.top === window; } catch (_) { return false; } })();

  function avviso(testo, tipo) {
    const box = document.getElementById("avvisi");
    if (!box) return;
    const n = el("div", { class: "toast " + (tipo || ""), role: "status" }, testo);
    box.append(n);
    setTimeout(() => n.classList.add("via"), 3200);
    setTimeout(() => n.remove(), 3700);
  }

  window.Enigmistica = {
    MATERIE, archivio, avvisi, giochi, enigmi, archivioRebus, disegniNonogrammi,
    parole, voci, nomeMateria, contaDefinizioni, normalizza, registraGioco, sfinge, figureRebus, rebus, nonogrammi,
    memoria, mescola, el, cronometro, puoStampare, avviso
  };
})();
