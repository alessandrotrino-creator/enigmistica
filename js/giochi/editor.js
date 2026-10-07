/* Editor di cruciverba: parole e definizioni proprie, caselle nere classiche / varie / disegnate,
   completamento automatico con parole dell'archivio, ritocco di parole e definizioni, poi si gioca. */
(function () {
  "use strict";
  const E = Enigmistica, el = E.el, CV = E._cruciverba;

  const TIPI = [
    { id: "classico",  nome: "Classico",   descr: "Caselle nere simmetriche, come nelle riviste" },
    { id: "vario",     nome: "Vario",      descr: "Caselle nere sparse, senza simmetria" },
    { id: "disegnato", nome: "Lo disegno io", descr: "Clicca le caselle per annerirle" },
    { id: "libero",    nome: "Libero",     descr: "Lo schema si costruisce attorno alle parole" }
  ];
  const DENSITA = [
    { n: 1, nome: "Poche", quota: 0.13, run: 11 },
    { n: 2, nome: "Medie", quota: 0.18, run: 8 },
    { n: 3, nome: "Molte", quota: 0.24, run: 6 }
  ];
  const NOTORIETA = [
    { n: 0, nome: "Tutte" }, { n: 1, nome: "Comuni" }, { n: 2, nome: "Note" }, { n: 3, nome: "Ricercate" }
  ];
  const LIVELLI_DEF = ["Facile", "Media", "Difficile"];

  /* ---------- Griglia: parole (slot) e caselle nere ---------- */

  function trovaSlot(nere, R, C) {
    const slot = [];
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const k = r * C + c;
        if (nere[k] || (c > 0 && !nere[k - 1])) continue;
        let L = 0; while (c + L < C && !nere[k + L]) L++;
        if (L >= 2) slot.push({ oriz: true, r, c, len: L, celle: Array.from({ length: L }, (_, i) => k + i) });
      }
    }
    for (let c = 0; c < C; c++) {
      for (let r = 0; r < R; r++) {
        const k = r * C + c;
        if (nere[k] || (r > 0 && !nere[k - C])) continue;
        let L = 0; while (r + L < R && !nere[k + L * C]) L++;
        if (L >= 2) slot.push({ oriz: false, r, c, len: L, celle: Array.from({ length: L }, (_, i) => k + i * C) });
      }
    }
    const num = new Array(R * C).fill(0);
    let n = 0;
    for (let k = 0; k < R * C; k++) if (slot.some(s => s.celle[0] === k)) num[k] = ++n;
    slot.forEach(s => { s.num = num[s.celle[0]]; s.chiave = (s.oriz ? "O" : "V") + "-" + s.r + "-" + s.c; });
    slot.sort((a, b) => (a.oriz === b.oriz ? a.num - b.num : a.oriz ? -1 : 1));
    return { slot, num };
  }

  // Una casella bianca senza vicine bianche né in orizzontale né in verticale non appartiene a nessuna parola.
  function isolata(nere, R, C, k) {
    if (nere[k]) return false;
    const r = Math.floor(k / C), c = k % C;
    const b = (rr, cc) => rr >= 0 && cc >= 0 && rr < R && cc < C && !nere[rr * C + cc];
    return !b(r, c - 1) && !b(r, c + 1) && !b(r - 1, c) && !b(r + 1, c);
  }

  function connessa(nere, R, C) {
    const start = nere.findIndex(v => !v);
    if (start < 0) return false;
    const visti = new Uint8Array(R * C), coda = [start];
    visti[start] = 1;
    let n = 1;
    while (coda.length) {
      const k = coda.pop(), r = Math.floor(k / C), c = k % C;
      for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        if (rr < 0 || cc < 0 || rr >= R || cc >= C) continue;
        const j = rr * C + cc;
        if (!nere[j] && !visti[j]) { visti[j] = 1; n++; coda.push(j); }
      }
    }
    return n === nere.filter(v => !v).length;
  }

  function annerireOk(nere, R, C, celle) {
    for (const k of celle) {
      const r = Math.floor(k / C), c = k % C;
      // niente blocchi 2×2 di caselle nere
      for (const [dr, dc] of [[0, 0], [0, -1], [-1, 0], [-1, -1]]) {
        const r0 = r + dr, c0 = c + dc;
        if (r0 < 0 || c0 < 0 || r0 + 1 >= R || c0 + 1 >= C) continue;
        if (nere[r0 * C + c0] && nere[r0 * C + c0 + 1] && nere[(r0 + 1) * C + c0] && nere[(r0 + 1) * C + c0 + 1]) return false;
      }
      for (const j of [k - 1, k + 1, k - C, k + C]) {
        if (j < 0 || j >= R * C || (Math.abs((j % C) - c) > 1)) continue;
        if (isolata(nere, R, C, j)) return false;
      }
    }
    return connessa(nere, R, C);
  }

  function runMassimo(nere, R, C) {
    let m = 0;
    for (const s of trovaSlot(nere, R, C).slot) m = Math.max(m, s.len);
    return m;
  }

  function generaNere(R, C, simmetrica, densita) {
    const d = DENSITA[densita - 1];
    const maxRun = Math.min(d.run, Math.max(R, C));
    let migliore = null;
    for (let tent = 0; tent < 8; tent++) {
      const nere = new Uint8Array(R * C);
      const obiettivo = Math.round(R * C * d.quota);
      let contate = 0;
      for (let prove = 0; prove < 6000; prove++) {
        // Si preferiscono le caselle che spezzano le parole troppo lunghe.
        const lunghe = trovaSlot(nere, R, C).slot.filter(s => s.len > maxRun);
        if (contate >= obiettivo && !lunghe.length) break;
        let k;
        if (lunghe.length) {
          const s = lunghe[Math.floor(Math.random() * lunghe.length)];
          k = s.celle[1 + Math.floor(Math.random() * (s.len - 2))];
        } else k = Math.floor(Math.random() * R * C);
        if (nere[k]) continue;
        const celle = simmetrica ? [...new Set([k, R * C - 1 - k])] : [k];
        if (celle.some(j => nere[j])) continue;
        celle.forEach(j => { nere[j] = 1; });
        if (annerireOk(nere, R, C, celle)) contate += celle.length;
        else celle.forEach(j => { nere[j] = 0; });
      }
      const ok = runMassimo(nere, R, C) <= maxRun;
      if (ok) return Array.from(nere);
      if (!migliore) migliore = Array.from(nere);
    }
    return migliore;
  }

  /* ---------- Dizionario e risolutore ---------- */

  function creaIndice(lista) {
    const perL = new Map();
    for (const it of lista) {
      const w = it.w, L = w.length;
      let e = perL.get(L);
      if (!e) { e = { parole: [], prio: [], pos: Array.from({ length: L }, () => ({})), visti: new Set() }; perL.set(L, e); }
      if (e.visti.has(w)) continue;
      e.visti.add(w);
      const id = e.parole.length;
      e.parole.push(w); e.prio.push(it.prio || 0);
      for (let i = 0; i < L; i++) (e.pos[i][w[i]] || (e.pos[i][w[i]] = [])).push(id);
    }
    return perL;
  }

  function candidati(ind, pat, usate, limite) {
    const e = ind.get(pat.length);
    if (!e) return [];
    let base = null;
    for (let i = 0; i < pat.length; i++) {
      if (pat[i] === ".") continue;
      const l = e.pos[i][pat[i]];
      if (!l) return [];
      if (!base || l.length < base.length) base = l;
    }
    const out = [], n = base ? base.length : e.parole.length;
    for (let j = 0; j < n; j++) {
      const id = base ? base[j] : j, w = e.parole[id];
      if (usate.has(w)) continue;
      let ok = true;
      for (let i = 0; i < pat.length; i++) if (pat[i] !== "." && pat[i] !== w[i]) { ok = false; break; }
      if (ok) { out.push(id); if (limite && out.length >= limite) break; }
    }
    return out;
  }

  // Riempie le caselle vuote con parole del dizionario. Le parole già complete restano com'è (anche se non sono in archivio).
  function risolvi(R, C, nere, lettere0, ind, tempo) {
    const { slot } = trovaSlot(nere, R, C);
    const perCella = Array.from({ length: R * C }, () => []);
    slot.forEach((s, i) => s.celle.forEach(k => perCella[k].push(i)));
    const L = lettere0.slice();
    const pat = s => s.celle.map(k => L[k] || ".").join("");
    const completo = s => s.celle.every(k => L[k]);
    const usate = new Set(slot.filter(completo).map(pat));
    const fail = new Array(slot.length).fill(0);
    const scadenza = performance.now() + tempo;
    let nodi = 0;

    function cerca() {
      if ((++nodi & 31) === 0 && performance.now() > scadenza) throw "tempo";
      let best = -1, bestN = Infinity;
      for (let i = 0; i < slot.length; i++) {
        const s = slot[i];
        if (completo(s)) continue;
        const n = candidati(ind, pat(s), usate, Math.min(bestN, 300)).length;
        if (n === 0) { fail[i]++; return false; }
        if (n < bestN) { bestN = n; best = i; if (n === 1) break; }
      }
      if (best < 0) return true;
      const s = slot[best], e = ind.get(s.len);
      let ids = E.mescola(candidati(ind, pat(s), usate, 0));
      ids.sort((a, b) => e.prio[b] - e.prio[a]);
      ids = ids.slice(0, 24);
      for (const id of ids) {
        const w = e.parole[id], scritte = [], aggiunte = [w];
        for (let i = 0; i < s.len; i++) if (!L[s.celle[i]]) { L[s.celle[i]] = w[i]; scritte.push(s.celle[i]); }
        usate.add(w);
        let ok = true;
        for (const k of scritte) {
          for (const j of perCella[k]) {
            if (j === best) continue;
            const t = slot[j], p = pat(t);
            if (completo(t)) {
              if (usate.has(p) || !candidati(ind, p, usate, 1).length) { ok = false; fail[j]++; break; }
              usate.add(p); aggiunte.push(p);
            } else if (!candidati(ind, p, usate, 1).length) { ok = false; fail[j]++; break; }
          }
          if (!ok) break;
        }
        if (ok && cerca()) return true;
        scritte.forEach(k => { L[k] = ""; });
        aggiunte.forEach(x => usate.delete(x));
      }
      fail[best]++;
      return false;
    }

    try { return { ok: cerca(), lettere: L, fail, slot }; }
    catch (err) { if (err === "tempo") return { ok: false, tempo: true, fail, slot }; throw err; }
  }

  /* ---------- Interfaccia ---------- */

  function nuovaBozza() {
    return {
      titolo: "", R: 11, C: 11, tipo: "classico", densita: 2, simmetria: true,
      livello: 3, materie: [], comuni: true, mie: [],
      nere: new Array(121).fill(0), lettere: new Array(121).fill(""), fisse: new Array(121).fill(0), defs: {}
    };
  }

  function monta(radice) {
    let B = Object.assign(nuovaBozza(), E.memoria.leggi("editor:bozza", {}));
    let sel = null;                // { chiave }
    let strumento = "parole";      // "parole" | "nere"
    let filtroNoto = 0;
    let griglia = null;            // { slot, num }
    let mappaVoci = null;

    const salva = () => E.memoria.scrivi("editor:bozza", B);
    const norm = s => E.normalizza(String(s || "")).replace(/ /g, "");
    const lv = () => CV.LIVELLI[B.livello - 1];

    function voci() {
      if (!mappaVoci) {
        mappaVoci = new Map();
        for (const v of E.voci()) (mappaVoci.get(v.r) || mappaVoci.set(v.r, []).get(v.r)).push(v);
      }
      return mappaVoci;
    }
    function mia(w) { return B.mie.find(m => norm(m.parola) === w); }

    // Tutte le definizioni disponibili per una parola, divise per difficoltà.
    function definizioniDi(w) {
      const gruppi = [[], [], []];
      const m = mia(w);
      for (const v of voci().get(w) || []) v.def.forEach((arr, i) => arr.forEach(d => { if (!gruppi[i].includes(d)) gruppi[i].push(d); }));
      return { mia: m ? m.def : null, gruppi };
    }

    function defAutomatica(w) {
      const { mia: m, gruppi } = definizioniDi(w);
      if (m) return { testo: m, fonte: "mia" };
      const scelte = lv().defs;
      for (let t = 0; t < 6; t++) {
        let i = scelte[Math.floor(Math.random() * scelte.length)];
        if (!gruppi[i].length) i = gruppi.findIndex(g => g.length);
        if (i >= 0) return { testo: gruppi[i][Math.floor(Math.random() * gruppi[i].length)], fonte: "archivio" };
      }
      return { testo: "", fonte: "" };
    }

    function parolaSlot(s) { return s.celle.map(k => B.lettere[k] || "").join(""); }
    function completa(s) { return s.celle.every(k => B.lettere[k]); }

    // Restituisce la definizione aggiornata dello slot (rigenerandola se la parola è cambiata).
    function defSlot(s) {
      const w = parolaSlot(s);
      if (!completa(s)) return null;
      const d = B.defs[s.chiave];
      if (d && d.parola === w) return d;
      const nuova = Object.assign({ parola: w }, defAutomatica(w));
      B.defs[s.chiave] = nuova;
      return nuova;
    }

    function ridimensiona(R, C) {
      R = Math.max(4, Math.min(21, R | 0)); C = Math.max(4, Math.min(21, C | 0));
      B.R = R; B.C = C;
      B.nere = new Array(R * C).fill(0); B.lettere = new Array(R * C).fill(""); B.fisse = new Array(R * C).fill(0); B.defs = {};
      sel = null;
    }

    function dizionario() {
      const l = lv();
      const materie = CV.materieScelte(B.materie, []);
      const lista = [];
      for (const v of E.voci(materie)) if (v.noto <= l.noto) lista.push({ w: v.r, prio: 1 });
      if (B.comuni && !materie.includes("generale")) for (const v of E.archivio.generale || []) if (v.noto <= l.noto) lista.push({ w: v.r, prio: 0 });
      for (const m of B.mie) { const w = norm(m.parola); if (w.length >= 2) lista.push({ w, prio: 3 }); }
      return lista;
    }

    /* --- Pannello impostazioni --- */
    const inTitolo = el("input", { type: "text", id: "ed-titolo", placeholder: "es. Ripasso di storia, 2ª B", value: B.titolo,
      oninput: e => { B.titolo = e.target.value; salva(); } });
    const inR = el("input", { type: "number", id: "ed-righe", min: "4", max: "21", value: B.R });
    const inC = el("input", { type: "number", id: "ed-colonne", min: "4", max: "21", value: B.C });
    const btnDim = el("button", { class: "secondario", onclick: () => {
      ridimensiona(+inR.value, +inC.value); inR.value = B.R; inC.value = B.C;
      if (B.tipo === "classico" || B.tipo === "vario") B.nere = generaNere(B.R, B.C, B.tipo === "classico", B.densita);
      salva(); disegna();
    } }, "Applica dimensioni");

    const boxTipi = el("div", { class: "tipi-schema", role: "radiogroup", "aria-label": "Tipo di schema" });
    const boxDensita = el("div", { class: "chips" });
    const cbSimm = el("input", { type: "checkbox", id: "ed-simm", checked: B.simmetria, onchange: e => { B.simmetria = e.target.checked; salva(); } });
    const opzSimm = el("label", { class: "opzione", for: "ed-simm" }, cbSimm, " Simmetria automatica mentre disegno");
    const rigaDensita = el("div", { class: "riga-imp" }, el("h3", null, "Caselle nere"), boxDensita);
    const boxMaterie = el("div", { class: "chips" });
    const boxLivelli = el("div", { class: "livelli", role: "radiogroup", "aria-label": "Difficoltà delle proposte" });
    const cbComuni = el("input", { type: "checkbox", id: "ed-comuni", checked: B.comuni, onchange: e => { B.comuni = e.target.checked; salva(); } });

    function disegnaImpostazioni() {
      boxTipi.innerHTML = "";
      TIPI.forEach(t => boxTipi.append(el("button", {
        class: "tipo" + (B.tipo === t.id ? " on" : ""), role: "radio", "aria-checked": String(B.tipo === t.id),
        onclick: () => {
          B.tipo = t.id;
          if (t.id === "classico" || t.id === "vario") { B.nere = generaNere(B.R, B.C, t.id === "classico", B.densita); svuotaLettere(); }
          if (t.id === "disegnato") strumento = "nere";
          salva(); disegnaImpostazioni(); disegna();
        }
      }, el("strong", null, t.nome), el("span", null, t.descr))));
      boxDensita.innerHTML = "";
      DENSITA.forEach(d => boxDensita.append(el("button", {
        class: "chip" + (B.densita === d.n ? " on" : ""), "aria-pressed": String(B.densita === d.n),
        onclick: () => { B.densita = d.n; if (B.tipo === "classico" || B.tipo === "vario") { B.nere = generaNere(B.R, B.C, B.tipo === "classico", B.densita); svuotaLettere(); } salva(); disegnaImpostazioni(); disegna(); }
      }, d.nome)));
      rigaDensita.hidden = !(B.tipo === "classico" || B.tipo === "vario");
      opzSimm.hidden = B.tipo !== "disegnato";

      boxMaterie.innerHTML = "";
      boxMaterie.append(el("button", { class: "chip" + (!B.materie.length ? " on" : ""), onclick: () => { B.materie = []; salva(); disegnaImpostazioni(); } }, "Tutte"));
      E.MATERIE.forEach(m => {
        if (!(E.archivio[m.id] || []).length) return;
        const on = B.materie.includes(m.id);
        boxMaterie.append(el("button", { class: "chip" + (on ? " on" : ""), "aria-pressed": String(on),
          onclick: () => { B.materie = on ? B.materie.filter(x => x !== m.id) : B.materie.concat(m.id); salva(); disegnaImpostazioni(); } }, m.nome));
      });
      boxLivelli.innerHTML = "";
      CV.LIVELLI.forEach(l => boxLivelli.append(el("button", {
        class: "livello" + (B.livello === l.n ? " on" : ""), role: "radio", "aria-checked": String(B.livello === l.n),
        onclick: () => { B.livello = l.n; salva(); disegnaImpostazioni(); }
      }, el("b", null, String(l.n)), el("span", null, l.nome))));
    }

    const impostazioni = el("details", { class: "impostazioni", open: true },
      el("summary", null, "Impostazioni dello schema"),
      el("div", { class: "corpo-imp" },
        el("label", { class: "campo-parola", for: "ed-titolo" }, el("span", null, "Titolo"), inTitolo),
        el("div", { class: "riga-imp dimensioni" },
          el("label", { class: "campo-num", for: "ed-righe" }, "Righe", inR),
          el("span", { "aria-hidden": "true" }, "×"),
          el("label", { class: "campo-num", for: "ed-colonne" }, "Colonne", inC), btnDim),
        el("div", { class: "riga-imp" }, el("h3", null, "Tipo di schema")), boxTipi, rigaDensita, opzSimm,
        el("div", { class: "riga-imp" }, el("h3", null, "Materie delle parole proposte")), boxMaterie,
        el("div", { class: "riga-imp" }, el("h3", null, "Difficoltà delle parole e definizioni proposte")), boxLivelli,
        el("p", { class: "suggerimento" }, "Il livello decide quanto sono comuni le parole proposte e quale definizione viene scelta: 1–2 facili, 3 medie, 4–5 enigmatiche. Per ogni parola puoi poi scegliere tu la definizione."),
        el("label", { class: "opzione", for: "ed-comuni" }, cbComuni, " Usa anche parole comuni per completare (consigliato)")));

    /* --- Le mie parole --- */
    const inParola = el("input", { type: "text", id: "ed-mia-parola", placeholder: "Parola", autocomplete: "off", spellcheck: "false" });
    const inDef = el("input", { type: "text", id: "ed-mia-def", placeholder: "Definizione", autocomplete: "off" });
    const listaMie = el("ul", { class: "lista-mie" });
    const taImporta = el("textarea", { id: "ed-importa", rows: "5", placeholder: "Una parola per riga, separata dalla definizione da due punti, trattino o uguale:\nGARIBALDI: L'eroe dei due mondi\nTEVERE - Il fiume di Roma" });
    function aggiungiMia(parola, def) {
      const w = norm(parola);
      if (w.length < 2) { E.avviso("La parola deve avere almeno 2 lettere", "errore"); return false; }
      if (w.length > Math.max(B.R, B.C)) E.avviso("«" + w + "» è più lunga dello schema: allarga le dimensioni", "errore");
      const i = B.mie.findIndex(m => norm(m.parola) === w);
      if (i >= 0) B.mie[i].def = def || B.mie[i].def; else B.mie.push({ parola: parola.trim().toUpperCase(), def: (def || "").trim() });
      return true;
    }
    function disegnaMie() {
      contaMie.textContent = B.mie.length ? String(B.mie.length) : "";
      listaMie.innerHTML = "";
      if (!B.mie.length) listaMie.append(el("li", { class: "vuota" }, "Nessuna parola ancora. Aggiungine qui sopra: verranno inserite per prime nello schema."));
      B.mie.forEach((m, i) => {
        const w = norm(m.parola);
        const presente = griglia && griglia.slot.some(s => parolaSlot(s) === w);
        const inDefMia = el("input", { type: "text", value: m.def, "aria-label": "Definizione di " + m.parola,
          onchange: e => { m.def = e.target.value; Object.values(B.defs).forEach(d => { if (d.parola === w && d.fonte === "mia") d.testo = m.def; }); salva(); disegnaDefinizioni(); } });
        listaMie.append(el("li", { class: presente ? "presente" : "" },
          el("b", null, m.parola), inDefMia,
          el("span", { class: "stato-mia" }, presente ? "nello schema" : "da inserire"),
          el("button", { class: "icona", "aria-label": "Togli " + m.parola, onclick: () => { B.mie.splice(i, 1); salva(); disegnaMie(); } }, "✕")));
      });
    }
    const formMie = el("form", { class: "form-mie", onsubmit: e => {
      e.preventDefault();
      if (aggiungiMia(inParola.value, inDef.value)) { inParola.value = ""; inDef.value = ""; inParola.focus(); salva(); disegnaMie(); }
    } }, inParola, inDef, el("button", { class: "primario", type: "submit" }, "Aggiungi"));
    const btnImporta = el("button", { class: "secondario", onclick: () => {
          let n = 0;
          taImporta.value.split(/\r?\n/).forEach(riga => {
            const m = riga.match(/^\s*([^:=\-–—]+?)\s*[:=\-–—]\s*(.+)$/);
            if (m && aggiungiMia(m[1], m[2])) n++;
            else if (riga.trim() && !m && aggiungiMia(riga, "")) n++;
          });
          taImporta.value = ""; salva(); disegnaMie();
          E.avviso(n + (n === 1 ? " parola aggiunta" : " parole aggiunte"), "ok");
        } }, "Aggiungi all'elenco");

    /* --- Schema --- */
    const grigliaDom = el("div", { class: "griglia-cv griglia-editor" });
    const input = el("input", { class: "input-nascosto", type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": "Scrivi una lettera" });
    const statoDom = el("p", { class: "stato-schema" });
    const btnStrParole = el("button", { class: "chip", onclick: () => { strumento = "parole"; disegna(); } }, "Scrivo lettere");
    const btnStrNere = el("button", { class: "chip", onclick: () => { strumento = "nere"; disegna(); } }, "Metto caselle nere");
    const btnComponi = el("button", { class: "primario", onclick: componi }, "Inserisci le mie parole e completa");

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

    const barraSchema = el("div", { class: "strumenti" },
      el("span", { class: "chips strumento" }, btnStrParole, btnStrNere),
      btnComponi,
      el("button", { class: "secondario", onclick: () => {
        if (B.tipo === "libero") { E.avviso("Nello schema libero le caselle nere dipendono dalle parole: usa «Inserisci e completa»", "errore"); return; }
        B.nere = generaNere(B.R, B.C, B.tipo !== "vario", B.densita); svuotaLettere(); salva(); disegna();
      } }, "Nuove caselle nere"),
      conferma("Togli le parole proposte", "Confermi? Restano le tue", () => { pulisciNonFisse(false); salva(); disegna(); }),
      conferma("Svuota schema", "Confermi? Cancella tutto", () => { B.lettere.fill(""); B.fisse.fill(0); B.defs = {}; if (B.tipo === "disegnato") B.nere.fill(0); salva(); disegna(); }));

    // Pannello della parola selezionata
    const pannello = el("aside", { class: "pannello-parola" });
    const listaO = el("ol", { class: "definizioni" }), listaV = el("ol", { class: "definizioni" });

    const azioniFinali = el("div", { class: "strumenti azioni-finali" },
      el("button", { class: "primario", onclick: gioca }, "Gioca questo cruciverba"),
      el("button", { class: "secondario", onclick: salvaSchema }, "Salva nei miei schemi"),
      E.puoStampare ? E.pdf.menuPdf(o => {
        const p = costruisciPartita();
        if (p.errore) { E.avviso(p.errore, "errore"); disegna(); return; }
        E.pdf.pdfCruciverba(p, Object.assign(o, { titolo: B.titolo.trim() || "Cruciverba", sottotitolo: "Nome ______________________" }));
      }) : null,
      conferma("Nuovo schema vuoto", "Confermi? La bozza si perde", () => { const mie = B.mie; B = nuovaBozza(); B.mie = mie; inTitolo.value = ""; inR.value = B.R; inC.value = B.C; B.nere = generaNere(B.R, B.C, true, B.densita); salva(); disegnaImpostazioni(); disegna(); }));
    const listaSchemi = el("ul", { class: "lista-schemi" });

    // Tre schede: prima le parole, poi lo schema, infine l'archivio degli schemi salvati.
    const contaMie = el("small", null);
    const schede = [
      { id: "parole", nome: "1 · Le mie parole", corpo: el("section", { class: "blocco-editor" },
          el("p", { class: "suggerimento" }, "Scrivi le parole che vuoi nel cruciverba con la loro definizione. Puoi anche saltare questo passo: lo schema verrà riempito con parole dell'archivio."),
          formMie, listaMie,
          el("details", { class: "importa" }, el("summary", null, "Incolla un elenco"), taImporta, btnImporta),
          el("div", { class: "azioni-imp" }, el("button", { class: "primario", onclick: () => apriScheda("schema") }, "Avanti: lo schema →"))) },
      { id: "schema", nome: "2 · Schema e definizioni", corpo: el("section", { class: "blocco-editor" },
          impostazioni,
          barraSchema, statoDom,
          el("div", { class: "area-editor" },
            el("div", { class: "contenitore-griglia" }, grigliaDom, input),
            pannello),
          el("div", { class: "colonna-definizioni editor-def" },
            el("div", { class: "blocco-def" }, el("h3", null, "Orizzontali"), listaO),
            el("div", { class: "blocco-def" }, el("h3", null, "Verticali"), listaV)),
          azioniFinali) },
      { id: "schemi", nome: "3 · I miei schemi", corpo: el("section", { class: "blocco-editor" }, listaSchemi) }
    ];
    const barraSchede = el("div", { class: "schede", role: "tablist" });
    let schedaAttiva = E.memoria.leggi("editor:scheda", B.mie.length ? "schema" : "parole");
    function apriScheda(id) {
      schedaAttiva = id; E.memoria.scrivi("editor:scheda", id);
      barraSchede.innerHTML = "";
      schede.forEach(s => {
        barraSchede.append(el("button", { class: "scheda" + (s.id === id ? " on" : ""), role: "tab", "aria-selected": String(s.id === id), onclick: () => apriScheda(s.id) },
          s.nome, s.id === "parole" ? contaMie : null));
        s.corpo.hidden = s.id !== id;
      });
      if (id === "schema") impostazioni.open = !griglia || !griglia.slot.some(completa);
    }
    radice.append(barraSchede, ...schede.map(s => s.corpo));

    function svuotaLettere() { B.lettere.fill(""); B.fisse.fill(0); B.defs = {}; sel = null; }

    function pulisciNonFisse(ancheFisseSuNere) {
      for (let k = 0; k < B.R * B.C; k++) {
        if (B.nere[k]) { B.lettere[k] = ""; if (ancheFisseSuNere) B.fisse[k] = 0; }
        else if (!B.fisse[k]) B.lettere[k] = "";
      }
    }

    function slotSel() { return sel && griglia ? griglia.slot.find(s => s.chiave === sel.chiave) : null; }
    function slotDi(k, oriz) { return griglia.slot.find(s => s.oriz === oriz && s.celle.includes(k)); }

    function disegna() {
      if (B.nere.length !== B.R * B.C) ridimensiona(B.R, B.C);
      griglia = trovaSlot(B.nere, B.R, B.C);
      btnStrParole.classList.toggle("on", strumento === "parole");
      btnStrNere.classList.toggle("on", strumento === "nere");
      grigliaDom.classList.toggle("modo-nere", strumento === "nere");
      grigliaDom.style.setProperty("--colonne", B.C);
      grigliaDom.innerHTML = "";
      const s = slotSel();
      const attive = new Set(s ? s.celle : []);
      for (let k = 0; k < B.R * B.C; k++) {
        const n = el("div", { class: "cella" + (B.nere[k] ? " nera" : "") + (attive.has(k) ? " attiva" : "") + (sel && sel.k === k ? " cursore" : "") + (B.fisse[k] && !B.nere[k] ? " fissa" : "") },
          !B.nere[k] && griglia.num[k] ? el("span", { class: "num" }, String(griglia.num[k])) : null,
          !B.nere[k] ? el("span", { class: "lettera" }, B.lettere[k] || "") : null);
        n.addEventListener("pointerdown", e => { e.preventDefault(); clicCella(k); });
        grigliaDom.append(n);
      }
      disegnaDefinizioni(); disegnaPannello(); disegnaMie(); disegnaStato();
    }

    function disegnaStato() {
      const tot = griglia.slot.length;
      const incomplete = griglia.slot.filter(s => !completa(s)).length;
      const senzaDef = griglia.slot.filter(s => completa(s) && !(defSlot(s) || {}).testo).length;
      const nere = B.nere.filter(Boolean).length;
      statoDom.textContent = B.R + "×" + B.C + " · " + nere + " caselle nere · " + tot + " parole" +
        (incomplete ? " · " + incomplete + " da completare" : "") + (senzaDef ? " · " + senzaDef + " senza definizione" : "") +
        (!incomplete && !senzaDef && tot ? " · pronto per giocare" : "");
    }

    function disegnaDefinizioni() {
      listaO.innerHTML = ""; listaV.innerHTML = "";
      for (const s of griglia.slot) {
        const d = defSlot(s);
        const li = el("li", { class: (sel && sel.chiave === s.chiave ? "attiva" : "") + (!completa(s) ? " mancante" : d && !d.testo ? " senza-def" : ""),
          onclick: () => { sel = { chiave: s.chiave, k: s.celle.find(k => !B.lettere[k]) ?? s.celle[0] }; disegna(); input.focus({ preventScroll: true }); } },
          el("b", null, String(s.num)),
          el("span", null, completa(s) ? (d && d.testo ? d.testo : "— definizione da scrivere —") : "— da completare (" + s.len + " lettere) —",
            completa(s) ? el("em", { class: "tag-materia" }, parolaSlot(s) + (d && d.fonte === "mia" ? " · tua" : "")) : null));
        (s.oriz ? listaO : listaV).append(li);
      }
    }

    function disegnaPannello() {
      pannello.innerHTML = "";
      const s = slotSel();
      if (!s) {
        pannello.append(el("p", { class: "suggerimento" }, strumento === "nere"
          ? "Clicca le caselle per annerirle o schiarirle." + (B.simmetria && B.tipo === "disegnato" ? " La simmetria è attiva." : "")
          : "Clicca una casella o una definizione per scegliere la parola, vedere i suggerimenti e decidere la definizione. Puoi anche scrivere direttamente nelle caselle."));
        return;
      }
      const w = parolaSlot(s), pattern = s.celle.map(k => B.lettere[k] || "·").join("");
      const inW = el("input", { type: "text", id: "ed-parola-slot", value: completa(s) ? w : "", placeholder: pattern, maxlength: String(s.len + 4), autocomplete: "off", spellcheck: "false" });
      const applica = () => {
        const v = norm(inW.value);
        if (v.length !== s.len) { E.avviso("Servono " + s.len + " lettere (ne hai scritte " + v.length + ")", "errore"); return; }
        mettiParola(s, v);
      };
      inW.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); applica(); } });
      pannello.append(
        el("h3", null, s.num + (s.oriz ? " orizzontale" : " verticale") + " · " + s.len + " lettere"),
        el("div", { class: "riga-parola" }, inW,
          el("button", { class: "primario", onclick: applica }, "Metti"),
          el("button", { class: "secondario", onclick: () => togliParola(s) }, "Togli")));

      // Definizione
      if (completa(s)) {
        const d = defSlot(s);
        const ta = el("textarea", { id: "ed-def-slot", rows: "2", "aria-label": "Definizione" });
        ta.value = d.testo;
        ta.addEventListener("change", () => { B.defs[s.chiave] = { parola: w, testo: ta.value.trim(), fonte: "manuale" }; salva(); disegnaDefinizioni(); disegnaStato(); });
        const { mia: m, gruppi } = definizioniDi(w);
        const scegli = (testo, fonte) => { B.defs[s.chiave] = { parola: w, testo, fonte }; salva(); disegnaDefinizioni(); disegnaPannello(); disegnaStato(); };
        const opzioni = el("div", { class: "scelta-def" });
        if (m) opzioni.append(el("div", { class: "gruppo-def" }, el("h4", null, "La tua"), el("button", { class: "def-opzione" + (d.testo === m ? " on" : ""), onclick: () => scegli(m, "mia") }, m)));
        gruppi.forEach((g, i) => {
          if (!g.length) return;
          opzioni.append(el("div", { class: "gruppo-def" }, el("h4", null, LIVELLI_DEF[i]),
            g.map(t => el("button", { class: "def-opzione" + (d.testo === t ? " on" : ""), onclick: () => scegli(t, "archivio") }, t))));
        });
        pannello.append(el("label", { class: "campo-parola", for: "ed-def-slot" }, el("span", null, "Definizione (puoi riscriverla)"), ta));
        if (opzioni.childNodes.length) pannello.append(el("p", { class: "suggerimento" }, "Oppure scegline una per difficoltà:"), opzioni);
        else pannello.append(el("p", { class: "suggerimento" }, "Questa parola non è nell'archivio: scrivi tu la definizione."));
      }

      // Suggerimenti di parole compatibili con gli incroci
      const filtri = el("div", { class: "chips" }, NOTORIETA.map(f => el("button", { class: "chip" + (filtroNoto === f.n ? " on" : ""), onclick: () => { filtroNoto = f.n; disegnaPannello(); } }, f.nome)));
      // Restano le lettere delle caselle incrociate da un'altra parola; le altre sono libere.
      const pat = s.celle.map(k => (B.lettere[k] && slotDi(k, !s.oriz) ? B.lettere[k] : ".")).join("");
      const materie = CV.materieScelte(B.materie, []);
      const usate = new Set(griglia.slot.filter(t => t !== s && completa(t)).map(parolaSlot));
      const elenco = [];
      const visti = new Set();
      const aggiungi = (v, tag) => {
        if (v.r.length !== s.len || visti.has(v.r) || usate.has(v.r)) return;
        if (filtroNoto && v.noto !== filtroNoto) return;
        for (let i = 0; i < s.len; i++) if (pat[i] !== "." && pat[i] !== v.r[i]) return;
        visti.add(v.r); elenco.push({ w: v.r, tag, noto: v.noto });
      };
      B.mie.forEach(m => aggiungi({ r: norm(m.parola), noto: 0 }, "tua"));
      E.voci(materie).forEach(v => aggiungi(v, E.nomeMateria(v.materia)));
      if (B.comuni) (E.archivio.generale || []).forEach(v => aggiungi(v, "Parole comuni"));
      const lista = el("div", { class: "suggerimenti" });
      E.mescola(elenco.filter(x => x.tag !== "tua")).slice(0, 60).concat(elenco.filter(x => x.tag === "tua"))
        .sort((a, b) => (a.tag === "tua" ? -1 : 0) - (b.tag === "tua" ? -1 : 0))
        .forEach(x => lista.append(el("button", { class: "sugg" + (x.tag === "tua" ? " tua" : ""), title: x.tag, onclick: () => mettiParola(s, x.w) },
          x.w, el("small", null, x.tag === "tua" ? "tua" : ["", "comune", "nota", "ricercata"][x.noto] || ""))));
      pannello.append(el("h4", { class: "titolo-sugg" }, "Parole adatte (" + pat.replace(/\./g, "·") + ")"), filtri,
        elenco.length ? lista : el("p", { class: "suggerimento" }, "Nessuna parola in archivio con questo schema di lettere. Scrivila tu o cambia una parola incrociata."));
    }

    function mettiParola(s, w) {
      s.celle.forEach((k, i) => { B.lettere[k] = w[i]; B.fisse[k] = 1; });
      B.defs[s.chiave] = Object.assign({ parola: w }, defAutomatica(w));
      salva(); disegna();
    }

    function togliParola(s) {
      s.celle.forEach(k => {
        // Una lettera resta se appartiene a una parola incrociata completa e bloccata.
        const altra = slotDi(k, !s.oriz);
        if (altra && completa(altra) && altra.celle.every(j => B.fisse[j])) return;
        B.lettere[k] = ""; B.fisse[k] = 0;
      });
      delete B.defs[s.chiave];
      salva(); disegna();
    }

    function clicCella(k) {
      if (strumento === "nere") {
        if (B.tipo === "libero") { B.tipo = "disegnato"; disegnaImpostazioni(); }
        const celle = B.simmetria && B.tipo !== "vario" ? [...new Set([k, B.R * B.C - 1 - k])] : [k];
        const diventaNera = !B.nere[k];
        celle.forEach(j => { B.nere[j] = diventaNera ? 1 : 0; B.lettere[j] = ""; B.fisse[j] = 0; });
        if (B.tipo === "classico" && !B.simmetria) B.tipo = "disegnato";
        sel = null; salva(); disegna(); return;
      }
      if (B.nere[k]) return;
      const corrente = slotSel();
      let oriz = corrente ? corrente.oriz : true;
      if (sel && sel.k === k && slotDi(k, !oriz)) oriz = !oriz;
      const s = slotDi(k, oriz) || slotDi(k, !oriz);
      sel = s ? { chiave: s.chiave, k } : null;
      disegna();
      input.focus({ preventScroll: true });
    }

    // Scrittura diretta nelle caselle
    function scriviLettera(l) {
      if (!sel || strumento !== "parole") return;
      const s = slotSel();
      B.lettere[sel.k] = l; B.fisse[sel.k] = 1;
      if (s) { const i = s.celle.indexOf(sel.k); if (i < s.len - 1) sel.k = s.celle[i + 1]; }
      salva(); disegna();
    }
    input.addEventListener("keydown", e => {
      if (!sel) return;
      const s = slotSel();
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (!B.lettere[sel.k] && e.key === "Backspace" && s) { const i = s.celle.indexOf(sel.k); if (i > 0) sel.k = s.celle[i - 1]; }
        B.lettere[sel.k] = ""; B.fisse[sel.k] = 0; salva(); disegna(); return;
      }
      const mosse = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -B.C, ArrowDown: B.C };
      if (mosse[e.key]) {
        e.preventDefault();
        const j = sel.k + mosse[e.key];
        if (j >= 0 && j < B.R * B.C && !B.nere[j] && (mosse[e.key] !== 1 && mosse[e.key] !== -1 || Math.floor(j / B.C) === Math.floor(sel.k / B.C))) {
          const oriz = Math.abs(mosse[e.key]) === 1;
          const t = slotDi(j, oriz) || slotDi(j, !oriz);
          sel = t ? { chiave: t.chiave, k: j } : sel;
          disegna(); input.focus({ preventScroll: true });
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const l = norm(e.key);
        if (l) { scriviLettera(l); input.focus({ preventScroll: true }); }
      }
    });
    input.addEventListener("input", () => { const t = norm(input.value); input.value = ""; for (const l of t) scriviLettera(l); input.focus({ preventScroll: true }); });

    /* --- Composizione --- */
    function componi() {
      btnComponi.disabled = true; btnComponi.textContent = "Sto componendo…";
      setTimeout(() => {
        try { (B.tipo === "libero" ? componiLibero : componiFisso)(); if (griglia.slot.some(completa)) impostazioni.open = false; }
        finally { btnComponi.disabled = false; btnComponi.textContent = "Inserisci le mie parole e completa"; }
      }, 30);
    }

    function componiLibero() {
      const l = lv();
      const lato = Math.max(B.R, B.C);
      const mie = B.mie.map(m => ({ r: norm(m.parola), testo: norm(m.parola), nParole: 1, noto: 1, def: [[m.def], [m.def], [m.def]], materia: "mie" }))
        .filter(v => v.r.length >= 2 && v.r.length <= lato).sort((a, b) => b.r.length - a.r.length);
      const materie = CV.materieScelte(B.materie, []);
      let pool = E.voci(materie).filter(v => v.noto <= l.noto && v.r.length <= lato);
      if (B.comuni && !materie.includes("generale")) pool = pool.concat((E.archivio.generale || []).filter(v => v.noto <= l.noto && v.r.length <= 6).map(v => Object.assign({}, v, { riempitivo: true })));
      pool = pool.concat(mie);
      const opz = { righe: B.R, colonne: B.C, lato, obiettivo: Math.round(B.R * B.C / 4.5) };
      let migliore = null;
      const t0 = performance.now();
      for (let i = 0; i < 60 && (i < 8 || performance.now() - t0 < 1800); i++) {
        const t = CV.tentativo(pool, opz, mie);
        if (t && (!migliore || t.punteggio > migliore.punteggio)) migliore = t;
      }
      if (!migliore) { E.avviso("Non riesco a comporre lo schema: prova dimensioni più grandi", "errore"); return; }
      const ins = new Set(migliore.piazzate.map(p => p.voce.r));
      B.nere = migliore.griglia.map(v => (v === null ? 1 : 0));
      B.lettere = migliore.griglia.map(v => v || "");
      B.fisse = migliore.griglia.map(v => 0);
      migliore.piazzate.forEach(p => { if (p.voce.materia === "mie") for (let i = 0; i < p.voce.r.length; i++) B.fisse[(p.r + (p.oriz ? 0 : i)) * B.C + p.c + (p.oriz ? i : 0)] = 1; });
      B.defs = {}; sel = null;
      salva(); disegna();
      const fuori = mie.filter(v => !ins.has(v.r)).map(v => v.r);
      E.avviso(fuori.length ? "Non sono entrate: " + fuori.join(", ") + ". Prova uno schema più grande." : "Schema composto con tutte le tue parole", fuori.length ? "errore" : "ok");
    }

    function componiFisso() {
      const R = B.R, C = B.C;
      if (!B.nere.some(Boolean) && B.tipo !== "disegnato") B.nere = generaNere(R, C, B.tipo === "classico", B.densita);
      const ind = creaIndice(dizionario());
      const simm = B.tipo === "classico" || (B.tipo === "disegnato" && B.simmetria);
      const t0 = performance.now();
      let annerite = 0, esito = null, fuori = [], riserva = null;

      // Una mia parola più lunga di ogni spazio disponibile riceve uno spazio su misura (in orizzontale).
      const lunghezze = new Set(trovaSlot(B.nere, R, C).slot.map(s => s.len));
      for (const w of B.mie.map(m => norm(m.parola)).filter(w => w.length >= 2 && w.length <= C && !lunghezze.has(w.length))) {
        const righe = E.mescola(Array.from({ length: R }, (_, r) => r));
        let fatto = false;
        for (const r of righe) {
          for (const c0 of E.mescola(Array.from({ length: C - w.length + 1 }, (_, c) => c))) {
            const celle = Array.from({ length: w.length }, (_, i) => r * C + c0 + i);
            if (celle.some((k, i) => B.fisse[k] && B.lettere[k] !== w[i])) continue;
            const prima = B.nere.slice();
            celle.forEach(k => { B.nere[k] = 0; });
            const bordi = [c0 > 0 ? r * C + c0 - 1 : -1, c0 + w.length < C ? r * C + c0 + w.length : -1].filter(k => k >= 0);
            if (bordi.some(k => B.fisse[k])) { B.nere = prima; continue; }
            const nuove = simm ? [...new Set(bordi.flatMap(k => [k, R * C - 1 - k]))] : bordi;
            nuove.forEach(k => { B.nere[k] = 1; });
            if (nuove.some(k => celle.includes(k)) || !connessa(B.nere, R, C)) { B.nere = prima; continue; }
            celle.forEach((k, i) => { B.lettere[k] = w[i]; B.fisse[k] = 1; });
            fatto = true; break;
          }
          if (fatto) break;
        }
      }

      for (let giro = 0; giro < 150 && performance.now() - t0 < 12000; giro++) {
        const lettere = B.lettere.map((x, k) => (B.nere[k] ? "" : B.fisse[k] ? x : ""));
        const { slot } = trovaSlot(B.nere, R, C);
        // Le mie parole non ancora presenti vanno in uno spazio della lunghezza giusta.
        const presenti = new Set(slot.filter(s => s.celle.every(k => lettere[k])).map(s => s.celle.map(k => lettere[k]).join("")));
        fuori = [];
        const mie = E.mescola(B.mie.map(m => norm(m.parola)).filter(w => w.length >= 2 && !presenti.has(w))).sort((a, b) => b.length - a.length);
        const occupati = new Set();
        const perCella = Array.from({ length: R * C }, () => []);
        slot.forEach(s => s.celle.forEach(k => perCella[k].push(s)));
        const vuoto = new Set();
        for (const w of mie) {
          const posti = E.mescola(slot.filter(s => s.len === w.length && !occupati.has(s.chiave) &&
            s.celle.some(k => !lettere[k]) && s.celle.every((k, i) => !lettere[k] || lettere[k] === w[i])));
          // Si sceglie un posto in cui tutte le parole incrociate restano completabili.
          const posto = posti.find(s => {
            const prova = lettere.slice();
            s.celle.forEach((k, i) => { prova[k] = w[i]; });
            return s.celle.every(k => perCella[k].every(t => t === s ||
              candidati(ind, t.celle.map(j => prova[j] || ".").join(""), vuoto, 1).length));
          });
          if (!posto) { fuori.push(w); continue; }
          posto.celle.forEach((k, i) => { lettere[k] = w[i]; });
          occupati.add(posto.chiave);
        }
        const res = risolvi(R, C, B.nere, lettere, ind, 900);
        if (res.ok) {
          if (!fuori.length) { esito = res; break; }
          // Riuscito ma senza tutte le mie parole: si tiene il migliore e si riprova ancora un po'.
          if (!riserva || fuori.length < riserva.fuori.length) riserva = { res, fuori: fuori.slice(), nere: B.nere.slice() };
          if (performance.now() - t0 > 5000) break;
          continue;
        }
        // Lo spazio che fallisce più spesso riceve una casella nera (con la sua simmetrica).
        const candidatiNeri = res.slot.map((s, i) => ({ s, f: res.fail[i] }))
          .filter(x => x.s.len >= 3 && x.s.celle.every(k => !B.fisse[k])).sort((a, b) => b.f - a.f);
        let fatto = false;
        for (const { s } of candidatiNeri.slice(0, 6)) {
          const ordine = s.celle.slice(1, -1).sort(() => Math.random() - 0.5);
          for (const k of ordine) {
            const celle = simm ? [...new Set([k, R * C - 1 - k])] : [k];
            if (celle.some(j => B.nere[j] || B.fisse[j])) continue;
            celle.forEach(j => { B.nere[j] = 1; });
            if (annerireOk(B.nere, R, C, celle)) { fatto = true; annerite += celle.length; break; }
            celle.forEach(j => { B.nere[j] = 0; });
          }
          if (fatto) break;
        }
        if (!fatto && giro > 20) break;
      }
      if (!esito && riserva) { esito = riserva.res; fuori = riserva.fuori; B.nere = riserva.nere; }
      if (!esito) {
        salva(); disegna();
        E.avviso("Non sono riuscito a completare lo schema. Prova più caselle nere, uno schema più piccolo o il tipo «Libero».", "errore");
        return;
      }
      B.lettere = esito.lettere;
      // Le mie parole inserite diventano fisse, così restano se ricompongo.
      const { slot } = trovaSlot(B.nere, R, C);
      const mieSet = new Set(B.mie.map(m => norm(m.parola)));
      slot.forEach(s => { if (mieSet.has(s.celle.map(k => B.lettere[k]).join(""))) s.celle.forEach(k => { B.fisse[k] = 1; }); });
      sel = null; salva(); disegna();
      const msg = [];
      if (fuori.length) msg.push("Non sono entrate: " + fuori.join(", "));
      if (annerite) msg.push("ho aggiunto " + annerite + " caselle nere per riuscire a completare");
      E.avviso(msg.length ? msg.join("; ") : "Schema completato", fuori.length ? "errore" : "ok");
    }

    /* --- Gioca, salva --- */
    function costruisciPartita() {
      const { slot, num } = trovaSlot(B.nere, B.R, B.C);
      if (!slot.length) return { errore: "Lo schema è vuoto." };
      const inc = slot.filter(s => !completa(s));
      if (inc.length) { sel = { chiave: inc[0].chiave, k: inc[0].celle[0] }; return { errore: inc.length + " parole sono ancora da completare." }; }
      const senza = slot.filter(s => !(defSlot(s) || {}).testo);
      if (senza.length) { sel = { chiave: senza[0].chiave, k: senza[0].celle[0] }; return { errore: senza.length + " parole non hanno ancora la definizione." }; }
      // Le caselle che non appartengono a nessuna parola diventano nere.
      const nere = B.nere.slice();
      for (let k = 0; k < nere.length; k++) if (!nere[k] && !slot.some(s => s.celle.includes(k))) nere[k] = 1;
      const soluzione = nere.map((n, k) => (n ? null : B.lettere[k]));
      const mieSet = new Set(B.mie.map(m => norm(m.parola)));
      const parole = slot.map(s => {
        const w = parolaSlot(s);
        const v = (voci().get(w) || [])[0];
        return { num: s.num, oriz: s.oriz, r: s.r, c: s.c, len: s.len, risposta: w, testo: w, def: defSlot(s).testo,
          materia: mieSet.has(w) ? "mie" : v ? v.materia : "mie" };
      });
      return {
        livello: B.livello, materie: ["mie"], etichetta: B.titolo || "Schema personale",
        righe: B.R, colonne: B.C, soluzione, numeri: num, parole,
        inserite: soluzione.map(v => (v === null ? null : "")), rivelate: [], secondi: 0, aiuti: 0, completato: false, creato: Date.now()
      };
    }

    function gioca() {
      const p = costruisciPartita();
      if (p.errore) { E.avviso(p.errore, "errore"); disegna(); return; }
      E.memoria.scrivi("cruciverba:corrente", p);
      location.hash = "#cruciverba";
    }

    function salvaSchema() {
      const schemi = E.memoria.leggi("editor:schemi", []);
      const titolo = B.titolo.trim() || "Schema del " + new Date().toLocaleDateString("it-IT");
      const i = schemi.findIndex(s => s.titolo === titolo);
      const copia = JSON.parse(JSON.stringify(Object.assign({}, B, { titolo, salvato: Date.now() })));
      if (i >= 0) schemi[i] = copia; else schemi.unshift(copia);
      E.memoria.scrivi("editor:schemi", schemi);
      E.avviso("Salvato: " + titolo, "ok");
      disegnaSchemi();
    }

    function disegnaSchemi() {
      const schemi = E.memoria.leggi("editor:schemi", []);
      listaSchemi.innerHTML = "";
      if (!schemi.length) { listaSchemi.append(el("li", { class: "vuota" }, "Gli schemi salvati compaiono qui e si possono riaprire per modificarli o giocarli.")); return; }
      schemi.forEach((s, i) => listaSchemi.append(el("li", null,
        el("span", null, el("b", null, s.titolo), " · " + s.R + "×" + s.C + " · " + new Date(s.salvato).toLocaleDateString("it-IT")),
        el("button", { class: "secondario", onclick: () => { B = Object.assign(nuovaBozza(), JSON.parse(JSON.stringify(s))); inTitolo.value = B.titolo; inR.value = B.R; inC.value = B.C; sel = null; salva(); disegnaImpostazioni(); disegna(); window.scrollTo(0, 0); } }, "Apri"),
        conferma("Elimina", "Confermi?", () => { schemi.splice(i, 1); E.memoria.scrivi("editor:schemi", schemi); disegnaSchemi(); }))));
    }

    if (!B.nere.some(Boolean) && (B.tipo === "classico" || B.tipo === "vario") && !B.lettere.some(Boolean)) B.nere = generaNere(B.R, B.C, B.tipo === "classico", B.densita);
    disegnaImpostazioni(); disegna(); disegnaSchemi(); apriScheda(schedaAttiva);
    return { smonta() { salva(); } };
  }

  E.registraGioco({
    id: "editor",
    nome: "Crea cruciverba",
    descrizione: "Le tue parole e definizioni, schema classico, vario o disegnato da te, completato con parole dell'archivio.",
    monta
  });
  E._editor = { trovaSlot, generaNere, creaIndice, risolvi };
})();
