# Patterns du projet (à respecter)

Ce document décrit les patterns que tout code ajouté à ce fork **doit**
respecter. Il synthétise les conventions upstream de GitHub Desktop et ajoute
des règles propres au fork.

Sources de référence (upstream, à lire en cas de doute) :

- [`.github/copilot-instructions.md`](../../.github/copilot-instructions.md)
- [`docs/contributing/styleguide.md`](../contributing/styleguide.md)
- [`docs/contributing/engineering-values.md`](../contributing/engineering-values.md)
- [`.github/skills/testing/SKILL.md`](../../.github/skills/testing/SKILL.md)
- [`.eslintrc.yml`](../../.eslintrc.yml) et [`eslint-rules/`](../../eslint-rules)

Quand ce document et le code existant divergent, **le code existant le plus
proche fait foi**. Signalez l'écart plutôt que de le « corriger » en masse.

---

## 1. Architecture en couches et flux de données

```text
Composant React (app/src/ui/**)
   │  appelle une méthode publique
   ▼
Dispatcher (app/src/ui/dispatcher/dispatcher.ts)
   │  délègue, sans logique
   ▼
AppStore._methode (app/src/lib/stores/app-store.ts)
   │  récupère le GitStore du dépôt : this.gitStoreCache.get(repository)
   ▼
GitStore (app/src/lib/stores/git-store.ts)
   │  performFailableOperation(...) puis rafraîchit son état
   ▼
Fonction Git (app/src/lib/git/*.ts)
   │  git(args, repository.path, 'nomOperation', options)
   ▼
dugite (binaire Git embarqué)
```

Le retour de l'état est **unidirectionnel** :

1. Les stores mutent leur état interne, puis appellent `emitUpdate()`
   (`app/src/lib/stores/base-store.ts`).
2. L'`AppStore` recompose un `IAppState` immuable (`app/src/lib/app-state.ts`).
3. Le composant `App` (`app/src/ui/app.tsx`) le reçoit et le redistribue en
   props.
4. L'état propre à un dépôt vit dans `IRepositoryState`, géré par
   `RepositoryStateCache` (`updateCompareState`, `updateChangesState`, etc.).

Règles :

- **Un composant UI ne parle jamais directement à un store ni à `lib/git`.**
  Il passe toujours par le `Dispatcher`.
- **Le `Dispatcher` ne contient pas de logique** : il délègue à
  `this.appStore._xxx(...)`.
- Les méthodes de l'`AppStore` appelées par le `Dispatcher` sont préfixées par
  `_` et documentées ainsi :

  ```ts
  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _createTag(repository: Repository, name: string, sha: string) {
    const gitStore = this.gitStoreCache.get(repository)
    await gitStore.createTag(name, sha)
  }
  ```

- Les fonctions de `app/src/lib/git/` sont **sans état** : elles prennent un
  `Repository` et des valeurs, puis renvoient un résultat typé. Pas d'accès
  aux stores.

### Exemple de référence de bout en bout : les tags

| Couche | Fichier |
|--------|---------|
| Git | `app/src/lib/git/tag.ts` (`createTag`) |
| GitStore | `app/src/lib/stores/git-store.ts` (`createTag`) |
| AppStore | `app/src/lib/stores/app-store.ts` (`_createTag`) |
| Dispatcher | `app/src/ui/dispatcher/dispatcher.ts` (`createTag`) |
| Popup | `app/src/models/popup.ts` (`PopupType.CreateTag`) |
| Rendu du popup | `app/src/ui/app.tsx` (`case PopupType.CreateTag`) |
| Dialogue | `app/src/ui/create-tag/create-tag-dialog.tsx` |

Copiez ce découpage pour toute nouvelle opération Git.

---

## 2. Couche Git (`app/src/lib/git/`)

- Toujours passer par `git()` de `app/src/lib/git/core.ts`, avec les arguments
  **sous forme de tableau** (jamais de chaîne concaténée ni de shell).
- Le 3ᵉ paramètre `name` identifie l'opération dans les logs et les erreurs
  (ex. `'createTag'`).
- Codes de sortie non nuls attendus : `successExitCodes: new Set([0, 1])`.
  Erreurs Git attendues : `expectedErrors`.
- Opérations réseau (fetch, push, ls-remote…) : utiliser
  `envForRemoteOperation` (`app/src/lib/git/environment.ts`) pour l'auth et le
  proxy.
- **Séparateurs d'arguments** (voir le styleguide) :
  - options avant les opérandes ;
  - `--` avant remotes et refspecs pour `fetch` et `push` ;
  - `--end-of-options` avant les révisions explicites, `--` entre révisions et
    chemins pour `log`, `diff` et `rev-list` ;
  - préférer `refs/remotes/<remote>/<branche>` comme point de départ.
- **Parser des sorties machine** (`--porcelain`, `-z`, `--null`, formats avec
  délimiteurs explicites). Ne jamais parser une sortie destinée aux humains.
  Pour un format de log personnalisé, voir `git-delimiter-parser.ts`.
- La logique de parsing doit être une fonction pure, exportée et testée
  séparément de l'appel Git.
- API Node asynchrones uniquement (`no-sync`). Si une API synchrone est
  inévitable, suffixer la fonction par `Sync`.

---

## 3. Gestion des erreurs

- Côté `GitStore`, encapsuler les opérations avec
  `this.performFailableOperation(async () => { ... })`. En cas d'échec, la
  méthode renvoie `undefined` et l'erreur est émise avec ses métadonnées
  (`ErrorWithMetadata`), puis affichée par le système d'erreurs global.
- Tester `if (result === undefined) { return }` avant de rafraîchir l'état.
- Dans un dialogue, **afficher l'erreur inline** quand c'est pertinent plutôt
  que d'ouvrir un dialogue d'erreur (voir `docs/technical/dialogs.md`).
- Exhaustivité : utiliser `assertNever` (`app/src/lib/fatal-error.ts`) dans
  les `switch` sur des unions discriminées.

---

## 4. Popups et dialogues

Pour ajouter un dialogue :

1. Ajouter une valeur à `PopupType` et une variante à l'union `Popup` dans
   `app/src/models/popup.ts`.
2. Ajouter le `case` correspondant dans le rendu des popups de
   `app/src/ui/app.tsx`, avec un `key` stable et `onDismissed`.
3. Créer le composant dans son propre dossier `app/src/ui/<feature>/`, avec un
   `index.ts` qui ré-exporte.
4. Ouvrir le popup via `dispatcher.showPopup({ type: PopupType.X, ... })`.

Structure d'un dialogue (voir `docs/technical/dialogs.md` et
`docs/technical/button-order.md`) :

```tsx
<Dialog title="…" onSubmit={this.onSubmit} onDismissed={this.props.onDismissed}>
  <DialogContent>…</DialogContent>
  <DialogFooter>
    <OkCancelButtonGroup okButtonText="…" destructive={false} />
  </DialogFooter>
</Dialog>
```

- Utiliser `OkCancelButtonGroup` : il gère l'ordre des boutons selon la
  plateforme.
- `destructive={true}` pour toute action difficile à annuler.

---

## 5. Menus, raccourcis et IPC

- Les entrées de menu applicatif sont définies dans
  `app/src/main-process/menu/build-default-menu.ts` et émettent un
  `MenuEvent` (union de chaînes dans `menu-event.ts`), traité par
  `onMenuEvent` dans `app/src/ui/app.tsx`.
- Menus contextuels : `app/src/ui/lib/context-menu.ts`.
- IPC **toujours typé** :
  - `import * as ipcRenderer from 'ipc-renderer'` (`app/src/lib/ipc-renderer.ts`) ;
  - `import * as ipcMain from 'ipc-main'` ;
  - canaux déclarés dans `RequestChannels` / `RequestResponseChannels`
    (`app/src/lib/ipc-shared.ts`).
  - Importer `ipcRenderer` ou `ipcMain` directement depuis `electron` est
    interdit par l'ESLint.

---

## 6. TypeScript

- Mode strict. Pas de `any` sauf nécessité, éviter `!` et les assertions `as`,
  préférer le narrowing et les type guards.
- Interfaces préfixées par `I` (`IRepositoryState`), classes en PascalCase,
  méthodes et propriétés en camelCase.
- **Pas d'export par défaut** : exports nommés uniquement.
- Accessibilité explicite (`public` / `private` / `protected`) sur tous les
  membres de classe.
- Ordre des membres : champs statiques, méthodes statiques, champs,
  méthodes abstraites, constructeur, méthodes.
- Nouveau code : **unions de littéraux** plutôt que des `enum`, et fonctions
  plutôt que classes. Les `enum` existants (ex. `PopupType`) s'étendent, ils
  ne se convertissent pas.
- JSDoc avec `/**` (exactement deux étoiles), titre court, ligne vide, puis
  détail. Documenter toute API publique.

---

## 7. Immutabilité et fonctions pures

- `const` partout. Ternaire plutôt que `let` réassigné.
- `ReadonlyArray<T>`, `readonly` sur les champs des interfaces et des
  paramètres.
- Séparer **collecte des données** (I/O, stores) et **calcul** (fonction pure,
  testable). Une logique non triviale (layout de graphe, parsing, calcul de
  todo list de rebase…) vit dans une fonction exportée hors de la classe ou du
  composant.

---

## 8. React

- React 16, **composants classe uniquement** (pas de hooks dans la base
  actuelle). Restez cohérent avec ce style.
- Props et state `readonly` (règle `react-readonly-props-and-state`).
- Pas de `bind` ni de fonction fléchée inline dans le JSX (`react/jsx-no-bind`).
  Utiliser des champs fléchés :

  ```tsx
  private onClick = () => {
    this.props.dispatcher.doSomething(this.props.repository)
  }
  ```

- Ne jamais passer une méthode du dispatcher non liée en callback
  (`react-no-unbound-dispatcher-props`).
- Booléens JSX explicites : `disabled={true}`, pas `disabled`.
- Méthodes de cycle de vie correctes (`react-proper-lifecycle-methods`).
- Listes longues : utiliser `List` ou `SectionList` (`app/src/ui/lib/list/`,
  virtualisées). Ne jamais rendre des milliers de lignes directement.
- Accessibilité : rôles et `aria-*` corrects, navigation clavier, focus géré
  dans les dialogues.

---

## 9. Styles

- SCSS dans `app/styles/ui/_<feature>.scss`, importé dans
  `app/styles/_ui.scss`.
- Utiliser les variables CSS du thème (`var(--text-color)`,
  `var(--spacing)`, `var(--spacing-half)`…), jamais de couleurs codées en dur :
  le thème clair et le thème sombre doivent fonctionner.
- Noms de classes en kebab-case, préfixés par le nom de la feature.
- Icônes : Octicons via `app/src/ui/octicons/`.

---

## 10. Persistance et configuration

- Préférences légères : helpers de `app/src/lib/local-storage.ts`
  (`getBoolean` / `setBoolean`, `getNumber`…).
- Données structurées : bases Dexie dans `app/src/lib/databases/`. Toute
  évolution de schéma passe par une migration testée.
- Configuration Git : `app/src/lib/git/config.ts`, jamais d'écriture directe
  dans `.git/config`.
- Secrets et jetons : `keytar` via `app/src/lib/stores/token-store.ts`. Jamais
  en clair.

---

## 11. Feature flags

Toute nouvelle fonctionnalité visible du fork (entrées `ADV-xx`) est d'abord
protégée par un feature flag :

- ajouter une fonction `enableXxx()` dans `app/src/lib/feature-flag.ts`,
  basée sur `enableBetaFeatures()` ou `enableDevelopmentFeatures()` ;
- l'interface affiche l'ancien ou le nouveau comportement selon ce flag ;
- voir `docs/technical/feature-flagging.md`.

---

## 12. Tests

Détails complets : [`.github/skills/testing/SKILL.md`](../../.github/skills/testing/SKILL.md).

- Runner Node intégré (`node:test` + `node:assert`), pas Jest ni Mocha.
- Fichiers `*-test.ts(x)` dans `app/test/unit/`, en miroir de `app/src/`
  (ex. `app/src/lib/git/tag.ts` → `app/test/unit/git/tag-test.ts`).
  Composants UI dans `app/test/unit/ui/`.
- Réutiliser les helpers : `setupEmptyRepository(t)`,
  `setupFixtureRepository(t, name)`, `makeCommit()`, `createTestStores()`,
  `createMockAPI()`…
- Une opération Git est testée **contre un vrai dépôt temporaire** : vérifier
  l'état résultant (commits, refs, contenu), pas seulement le code de sortie.
- Correction de bug : écrire d'abord le test qui échoue.
- Préférer `assert.strictEqual` à `assert.equal`.

---

## 13. Règles propres au fork

Ce dépôt est un fork de `desktop/desktop`. Pour pouvoir **continuer à merger
l'upstream** sans douleur :

- **Nouveau code dans de nouveaux fichiers et dossiers** (ex.
  `app/src/ui/commit-graph/`, `app/src/lib/git/blame.ts`). Dans les fichiers
  « hotspots » upstream (`app-store.ts`, `dispatcher.ts`, `app.tsx`,
  `popup.ts`, `app-state.ts`, `git-store.ts`, `build-default-menu.ts`), se
  limiter à des **points d'accroche minces** : un `case`, une méthode de
  délégation, un champ d'état.
- Ne pas reformater, renommer ni déplacer du code upstream sans nécessité.
- Ne pas modifier la documentation upstream (`docs/contributing`,
  `docs/technical`, `docs/process`, `.github/copilot-instructions.md`). La
  documentation du fork vit dans `docs/ai/` et dans `AGENTS.md`.
- Référencer l'identifiant de la roadmap (`ADV-xx`) dans la branche, les
  commits et la PR. Mettre à jour le statut dans
  [advanced-features-roadmap.md](advanced-features-roadmap.md).
- Pour récupérer l'upstream :

  ```bash
  git remote add upstream https://github.com/desktop/desktop.git
  ```

  puis `git fetch upstream` et un merge de `upstream/development`.

- Données d'usage (stats) : si vous ajoutez des métriques, suivez la procédure
  « Usage Data Changes » de `.github/copilot-instructions.md`.

---

## 14. Checklist avant de proposer une PR

- [ ] Flux UI → Dispatcher → AppStore → GitStore → `lib/git` respecté
- [ ] Logique non triviale extraite en fonctions pures et testée
- [ ] Nouvelle fonctionnalité derrière un feature flag
- [ ] `yarn test` (ou au moins les fichiers concernés) passe
- [ ] `yarn lint` passe (`yarn lint:fix` réécrit les fichiers : à lancer en
      connaissance de cause)
- [ ] Thèmes clair et sombre vérifiés, accessibilité clavier OK
- [ ] Modifications des fichiers hotspots upstream minimales
- [ ] Statut `ADV-xx` mis à jour dans la roadmap
