# CLAUDE.md

Guida per Claude Code su questo progetto. L'utente scrive in italiano: rispondi in italiano.

## Cos'è

App web statica di enigmistica in italiano (cruciverba, sudoku, editor di cruciverba, PDF).
Niente build, niente dipendenze, niente framework: HTML + CSS + JavaScript "vanilla" caricati con
`<script>` in `index.html`. Deve continuare a funzionare aprendo `index.html` con doppio clic
(protocollo `file://`): quindi niente `fetch` dei dati, niente moduli ES, niente CDN obbligatori
(i font Google sono facoltativi, con fallback).

Pensata anche per la scuola: contenuti adatti a studenti, interfaccia chiara, stampa e PDF leggibili.

## Architettura

- `js/core.js` definisce `window.Enigmistica` (abbreviato `E`): `MATERIE`, `archivio`, `parole()`,
  `voci()`, `registraGioco()`, `memoria` (localStorage con try/catch, prefisso `enigmistica:`),
  `el()` per creare nodi DOM, `cronometro()`, `avviso()` (toast), `puoStampare`.
- Ogni gioco in `js/giochi/*.js` è un IIFE che chiama `E.registraGioco({ id, nome, descrizione, monta })`.
  `monta(contenitore)` disegna il gioco e restituisce `{ smonta() }`. La navigazione è per hash (`#cruciverba`).
- `js/giochi/cruciverba.js`: generatore a schema libero (`tentativo`, `genera`, `componi`), `LIVELLI`
  (lato, notorietà massima, quali definizioni usare, obiettivo di parole). Esporta `E._cruciverba`.
- `js/giochi/crucipuzzle.js`: cerca-parole. Generatore in tre fasi (parole principali dove incrociano,
  riempimento dei buchi con indice per lunghezza/posizione, parola segreta con le lettere avanzate) e
  controllo che ogni parola compaia una sola volta (`occorrenze`). Selezione per trascinamento o tocco
  inizio/fine, tratti in SVG sopra la griglia. PDF in `pdfCrucipuzzle`. Esporta `E._crucipuzzle`.
- `js/giochi/indovina.js`: tre definizioni dalla difficile alla facile (3/2/1 punti), da soli o a squadre;
  le parole già uscite sono in `memoria` "indovina:viste". Esporta `E._indovina`.
- `js/giochi/latini.js`: Futoshiki e Calcudoku in un solo modulo (due `registraGioco`). Quadrato latino
  casuale, risolutore con candidati a maschera di bit (righe/colonne + segni o gabbie, `possibile`) che
  conta fino a 2 soluzioni. Unicità: Futoshiki aggiunge numeri dove due soluzioni differiscono e poi toglie
  i superflui; Calcudoku stacca in una gabbia singola una casella ambigua. Fra alcune griglie tiene quella
  con meno numeri dati. PDF in `pdfLatino`. Esporta `E._latini`.
- `registraGioco` accetta anche `livelli` (per le statistiche della home) e `misura: "punti"`
  (punteggio migliore al posto del tempo).
- `js/giochi/editor.js`: editor. Griglia a caselle nere (`trovaSlot`, `generaNere` simmetrico o vario),
  risolutore a backtracking con indice per lunghezza/posizione (`creaIndice`, `candidati`, `risolvi`),
  che annerisce caselle dove fallisce. Lo stato della bozza è in `memoria` "editor:bozza".
  "Gioca" costruisce uno stato nello stesso formato di `componi()` e lo passa al cruciverba.
- `js/giochi/sudoku.js`: generatore con soluzione unica, rimozione simmetrica, `valuta()` stima la
  tecnica richiesta (singoli nudi, singoli nascosti, incastri/coppie, oltre).
- `js/pdf.js`: scrive PDF a mano (Helvetica WinAnsi, larghezze dei caratteri in tabella),
  formati "a4" / "mezza" / "doppia" (A4 orizzontale, due copie). Corpo minimo delle definizioni 8 pt:
  se non entra, passa all'A4 intero.

## Archivio parole

- `data/cruciverba/<id>.js` e `<id>-piu.js` chiamano `Enigmistica.parole("<id>", [...])`.
  L'id deve esistere in `MATERIE` (`js/core.js`) e il file deve avere un `<script>` in `index.html`.
- Voce: `[RISPOSTA, notorietà 1-3, facile, media, difficile]`; ogni definizione è stringa o array di alternative.
  Risposte ripetute nella stessa materia si fondono (le definizioni si sommano).
- Regole di qualità delle definizioni (da rispettare sempre):
  - stile da cruciverba italiano, brevi (max ~70 caratteri), senza punto finale;
  - concordanza di genere e numero con la risposta;
  - la definizione non deve contenere la risposta né una parola che la contiene;
  - facile = diretta, media = richiede cultura, difficile = enigmatica ma corretta e leale;
  - esattezza dei fatti prima di tutto; evitare fatti che cambiano nel tempo;
  - **mai copiare definizioni da riviste o siti di cruciverba, né testi di canzoni** (diritto d'autore);
  - neutralità politica, rispetto per le religioni, adatto a un pubblico scolastico.
- Dopo modifiche all'archivio: `strumenti/verifica-archivio.html` (serve il server locale).

## Convenzioni

- Codice, nomi e commenti in italiano, stile compatto come quello esistente.
- Colori solo tramite variabili CSS in `:root`, con tema scuro (`prefers-color-scheme` e `data-theme`).
  Le caselle del cruciverba usano i token `--cv-*` (restano chiare anche nel tema scuro).
- Niente `alert`/`confirm`: per le azioni distruttive c'è il pulsante a doppio clic `conferma(...)`.
- Prima di dire che qualcosa funziona, provalo nel browser (server: `strumenti/server.ps1`, porta 8765).
- File di testo in UTF-8 senza BOM. In PowerShell 5.1 usare `[IO.File]::WriteAllText(..., UTF8Encoding($false))`.

## Prossimi passi previsti

Giochi in `IN_ARRIVO` (`js/app.js`): rebus, zeppe, sciarade, aggiunte, elisioni, palindromi,
anagrammi, cambi di lettera. Per i giochi di parole conviene un archivio dedicato in `data/<gioco>/`.
