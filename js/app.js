/* Enigmistica — schermata iniziale, navigazione fra i giochi, archivio e statistiche. */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el;

  // Giochi previsti: compaiono come "in arrivo" finché non viene registrato il modulo corrispondente.
  const IN_ARRIVO = [
    { id: "rebus", nome: "Rebus", descrizione: "Immagini e lettere da decifrare in una frase." },
    { id: "zeppe", nome: "Zeppe", descrizione: "Una lettera in più cambia la parola: CASA → CASTA." },
    { id: "sciarade", nome: "Sciarade", descrizione: "Due parole unite ne formano una terza: FILO + SOFIA." },
    { id: "aggiunte", nome: "Aggiunte", descrizione: "Una lettera in testa o in coda: ALA → GALA." },
    { id: "elisioni", nome: "Elisioni", descrizione: "Togli una lettera e trovi un'altra parola." },
    { id: "palindromi", nome: "Palindromi", descrizione: "Parole e frasi che si leggono nei due sensi." },
    { id: "anagrammi", nome: "Anagrammi", descrizione: "Le stesse lettere, un'altra parola." },
    { id: "cambi", nome: "Cambi di lettera", descrizione: "Una lettera diversa, un significato nuovo." }
  ];

  const vista = document.getElementById("vista");
  const titoloSezione = document.getElementById("titolo-sezione");
  const btnHome = document.getElementById("torna-home");
  let corrente = null;

  function vai() {
    const id = (location.hash || "").slice(1);
    if (corrente && corrente.smonta) corrente.smonta();
    corrente = null;
    vista.innerHTML = "";
    const g = E.giochi.find(x => x.id === id);
    document.body.dataset.vista = g ? "gioco" : "home";
    btnHome.hidden = !g;
    if (g) {
      titoloSezione.textContent = g.nome;
      document.title = g.nome + " · Enigmistica";
      corrente = g.monta(vista) || null;
    } else {
      titoloSezione.textContent = "";
      document.title = "Enigmistica";
      home();
    }
    window.scrollTo(0, 0);
  }

  function home() {
    const giochi = el("div", { class: "vetrina" });
    E.giochi.forEach((g, i) => giochi.append(el("a", { class: "scheda-gioco attivo", href: "#" + g.id },
      el("span", { class: "segno", "aria-hidden": "true" }, segno(g.id)),
      el("span", { class: "testo" }, el("strong", null, g.nome), el("span", null, g.descrizione)),
      el("span", { class: "vai" }, "Gioca"))));
    const prossimi = el("div", { class: "prossimi" },
      IN_ARRIVO.filter(p => !E.giochi.some(g => g.id === p.id)).map(p =>
        el("div", { class: "scheda-prossima" }, el("strong", null, p.nome), el("span", null, p.descrizione))));

    const tot = E.voci().length;
    const righe = E.MATERIE.filter(m => (E.archivio[m.id] || []).length).map(m => {
      const a = E.archivio[m.id];
      return el("tr", null, el("th", { scope: "row" }, m.nome), el("td", null, a.length.toLocaleString("it-IT")),
        el("td", null, String(a.filter(v => v.noto === 1).length)), el("td", null, String(a.filter(v => v.noto === 2).length)),
        el("td", null, String(a.filter(v => v.noto === 3).length)), el("td", null, E.contaDefinizioni(m.id).toLocaleString("it-IT")));
    });
    const tabella = el("div", { class: "tabella-scorre" }, el("table", { class: "archivio" },
      el("thead", null, el("tr", null, el("th", { scope: "col" }, "Materia"), el("th", { scope: "col" }, "Parole"),
        el("th", { scope: "col" }, "Comuni"), el("th", { scope: "col" }, "Note"), el("th", { scope: "col" }, "Ricercate"), el("th", { scope: "col" }, "Definizioni"))),
      el("tbody", null, righe),
      el("tfoot", null, el("tr", null, el("th", { scope: "row" }, "Totale"), el("td", null, tot.toLocaleString("it-IT")),
        el("td", { colspan: "3" }), el("td", null, E.MATERIE.reduce((s, m) => s + E.contaDefinizioni(m.id), 0).toLocaleString("it-IT"))))));

    const stat = el("div", { class: "statistiche" }, ["cruciverba", "sudoku"].map(id => {
      const st = E.memoria.leggi("stat:" + id, {});
      const nomi = (id === "cruciverba" ? E._cruciverba : E._sudoku).LIVELLI;
      const fmt = s => s == null ? "—" : String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      return el("div", { class: "stat-gioco" }, el("h3", null, id === "cruciverba" ? "Cruciverba" : "Sudoku"),
        el("ol", null, nomi.map(l => el("li", null, el("span", null, l.n + " · " + l.nome),
          el("span", null, (st[l.n] ? st[l.n].risolti : 0) + " risolti"),
          el("span", { title: "Miglior tempo senza aiuti" }, fmt(st[l.n] && st[l.n].migliore))))));
    }));

    vista.append(
      el("section", { class: "apertura" },
        el("p", { class: "occhiello" }, "Giochi di parole e di numeri"),
        el("p", { class: "sottotitolo" }, "Cruciverba con definizioni originali in italiano, da scegliere per materia, e sudoku a soluzione unica. Cinque livelli per ciascun gioco, partite salvate automaticamente.")),
      el("h2", { class: "titoletto" }, "Giochi"), giochi,
      el("h2", { class: "titoletto" }, "In arrivo"), prossimi,
      el("div", { class: "due-colonne" },
        el("section", null, el("h2", { class: "titoletto" }, "Archivio del cruciverba"), tabella),
        el("section", null, el("h2", { class: "titoletto" }, "Le tue partite"), stat)));
    if (E.avvisi.length) console.warn("Enigmistica — voci scartate:\n" + E.avvisi.join("\n"));
  }

  function segno(id) {
    if (id === "cruciverba") {
      const s = el("span", { class: "mini-cv" });
      "ORAR.RARE".split("").forEach(ch => s.append(el("i", { class: ch === "." ? "n" : "" }, ch === "." ? "" : ch)));
      return s;
    }
    if (id === "sudoku") {
      const s = el("span", { class: "mini-sd" });
      "53 7 61 9".split("").forEach(ch => s.append(el("i", null, ch.trim())));
      return s;
    }
    if (id === "editor") {
      const s = el("span", { class: "mini-cv mini-ed" });
      "TU..A.TE".padEnd(9, ".").split("").forEach((ch, i) => s.append(el("i", { class: ch === "." ? (i === 4 ? "" : "n") : "" }, ch === "." ? (i === 4 ? "✎" : "") : ch)));
      return s;
    }
    return el("span", null, "?");
  }

  btnHome.addEventListener("click", () => { location.hash = ""; });
  window.addEventListener("hashchange", vai);
  vai();
})();
