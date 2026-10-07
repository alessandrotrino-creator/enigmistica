# Enigmistica

Giochi di parole e di numeri in italiano, in una pagina web che funziona anche senza connessione.

- **Cruciverba**: schemi sempre nuovi, 18 materie da includere o escludere, 5 livelli di difficoltà,
  definizioni dalla più facile alla più enigmatica, possibilità di costruire lo schema attorno a una parola.
- **Sudoku**: griglie con soluzione unica, 5 livelli valutati con tecniche di risoluzione "umane".
- **Crea cruciverba**: editor con parole e definizioni proprie, schema classico, vario, disegnato
  a mano o libero, completato con parole dell'archivio scelte per materia e difficoltà.
- **PDF**: schema vuoto o con soluzione, in A4, mezza pagina orizzontale o due copie affiancate.

## Come si usa

Apri `index.html` con un browser (doppio clic). Partite, preferenze, parole e schemi personali
si salvano da soli nel browser del computer che stai usando.

I PDF vengono scaricati nella cartella dei download impostata nel browser (di solito *Download*).

## Archivio del cruciverba

9.623 parole e 40.912 definizioni, scritte appositamente per questo progetto.

| Materia | Parole | Definizioni |
|---|---:|---:|
| Cultura generale | 543 | 2.251 |
| Parole comuni | 924 | 3.792 |
| Italiano | 390 | 1.674 |
| Letteratura | 473 | 1.974 |
| Storia | 729 | 2.713 |
| Geografia | 634 | 2.428 |
| Scienze | 527 | 2.136 |
| Matematica | 265 | 1.154 |
| Tecnologia | 302 | 1.267 |
| Natura | 589 | 2.397 |
| Arte | 431 | 1.704 |
| Musica | 453 | 1.743 |
| Cinema e TV | 505 | 1.974 |
| Sport | 468 | 1.818 |
| Miti e religioni | 450 | 1.721 |
| Cucina | 607 | 2.197 |
| Inglese | 762 | 4.496 |
| Educazione civica | 571 | 3.473 |

Le definizioni non sono copiate da riviste o siti di cruciverba, che sono protetti dal diritto d'autore.

## Struttura

```
index.html                    pagina principale: carica tutti i file qui sotto, nell'ordine
css/stile.css                 aspetto, tema chiaro e scuro, stampa
js/core.js                    nucleo: registro dei giochi, archivio parole, memoria, utilità
js/pdf.js                     generatore di PDF senza librerie esterne
js/app.js                     schermata iniziale, archivio, statistiche, giochi "in arrivo"
js/giochi/cruciverba.js       generatore e griglia del cruciverba
js/giochi/sudoku.js           generatore e griglia del sudoku
js/giochi/editor.js           editor di cruciverba
data/cruciverba/<materia>.js       archivio di base, un file per materia
data/cruciverba/<materia>-piu.js   ampliamenti: parole nuove e definizioni alternative
strumenti/                    server locale e verifica dell'archivio (per chi sviluppa)
```

## Aggiungere parole

Ogni voce dei file in `data/cruciverba/` ha questa forma:

```js
["RISPOSTA", notorietà, "facile", "media", "difficile"],
["ELBA", 1, ["Isola dell'esilio di Napoleone", "Isola toscana del ferro"], "…", ["…", "…"]],
```

- `RISPOSTA`: maiuscole senza accenti (CITTA, PERCHE); al massimo due parole separate da spazio.
- `notorietà`: 1 parola comune, 2 cultura generale, 3 parola ricercata.
- Ogni definizione può essere una stringa o un elenco di alternative: a ogni partita ne esce una a caso.
- Se la stessa risposta compare di nuovo nella stessa materia (per esempio in un file `-piu.js`),
  le definizioni si aggiungono a quelle esistenti.

Dopo aver modificato l'archivio, apri `strumenti/verifica-archivio.html` (con il server locale)
per controllare errori di formato e definizioni che contengono la risposta.

## Aggiungere un gioco

Crea `js/giochi/nome.js`, registra il gioco e aggiungi il suo `<script>` in `index.html` prima di `js/app.js`:

```js
Enigmistica.registraGioco({
  id: "zeppe",
  nome: "Zeppe",
  descrizione: "Una lettera in più cambia la parola.",
  monta(contenitore) {
    // disegna il gioco dentro "contenitore"
    return { smonta() { /* salva lo stato, ferma i timer */ } };
  }
});
```

Il gioco compare da solo nella schermata iniziale. Quelli previsti (rebus, zeppe, sciarade, aggiunte,
elisioni, palindromi, anagrammi, cambi di lettera) sono elencati in `IN_ARRIVO` dentro `js/app.js`.

## Server locale (facoltativo)

La pagina funziona con il doppio clic. Per gli strumenti di verifica serve un server locale:

```powershell
powershell -ExecutionPolicy Bypass -File strumenti\server.ps1
```

poi apri <http://localhost:8765>.
