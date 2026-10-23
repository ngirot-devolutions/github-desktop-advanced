# AGENTS.md

Point d'entrée pour les agents IA (Claude Code, Copilot, Codex, Cursor…) qui
travaillent sur ce dépôt. Lisez ce fichier en entier avant toute modification.

## But du projet

**GitHub Desktop Advanced** est un fork de
[GitHub Desktop](https://github.com/desktop/desktop) (`desktop/desktop`).

Objectif : garder la simplicité de GitHub Desktop tout en ajoutant les
fonctionnalités avancées qui font le succès des clients Git commerciaux : graphe
de commits, rebase interactif complet, éditeur de conflits intégré, gestion de
plusieurs stashes, blame, etc.

Le fork doit pouvoir **continuer à intégrer les évolutions upstream**. Chaque
modification doit donc minimiser les conflits avec `desktop/desktop` (voir les
règles du fork dans [docs/ai/patterns.md](docs/ai/patterns.md#13-règles-propres-au-fork)).

## Documentation pour agents

| Document | Contenu |
|----------|---------|
| [docs/ai/advanced-features-roadmap.md](docs/ai/advanced-features-roadmap.md) | Fonctionnalités avancées manquantes, priorisées, avec identifiants `ADV-xx`, statuts et pistes techniques. **C'est le backlog du fork.** |
| [docs/ai/patterns.md](docs/ai/patterns.md) | Patterns d'architecture et conventions **obligatoires** : flux de données, couche Git, dialogues, IPC, TypeScript, React, styles, tests, règles du fork. |

Documentation upstream utile (en lecture, ne pas la modifier) :

- [.github/copilot-instructions.md](.github/copilot-instructions.md) : conventions upstream.
- [.github/skills/testing/SKILL.md](.github/skills/testing/SKILL.md) : guide de tests détaillé.
- [docs/contributing/](docs/contributing) : setup, styleguide, valeurs d'ingénierie.
- [docs/technical/](docs/technical) : dialogues, feature flags, flux de rebase, etc.

## Stack technique

| Domaine | Technologie |
|---------|-------------|
| Application | [Electron](https://www.electronjs.org/) 44 : process main et renderer |
| Langage | TypeScript 6 (strict) |
| UI | React 16, composants classe, react-virtualized pour les listes |
| Styles | SCSS (`app/styles/`), variables CSS de thème (clair et sombre) |
| Git | [dugite](https://github.com/desktop/dugite) : binaire Git embarqué, appelé via `app/src/lib/git/core.ts` |
| Éditeur et diff | CodeMirror 5 |
| Persistance | Dexie (IndexedDB), `localStorage`, keytar (secrets) |
| API | GitHub REST et GraphQL (`app/src/lib/api.ts`), GitHub Copilot SDK |
| Build | Webpack 5, ts-node pour les scripts (`script/`) |
| Tests | Runner Node intégré (`node:test`), React Testing Library + JSDOM, Playwright (E2E) |
| Qualité | ESLint (+ règles maison dans `eslint-rules/`), Prettier, markdownlint |
| Outils | Node 24 (`.node-version`), Yarn 1 |

## Structure du dépôt

```text
app/
  src/
    main-process/   Process principal Electron (fenêtres, menus, IPC main, mises à jour)
    ui/             Composants React (renderer), un dossier par feature
      dispatcher/   Dispatcher : point d'entrée unique des actions de l'UI
    lib/
      git/          Une fonction par opération Git (sans état)
      stores/       AppStore, GitStore et autres stores (état applicatif)
      databases/    Bases Dexie
      app-state.ts  Types de l'état global (IAppState, IRepositoryState…)
    models/         Types et modèles de domaine (Repository, Commit, Popup…)
    cli/            CLI `github`
  styles/           SCSS (ui/_<feature>.scss importés dans _ui.scss)
  test/
    unit/           Tests unitaires et d'intégration (*-test.ts), ui/ pour les composants
    e2e/            Tests Playwright
    helpers/        Helpers de test (dépôts temporaires, mocks, stores)
script/             Build, packaging, lancement
eslint-rules/       Règles ESLint spécifiques au projet
docs/               Documentation upstream ; docs/ai/ = documentation du fork pour agents
```

Flux d'une action (détails dans [patterns.md](docs/ai/patterns.md#1-architecture-en-couches-et-flux-de-données)) :

```text
UI → Dispatcher → AppStore._xxx → GitStore → lib/git/*.ts → dugite
                       │
                       └─ emitUpdate() → IAppState → App → props
```

## Commandes

```bash
yarn                 # installer les dépendances
yarn build:dev       # build de développement
yarn start           # lancer l'application en mode dev
yarn test            # tous les tests unitaires et UI
yarn test <fichier>  # un fichier ou un dossier de tests
yarn lint            # Prettier + ESLint (lecture seule)
yarn lint:fix        # corrige automatiquement (réécrit les fichiers)
yarn markdownlint    # lint de la documentation Markdown
```

## Règles d'or

1. Respecter [docs/ai/patterns.md](docs/ai/patterns.md). En cas de doute,
   imiter le code existant le plus proche.
2. Passer **toujours** par le `Dispatcher` depuis l'UI. Jamais d'appel direct
   à un store ou à `lib/git` depuis un composant.
3. Nouvelle fonctionnalité : nouveaux fichiers, points d'accroche minimaux dans
   les fichiers upstream, feature flag dans `app/src/lib/feature-flag.ts`.
4. Logique non triviale : fonctions pures et testées.
5. Lier le travail à un identifiant `ADV-xx` de la
   [roadmap](docs/ai/advanced-features-roadmap.md) et mettre à jour son statut.
6. Avant de terminer : `yarn test` (fichiers concernés au minimum) et
   `yarn lint`.
7. Ne jamais committer de secrets. Ne pas modifier la documentation upstream.
