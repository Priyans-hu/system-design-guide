# System Design Study Hub

A static study site: a weekend-paced system design roadmap, self-paced tracks (security, AI/LLM, testing, Go and Python, Linux and networking, career craft), real-world case studies with architecture graphs, pattern deep dives, a guide to database types, trade-off guides, an AWS service guide, tools, labs, and a 93-question practice notebook with original model answers.

Works offline. No server or build step is needed to use it.

```sh
open index.html
```

## What lives where

| Path | What it is |
| --- | --- |
| `index.html` | App shell: sidebar, top bar, bottom tabs, search palette |
| `assets/app.js` | The app: routing, views, progress, notebook, Cmd/Ctrl+K search |
| `assets/graph.js` | Layered architecture graphs (case studies, deep dives): layout, edges, hover details, request paths |
| `assets/app.css` | Compiled CSS. Do not edit by hand; edit `src/app.css` |
| `src/app.css` | Tailwind v4 source: design tokens (light and dark), components |
| `assets/fonts/` | Geist, Geist Mono, Bricolage Grotesque (SIL OFL 1.1, see `LICENSES/`) |
| `assets/icons.js` | Lucide icons (ISC, see `LICENSES/`) |
| `data/hub.js` | Roadmap phases, patterns, tools, labs, resources |
| `data/tracks-*.js` | Tracks beyond system design |
| `data/cases-*.js` | Case studies |
| `data/hld-*.js` | Case study architecture: layers, components, edges, request paths |
| `data/deep-*.js` | Pattern deep dives: problem, steps, diagram, variants, alternatives, pitfalls |
| `data/db-*.js` | Database types (SQL, key-value, document, wide-column, columnar, time-series, search, graph, vector and more): internals, diagram, products, when to use |
| `data/aws-*.js` | AWS services by building block, decision guides, cost traps |
| `data/tradeoffs.js` | Decision guides and when-not-to-use notes |
| `data/vault-questions.js`, `data/answers-w*.js` | The practice notebook |

## Rebuild the CSS

Only needed after changing classes in `index.html`, `assets/app.js` or `src/app.css`.

```sh
npm install
npm run build
```

## Progress

Saved in your browser's localStorage (`sdhub.*` keys), so it stays in this browser on this device. The Vault page has Backup and Restore buttons: the backup covers your answers, ticked topics and plan start date. Use them to move progress between browsers, devices, or a hosted copy.

## Credits

Question titles come from Puneet Patwari's public [System Design Q&A Vault](https://www.puneetpatwari.in/sample-question) list; all answers here are original. Case studies cite their public engineering sources.
