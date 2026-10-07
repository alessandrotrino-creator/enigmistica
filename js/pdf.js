/* PDF senza librerie esterne: cruciverba (schema vuoto o risolto + definizioni) e sudoku,
   adattati a un solo foglio A4, a mezza pagina orizzontale o a due copie per foglio. */
(function () {
  "use strict";
  const E = Enigmistica;

  // Larghezze dei caratteri Helvetica (unità /1000), da 32 a 126.
  const LARG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
    1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
    333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const SPECIALI = { "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97, "€": 0x80, "•": 0x95, "−": 0x2D };

  // Converte in WinAnsi (Windows-1252): lettere accentate e « » sono già nel range Latin-1.
  function ansi(s) {
    let out = "";
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if (SPECIALI[ch]) out += String.fromCharCode(SPECIALI[ch]);
      else if (c < 256) out += ch;
      else out += "?";
    }
    return out;
  }
  function larghezza(s, fs, grassetto) {
    let w = 0;
    for (const ch of ansi(s)) {
      const c = ch.charCodeAt(0);
      let base = c >= 32 && c <= 126 ? LARG[c - 32] : c >= 0xC0 ? LARG[(ch.normalize("NFD")[0] || "a").charCodeAt(0) - 32] || 556 : 556;
      w += base;
    }
    return w / 1000 * fs * (grassetto ? 1.06 : 1);
  }
  function aCapo(testo, fs, max, grassetto) {
    const parole = String(testo).split(/\s+/), righe = [];
    let riga = "";
    for (const p of parole) {
      const prova = riga ? riga + " " + p : p;
      if (larghezza(prova, fs, grassetto) <= max || !riga) riga = prova;
      else { righe.push(riga); riga = p; }
    }
    if (riga) righe.push(riga);
    return righe;
  }

  function documento(larg, alt) {
    const pagine = [];
    let cur = null;
    const n = v => (Math.round(v * 100) / 100).toString();
    const esc = s => ansi(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const api = {
      larg, alt,
      pagina() { cur = []; pagine.push(cur); return api; },
      testo(x, y, fs, s, opz) {
        opz = opz || {};
        let xx = x;
        if (opz.centro) xx = x - larghezza(s, fs, opz.grassetto) / 2;
        if (opz.destra) xx = x - larghezza(s, fs, opz.grassetto);
        cur.push((opz.grigio ? "0.35 g " : "0 g ") + "BT /" + (opz.grassetto ? "F2" : "F1") + " " + n(fs) + " Tf " + n(xx) + " " + n(alt - y) + " Td (" + esc(s) + ") Tj ET");
      },
      rett(x, y, w, h, pieno, spessore) {
        cur.push((spessore ? n(spessore) : "0.6") + " w 0 g 0 G " + n(x) + " " + n(alt - y - h) + " " + n(w) + " " + n(h) + " re " + (pieno ? "f" : "S"));
      },
      // Segmento con estremità arrotondate (grigio: 0 nero, 1 bianco), per cerchiare le parole.
      tratto(x1, y1, x2, y2, spessore, grigio) {
        cur.push("1 J " + n(grigio || 0) + " G " + n(spessore) + " w " + n(x1) + " " + n(alt - y1) + " m " + n(x2) + " " + n(alt - y2) + " l S 0 J");
      },
      linea(x1, y1, x2, y2, spessore, tratteggio) {
        cur.push((tratteggio ? "[4 3] 0 d " : "[] 0 d ") + n(spessore || 0.5) + " w 0.5 G " + n(x1) + " " + n(alt - y1) + " m " + n(x2) + " " + n(alt - y2) + " l S [] 0 d");
      },
      scarica(nome) {
        const ogg = [];
        ogg.push("<< /Type /Catalog /Pages 2 0 R >>");
        ogg.push(null); // pagine, dopo
        ogg.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        ogg.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
        const kids = [];
        pagine.forEach(p => {
          const stream = p.join("\n");
          ogg.push("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
          const cont = ogg.length;
          ogg.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + n(larg) + " " + n(alt) + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + cont + " 0 R >>");
          kids.push(ogg.length + " 0 R");
        });
        ogg[1] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + kids.length + " >>";
        let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        const pos = [];
        ogg.forEach((o, i) => { pos.push(pdf.length); pdf += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
        const xref = pdf.length;
        pdf += "xref\n0 " + (ogg.length + 1) + "\n0000000000 65535 f \n" + pos.map(p => String(p).padStart(10, "0") + " 00000 n \n").join("");
        pdf += "trailer\n<< /Size " + (ogg.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
        const byte = new Uint8Array(pdf.length);
        for (let i = 0; i < pdf.length; i++) byte[i] = pdf.charCodeAt(i) & 255;
        const url = URL.createObjectURL(new Blob([byte], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url; a.download = nome; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    };
    return api;
  }

  /* ---------- Cruciverba ---------- */

  // Prova a impaginare le definizioni in "colonne" (riquadri) con corpo fs; restituisce le righe posizionate o null.
  function impagina(S, colonne, fs) {
    const inter = fs * 1.22, out = [];
    let ci = 0, y = colonne[0].y;
    const blocchi = [];
    [true, false].forEach(oriz => {
      blocchi.push({ titolo: oriz ? "ORIZZONTALI" : "VERTICALI" });
      S.parole.filter(p => p.oriz === oriz).sort((a, b) => a.num - b.num).forEach(p => blocchi.push({ p }));
    });
    for (const b of blocchi) {
      const col = colonne[ci];
      if (b.titolo) {
        if (y > col.y + 2 && y + inter * 2.4 > col.y + col.h) { ci++; if (ci >= colonne.length) return null; y = colonne[ci].y; }
        const c = colonne[ci];
        if (y > c.y + 2) y += inter * 0.5;
        out.push({ x: c.x, y: y + fs, testo: b.titolo, fs: fs * 1.02, grassetto: true });
        y += inter * 1.25;
        continue;
      }
      const num = b.p.num + ".", rientro = Math.max(larghezza("00.", fs, true) + 2, larghezza(num, fs, true) + 2);
      let righe = aCapo(b.p.def, fs, colonne[ci].w - rientro);
      if (y + righe.length * inter > colonne[ci].y + colonne[ci].h) {
        ci++; if (ci >= colonne.length) return null; y = colonne[ci].y;
        righe = aCapo(b.p.def, fs, colonne[ci].w - rientro);
        if (y + righe.length * inter > colonne[ci].y + colonne[ci].h) return null;
      }
      const c = colonne[ci];
      out.push({ x: c.x, y: y + fs, testo: num, fs, grassetto: true });
      righe.forEach((r, i) => out.push({ x: c.x + rientro, y: y + fs + i * inter, testo: r, fs }));
      y += righe.length * inter + fs * 0.18;
    }
    return out;
  }

  // Disegna un cruciverba completo dentro il riquadro {x, y, w, h}. modo: "sotto" o "accanto".
  function disegnaCruciverba(doc, box, S, opz) {
    const titolo = opz.titolo || "Cruciverba";
    const sotto = opz.sottotitolo || "";
    const ft = Math.min(16, box.h * 0.045 + 4);
    const intestazione = () => {
      doc.testo(box.x, box.y + ft, ft, titolo + (opz.soluzione ? " — soluzione" : ""), { grassetto: true });
      if (sotto) doc.testo(box.x + box.w, box.y + ft, ft * 0.55, sotto, { destra: true, grigio: true });
    };
    const top = box.y + ft * 1.7, altezza = box.h - (top - box.y);
    const quote = opz.modo === "accanto" ? [0.52, 0.46, 0.4, 0.34] : [0.55, 0.48, 0.42, 0.36];
    for (const quota of quote) {
      let cella, gx, gy, colonne;
      if (opz.modo === "accanto") {
        cella = Math.min(box.w * quota / S.colonne, altezza / S.righe);
        gx = box.x; gy = top;
        const xs = gx + cella * S.colonne + 14, ws = box.x + box.w - xs, gap = 10, wc = (ws - gap) / 2;
        colonne = [{ x: xs, y: top, w: wc, h: altezza }, { x: xs + wc + gap, y: top, w: wc, h: altezza }];
      } else {
        cella = Math.min(box.w / S.colonne, altezza * quota / S.righe, 30);
        gx = box.x + (box.w - cella * S.colonne) / 2; gy = top;
        const yd = gy + cella * S.righe + 14, hd = box.y + box.h - yd, n = box.w > 400 ? 3 : 2, gap = 12, wc = (box.w - gap * (n - 1)) / n;
        colonne = Array.from({ length: n }, (_, i) => ({ x: box.x + i * (wc + gap), y: yd, w: wc, h: hd }));
      }
      let righe = null;
      for (let fs = 10.5; fs >= (opz.minFs || 8); fs -= 0.25) { righe = impagina(S, colonne, fs); if (righe) break; }
      if (!righe) continue;
      if (opz.prova) return true;
      intestazione();
      // Griglia
      for (let r = 0; r < S.righe; r++) for (let c = 0; c < S.colonne; c++) {
        const k = r * S.colonne + c, x = gx + c * cella, y = gy + r * cella;
        if (S.soluzione[k] === null) doc.rett(x, y, cella, cella, true);
        else {
          doc.rett(x, y, cella, cella, false, 0.5);
          if (S.numeri[k]) doc.testo(x + cella * 0.07, y + cella * 0.3, Math.max(4, cella * 0.27), String(S.numeri[k]));
          if (opz.soluzione) doc.testo(x + cella / 2, y + cella * 0.8, cella * 0.55, S.soluzione[k], { centro: true, grassetto: true });
        }
      }
      doc.rett(gx, gy, cella * S.colonne, cella * S.righe, false, 1.2);
      righe.forEach(t => doc.testo(t.x, t.y, t.fs, t.testo, { grassetto: t.grassetto }));
      return true;
    }
    return false;
  }

  const MM = 72 / 25.4;
  function nomeFile(base, titolo) {
    const pulito = (titolo || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const d = new Date();
    return base + (pulito ? "-" + pulito : "") + "-" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "-" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + ".pdf";
  }

  // formato: "a4" | "mezza" | "doppia"
  function pdfCruciverba(S, opz) {
    opz = opz || {};
    const m = 12 * MM;
    // Se nel formato ridotto le definizioni scenderebbero sotto gli 8 punti, si passa all'A4 intero.
    if (opz.formato === "mezza" || opz.formato === "doppia") {
      const prova = opz.formato === "mezza"
        ? { larg: 210 * MM, alt: 148.5 * MM, box: { x: m, y: m, w: 210 * MM - 2 * m, h: 148.5 * MM - 2 * m }, modo: "accanto" }
        : { larg: 297 * MM, alt: 210 * MM, box: { x: m * 0.8, y: m, w: 148.5 * MM - m * 1.6, h: 210 * MM - 2 * m }, modo: "sotto" };
      const d = documento(prova.larg, prova.alt).pagina();
      if (!disegnaCruciverba(d, prova.box, S, Object.assign({}, opz, { modo: prova.modo, prova: true }))) {
        opz = Object.assign({}, opz, { formato: "a4" });
        E.avviso("Il cruciverba è grande: l'ho impaginato su un A4 intero perché le definizioni restino leggibili.", "ok");
      }
    }
    let doc;
    if (opz.formato === "mezza") {
      doc = documento(210 * MM, 148.5 * MM).pagina();
      disegnaCruciverba(doc, { x: m, y: m, w: doc.larg - 2 * m, h: doc.alt - 2 * m }, S, Object.assign({}, opz, { modo: "accanto" }));
    } else if (opz.formato === "doppia") {
      // A4 orizzontale con due copie affiancate (ognuna è un A5 verticale).
      doc = documento(297 * MM, 210 * MM).pagina();
      const meta = doc.larg / 2;
      [0, meta].forEach(x0 => disegnaCruciverba(doc, { x: x0 + m * 0.8, y: m, w: meta - m * 1.6, h: doc.alt - 2 * m }, S, Object.assign({}, opz, { modo: "sotto" })));
      doc.linea(meta, m * 0.5, meta, doc.alt - m * 0.5, 0.6, true);
      doc.testo(meta + 3, doc.alt - m * 0.5, 6, "taglia qui", { grigio: true });
    } else {
      doc = documento(210 * MM, 297 * MM).pagina();
      const box = { x: m, y: m, w: doc.larg - 2 * m, h: doc.alt - 2 * m };
      // Su A4 si cerca prima il corpo 8; solo per schemi enormi si scende fino a 6.5.
      if (!disegnaCruciverba(doc, box, S, Object.assign({}, opz, { modo: "sotto" })) &&
          !disegnaCruciverba(doc, box, S, Object.assign({}, opz, { modo: "sotto", minFs: 6.5 }))) {
        E.avviso("Le definizioni sono troppe per un solo foglio: riduci lo schema.", "errore");
        return;
      }
    }
    doc.scarica(nomeFile(opz.soluzione ? "cruciverba-soluzione" : "cruciverba", opz.titolo !== "Cruciverba" ? opz.titolo : ""));
  }

  /* ---------- Sudoku ---------- */

  function disegnaSudoku(doc, box, date, soluzione, titolo, sotto) {
    const ft = Math.min(16, box.h * 0.05 + 4);
    doc.testo(box.x, box.y + ft, ft, titolo, { grassetto: true });
    if (sotto) doc.testo(box.x + box.w, box.y + ft, ft * 0.55, sotto, { destra: true, grigio: true });
    const top = box.y + ft * 1.8, lato = Math.min(box.w, box.h - (top - box.y)), cella = lato / 9;
    const gx = box.x + (box.w - lato) / 2;
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9, x = gx + c * cella, y = top + r * cella;
      doc.rett(x, y, cella, cella, false, 0.4);
      const v = soluzione ? soluzione[i] : date[i];
      if (v) doc.testo(x + cella / 2, y + cella * 0.7, cella * 0.55, String(v), { centro: true, grassetto: !!date[i], grigio: !date[i] });
    }
    for (let b = 0; b <= 3; b++) {
      doc.linea(gx + b * cella * 3, top, gx + b * cella * 3, top + lato, 1.8);
      doc.linea(gx, top + b * cella * 3, gx + lato, top + b * cella * 3, 1.8);
    }
  }

  function pdfSudoku(S, opz) {
    opz = opz || {};
    const m = 14 * MM, titolo = "Sudoku" + (opz.soluzione ? " — soluzione" : "");
    const sol = opz.soluzione ? S.soluzione : null;
    let doc;
    if (opz.formato === "mezza") {
      doc = documento(210 * MM, 148.5 * MM).pagina();
      disegnaSudoku(doc, { x: m, y: m * 0.7, w: doc.larg - 2 * m, h: doc.alt - 1.4 * m }, S.date, sol, titolo, opz.sottotitolo);
    } else if (opz.formato === "doppia") {
      doc = documento(297 * MM, 210 * MM).pagina();
      const meta = doc.larg / 2;
      [0, meta].forEach(x0 => disegnaSudoku(doc, { x: x0 + m * 0.6, y: m, w: meta - m * 1.2, h: doc.alt - 2 * m }, S.date, sol, titolo, opz.sottotitolo));
      doc.linea(meta, m * 0.5, meta, doc.alt - m * 0.5, 0.6, true);
    } else {
      doc = documento(210 * MM, 297 * MM).pagina();
      disegnaSudoku(doc, { x: m, y: m, w: doc.larg - 2 * m, h: doc.alt - 2 * m }, S.date, sol, titolo, opz.sottotitolo);
    }
    doc.scarica(nomeFile(opz.soluzione ? "sudoku-soluzione" : "sudoku", ""));
  }

  /* ---------- Crucipuzzle ---------- */

  // Elenco delle parole (o delle definizioni numerate) distribuito in colonne; null se non entra.
  function elencoCrucipuzzle(S, colonne, fs) {
    const inter = fs * 1.22, out = [];
    // Le parole semplici si dividono in parti uguali fra le colonne; le definizioni riempiono una colonna alla volta.
    const perColonna = S.definizioni ? Infinity : Math.ceil(S.parole.length / colonne.length);
    let ci = 0, y = colonne[0].y, nellaColonna = 0;
    for (let i = 0; i < S.parole.length; i++) {
      const p = S.parole[i], num = S.definizioni ? (i + 1) + "." : "";
      const rientro = num ? larghezza("00.", fs, true) + 2 : 0, testo = S.definizioni ? p.def + " (" + p.len + ")" : p.testo;
      let righe = aCapo(testo, fs, colonne[ci].w - rientro);
      if (nellaColonna >= perColonna || y + righe.length * inter > colonne[ci].y + colonne[ci].h) {
        nellaColonna = 0;
        ci++; if (ci >= colonne.length) return null; y = colonne[ci].y;
        righe = aCapo(testo, fs, colonne[ci].w - rientro);
        if (y + righe.length * inter > colonne[ci].y + colonne[ci].h) return null;
      }
      const c = colonne[ci];
      if (num) out.push({ x: c.x, y: y + fs, testo: num, fs, grassetto: true });
      righe.forEach((r, j) => out.push({ x: c.x + rientro, y: y + fs + j * inter, testo: r, fs }));
      y += righe.length * inter + (num ? fs * 0.18 : 0);
      nellaColonna++;
    }
    return out;
  }

  // Griglia, elenco e parola segreta dentro il riquadro {x, y, w, h}. modo: "sotto" o "accanto".
  function disegnaCrucipuzzle(doc, box, S, opz) {
    const N = S.lato, ft = Math.min(16, box.h * 0.045 + 4);
    const top = box.y + ft * 1.7, altezza = box.h - (top - box.y);
    const segreta = "Parola segreta (" + S.segreta.r.length + " lettere): " + S.segreta.def +
      (opz.soluzione ? ". Soluzione: " + S.segreta.testo : "   " + S.segreta.testo.replace(/\S/g, "_ ").replace(/  /g, "    ").trim());
    for (const quota of opz.modo === "accanto" ? [0.6, 0.54, 0.48] : [0.66, 0.6, 0.54, 0.48]) {
      let cella, gx, area;
      if (opz.modo === "accanto") {
        cella = Math.min(box.w * quota / N, altezza / N);
        gx = box.x;
        const xs = gx + cella * N + 14;
        area = { x: xs, y: top, w: box.x + box.w - xs, h: altezza, nc: S.definizioni ? 1 : 2 };
      } else {
        cella = Math.min(box.w / N, altezza * quota / N, 40);
        gx = box.x + (box.w - cella * N) / 2;
        const yd = top + cella * N + 14;
        area = { x: box.x, y: yd, w: box.w, h: box.y + box.h - yd, nc: S.definizioni ? (box.w > 400 ? 2 : 1) : (box.w > 400 ? 4 : 3) };
      }
      let righe = null, segRighe = null, fs;
      for (fs = S.definizioni ? 10.5 : 12; fs >= (opz.minFs || 7.5); fs -= 0.25) {
        segRighe = aCapo(segreta, fs, area.w);
        const hSeg = segRighe.length * fs * 1.22 + fs * 1.2, gap = 10, wc = (area.w - gap * (area.nc - 1)) / area.nc;
        const colonne = Array.from({ length: area.nc }, (_, i) => ({ x: area.x + i * (wc + gap), y: area.y, w: wc, h: area.h - hSeg }));
        if (colonne[0].h > fs * 2) righe = elencoCrucipuzzle(S, colonne, fs);
        if (righe) break;
      }
      if (!righe) continue;
      if (opz.prova) return true;
      doc.testo(box.x, box.y + ft, ft, (opz.titolo || "Crucipuzzle") + (opz.soluzione ? " — soluzione" : ""), { grassetto: true });
      if (opz.sottotitolo) doc.testo(box.x + box.w, box.y + ft, ft * 0.55, opz.sottotitolo, { destra: true, grigio: true });
      if (opz.soluzione) {
        const centro = (r, c) => [gx + (c + 0.5) * cella, top + (r + 0.5) * cella];
        const segmenti = S.parole.map(p => centro(p.r0, p.c0).concat(centro(p.r0 + p.dr * (p.len - 1), p.c0 + p.dc * (p.len - 1))));
        segmenti.forEach(s => doc.tratto(s[0], s[1], s[2], s[3], cella * 0.78, 0));
        segmenti.forEach(s => doc.tratto(s[0], s[1], s[2], s[3], cella * 0.78 - 1.3, 1));
      }
      for (let k = 0; k < N * N; k++) {
        const r = Math.floor(k / N), c = k % N;
        doc.testo(gx + (c + 0.5) * cella, top + (r + 0.72) * cella, cella * 0.52, S.griglia[k], { centro: true, grassetto: opz.soluzione && S.segreta.celle.includes(k) });
      }
      doc.rett(gx, top, cella * N, cella * N, false, 1.2);
      righe.forEach(t => doc.testo(t.x, t.y, t.fs, t.testo, { grassetto: t.grassetto }));
      const ySeg = area.y + area.h - segRighe.length * fs * 1.22;
      segRighe.forEach((r, i) => doc.testo(area.x, ySeg + fs + i * fs * 1.22, fs, r));
      doc.linea(area.x, ySeg - fs * 0.5, area.x + area.w, ySeg - fs * 0.5, 0.4, true);
      return true;
    }
    return false;
  }

  function pdfCrucipuzzle(S, opz) {
    opz = opz || {};
    const m = 12 * MM;
    if (opz.formato === "mezza" || opz.formato === "doppia") {
      const prova = opz.formato === "mezza"
        ? { larg: 210 * MM, alt: 148.5 * MM, box: { x: m, y: m, w: 210 * MM - 2 * m, h: 148.5 * MM - 2 * m }, modo: "accanto" }
        : { larg: 297 * MM, alt: 210 * MM, box: { x: m * 0.8, y: m, w: 148.5 * MM - m * 1.6, h: 210 * MM - 2 * m }, modo: "sotto" };
      if (!disegnaCrucipuzzle(documento(prova.larg, prova.alt).pagina(), prova.box, S, Object.assign({}, opz, { modo: prova.modo, prova: true }))) {
        opz = Object.assign({}, opz, { formato: "a4" });
        E.avviso("Il crucipuzzle è grande: l'ho impaginato su un A4 intero perché resti leggibile.", "ok");
      }
    }
    let doc;
    if (opz.formato === "mezza") {
      doc = documento(210 * MM, 148.5 * MM).pagina();
      disegnaCrucipuzzle(doc, { x: m, y: m, w: doc.larg - 2 * m, h: doc.alt - 2 * m }, S, Object.assign({}, opz, { modo: "accanto" }));
    } else if (opz.formato === "doppia") {
      doc = documento(297 * MM, 210 * MM).pagina();
      const meta = doc.larg / 2;
      [0, meta].forEach(x0 => disegnaCrucipuzzle(doc, { x: x0 + m * 0.8, y: m, w: meta - m * 1.6, h: doc.alt - 2 * m }, S, Object.assign({}, opz, { modo: "sotto" })));
      doc.linea(meta, m * 0.5, meta, doc.alt - m * 0.5, 0.6, true);
      doc.testo(meta + 3, doc.alt - m * 0.5, 6, "taglia qui", { grigio: true });
    } else {
      doc = documento(210 * MM, 297 * MM).pagina();
      const box = { x: m, y: m, w: doc.larg - 2 * m, h: doc.alt - 2 * m };
      if (!disegnaCrucipuzzle(doc, box, S, Object.assign({}, opz, { modo: "sotto" })) &&
          !disegnaCrucipuzzle(doc, box, S, Object.assign({}, opz, { modo: "sotto", minFs: 6.5 }))) {
        E.avviso("L'elenco è troppo lungo per un solo foglio.", "errore");
        return;
      }
    }
    doc.scarica(nomeFile(opz.soluzione ? "crucipuzzle-soluzione" : "crucipuzzle", ""));
  }

  /* ---------- Futoshiki e Calcudoku ---------- */

  function disegnaLatino(doc, box, S, opz) {
    const N = S.lato, ft = Math.min(16, box.h * 0.05 + 4), futo = S.tipo === "futoshiki";
    doc.testo(box.x, box.y + ft, ft, (futo ? "Futoshiki" : "Calcudoku") + (opz.soluzione ? " — soluzione" : ""), { grassetto: true });
    if (opz.sottotitolo) doc.testo(box.x + box.w, box.y + ft, ft * 0.55, opz.sottotitolo, { destra: true, grigio: true });
    const top = box.y + ft * 1.8, lato = Math.min(box.w, box.h - (top - box.y), 16 * 28.35), gx = box.x + (box.w - lato) / 2;
    const numero = (i, x, y, cella) => {
      const v = opz.soluzione ? S.soluzione[i] : S.date[i];
      if (v) doc.testo(x + cella / 2, y + cella * (futo ? 0.7 : 0.78), cella * 0.5, String(v), { centro: true, grassetto: !!S.date[i], grigio: !S.date[i] });
    };
    if (futo) {
      const cella = lato / (N + 0.42 * (N - 1)), passo = cella * 1.42, sp = Math.max(1, cella * 0.045);
      const pos = i => [gx + (i % N) * passo, top + Math.floor(i / N) * passo];
      for (let i = 0; i < N * N; i++) { const [x, y] = pos(i); doc.rett(x, y, cella, cella, false, 1.3); numero(i, x, y, cella); }
      // Ogni segno è una punta rivolta verso il numero più piccolo.
      for (const s of S.segni) {
        const [xa, ya] = pos(s.a), [xb, yb] = pos(s.b), g = cella * 0.42, h = cella * 0.09;
        if (ya === yb) {
          const cx = Math.min(xa, xb) + cella + g / 2, cy = ya + cella / 2, d = xa < xb ? -1 : 1;
          doc.tratto(cx + d * h, cy, cx - d * h, cy - h * 1.3, sp); doc.tratto(cx + d * h, cy, cx - d * h, cy + h * 1.3, sp);
        } else {
          const cx = xa + cella / 2, cy = Math.min(ya, yb) + cella + g / 2, d = ya < yb ? -1 : 1;
          doc.tratto(cx, cy + d * h, cx - h * 1.3, cy - d * h, sp); doc.tratto(cx, cy + d * h, cx + h * 1.3, cy - d * h, sp);
        }
      }
    } else {
      const cella = lato / N, gabbiaDi = [];
      S.gabbie.forEach((q, k) => q.celle.forEach(i => { gabbiaDi[i] = k; }));
      for (let k = 1; k < N; k++) {
        doc.linea(gx + k * cella, top, gx + k * cella, top + lato, 0.4);
        doc.linea(gx, top + k * cella, gx + lato, top + k * cella, 0.4);
      }
      for (let i = 0; i < N * N; i++) {
        const r = Math.floor(i / N), c = i % N, x = gx + c * cella, y = top + r * cella;
        if (c < N - 1 && gabbiaDi[i + 1] !== gabbiaDi[i]) doc.tratto(x + cella, y, x + cella, y + cella, 2.2);
        if (r < N - 1 && gabbiaDi[i + N] !== gabbiaDi[i]) doc.tratto(x, y + cella, x + cella, y + cella, 2.2);
        numero(i, x, y, cella);
      }
      S.gabbie.forEach(q => {
        const i = q.celle[0];
        doc.testo(gx + (i % N) * cella + cella * 0.07, top + Math.floor(i / N) * cella + cella * 0.24, cella * 0.2, q.op ? q.t + q.op : String(q.t), { grassetto: true });
      });
      doc.rett(gx, top, lato, lato, false, 2.4);
    }
  }

  function pdfLatino(S, opz) {
    opz = opz || {};
    const m = 14 * MM;
    let doc;
    if (opz.formato === "mezza") {
      doc = documento(210 * MM, 148.5 * MM).pagina();
      disegnaLatino(doc, { x: m, y: m * 0.7, w: doc.larg - 2 * m, h: doc.alt - 1.4 * m }, S, opz);
    } else if (opz.formato === "doppia") {
      doc = documento(297 * MM, 210 * MM).pagina();
      const meta = doc.larg / 2;
      [0, meta].forEach(x0 => disegnaLatino(doc, { x: x0 + m * 0.6, y: m, w: meta - m * 1.2, h: doc.alt - 2 * m }, S, opz));
      doc.linea(meta, m * 0.5, meta, doc.alt - m * 0.5, 0.6, true);
    } else {
      doc = documento(210 * MM, 297 * MM).pagina();
      disegnaLatino(doc, { x: m, y: m, w: doc.larg - 2 * m, h: doc.alt - 2 * m }, S, opz);
    }
    doc.scarica(nomeFile((S.tipo || "griglia") + (opz.soluzione ? "-soluzione" : ""), ""));
  }

  // Menu riutilizzabile: formato + vuoto/soluzione + pulsante.
  function menuPdf(crea) {
    const el = E.el;
    const formati = [{ id: "a4", nome: "A4 intero" }, { id: "mezza", nome: "Mezza pagina orizzontale" }, { id: "doppia", nome: "Due copie affiancate (A4 orizzontale)" }];
    let formato = E.memoria.leggi("pdf:formato", "a4");
    const sel = el("select", { "aria-label": "Formato del PDF", onchange: e => { formato = e.target.value; E.memoria.scrivi("pdf:formato", formato); } },
      formati.map(f => el("option", { value: f.id, selected: f.id === formato }, f.nome)));
    return el("div", { class: "menu-pdf" },
      el("span", { class: "etichetta-pdf" }, "PDF"), sel,
      el("button", { class: "secondario", onclick: () => crea({ formato, soluzione: false }) }, "Scarica vuoto"),
      el("button", { class: "secondario", onclick: () => crea({ formato, soluzione: true }) }, "Scarica con soluzione"));
  }

  E.pdf = { pdfCruciverba, pdfSudoku, pdfCrucipuzzle, pdfLatino, menuPdf };
})();
