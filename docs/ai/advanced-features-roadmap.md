# Roadmap : fonctionnalités avancées manquantes

Liste des fonctionnalités courantes dans les clients Git avancés et absentes (ou très limitées)
dans ce fork de GitHub Desktop. La liste n'est pas exhaustive. Elle est classée
par **valeur perçue par les utilisateurs**, pas par difficulté.

- Base de comparaison : GitHub Desktop 3.6.8 (`app/package.json`).
- Dernière mise à jour : 2026-10-23.

## Comment utiliser ce document (agents IA)

- Chaque entrée a un identifiant stable (`ADV-xx`). Utilisez-le dans les noms de
  branches, les messages de commit et les PR (ex. `feature/ADV-05-multi-stash`).
- **Quand une fonctionnalité est livrée ou partiellement livrée**, mettez à jour
  son statut ici dans la même PR que le code.
- Les « pistes techniques » sont des points d'entrée dans le code, pas une
  conception imposée. Vérifiez-les avant de vous en servir : le code upstream
  évolue.
- Toute nouvelle fonctionnalité doit respecter [patterns.md](patterns.md),
  notamment l'utilisation d'un feature flag et la minimisation des conflits
  avec l'upstream.

Statuts : `todo` · `en cours` · `partiel` · `fait`.

## Déjà présent dans Desktop (à ne pas réimplémenter)

Worktrees (`app/src/ui/worktrees/`), squash, réordonnancement et cherry-pick par
glisser-déposer (`app/src/ui/multi-commit-operation/`), amend, revert, création
et suppression de tags, staging ligne par ligne, diff unifié et côte à côte avec
recherche, génération du message de commit par Copilot, résolution de conflits
par Copilot (`app/src/lib/copilot-conflict-resolution.ts`), dialogue des
commits inaccessibles (reflog), support basique de LFS.

## Priorité 1 : très demandé

### ADV-01 · Graphe de commits visuel — `partiel`

Vue de toutes les branches (locales et distantes) et des tags en même temps,
avec les lignes de merge et des couleurs par branche. C'est le principal
différenciateur des clients Git avancés. Desktop n'affiche qu'un historique linéaire de la
branche courante.

Livré (v1, derrière `enableCommitGraph()`) : onglet **Graph** pleine largeur
(colonnes Branch / Tag | graphe | message | auteur | date | SHA, réordonnables
par glisser-déposer ou menu contextuel, ordre mémorisé ; avatar de l'auteur sur
chaque commit, point pour les merges). Panneau de détails à droite (largeur
redimensionnable) : résumé à hauteur fixe et redimensionnable au-dessus des
fichiers, hauteurs et largeurs mémorisées.
Un clic sur un fichier affiche son diff à la place du graphe, fermé par ✕, Échap
ou en changeant de commit. Portée mémorisée : All / Local / Active (30 jours) /
Current + default / Current branch. Refs lues par `git for-each-ref` (inclut les
branches distantes suivies, que la liste de branches de Desktop exclut), passées
à `git log --stdin` ; chargement par pages de 300 commits (`--date-order`),
rafraîchissement uniquement quand les refs affichées changent. Branche locale et
upstream synchronisés fusionnés en un label. Colonne graphe redimensionnable
(double-clic : largeur auto), badge « +N » et fondu quand des lanes sont coupées.

- Données : `app/src/lib/git/commit-graph.ts`, `GitStore.loadCommitGraphBatch`,
  `AppStore._setCommitGraphScope` / `_loadNextCommitGraphBatch`,
  état `IRepositoryState.commitGraphState` (`app/src/models/commit-graph.ts`).
- Layout pur et testé : `app/src/lib/commit-graph/layout.ts` (lanes stables,
  colonnes libérées réutilisées), refs : `app/src/lib/commit-graph/refs.ts`.
- Rendu : `app/src/ui/commit-graph/` (liste virtualisée, une ligne SVG par
  commit), styles `app/styles/ui/_commit-graph.scss`.

Reste à faire :

- Largeur redimensionnable des autres colonnes.
- Compacter les lanes (ramener les lanes vers la gauche quand une colonne se
  libère) pour réduire la largeur du graphe sur les gros dépôts.
- Sélection multiple, navigation clavier vers parent / enfant.
- Les actions sur le graphe relèvent d'ADV-02, la recherche et le filtrage
  d'ADV-22.

### ADV-02 · Actions depuis le graphe — `todo` (dépend de ADV-01)

Clic droit sur n'importe quel commit ou branche : checkout, merge, rebase,
reset, créer une branche ou un tag. Glisser une branche sur une autre pour
merge ou rebase.

Pistes techniques : `app/src/lib/drag-and-drop-manager.ts`,
`app/src/models/drag-drop.ts`, menus contextuels via
`app/src/ui/lib/context-menu.ts`.

### ADV-03 · Éditeur de conflits intégré à 3 panneaux — `todo`

Ours / theirs / résultat éditable, choix bloc par bloc ou ligne par ligne.
Aujourd'hui Desktop ne propose que « garder ma version / la leur » pour tout le
fichier, un éditeur externe, ou la résolution par Copilot. Il manque l'édition
manuelle fine.

Pistes techniques : `app/src/ui/merge-conflicts/`,
`app/src/models/manual-conflict-resolution.ts`, CodeMirror 5 est déjà une
dépendance (`app/package.json`).

### ADV-04 · Rebase interactif complet — `todo`

Une seule vue avec pick / reword / squash / fixup / drop / edit sur une plage
de commits. Desktop n'a que des opérations séparées (squash, réordonnancement),
sans drop, fixup, edit, ni reword au-delà du dernier commit (amend).

Pistes techniques : `app/src/lib/git/rebase.ts`, `reorder.ts`, `squash.ts`
(génération d'une todo list pour `GIT_SEQUENCE_EDITOR`),
`app/src/models/multi-commit-operation.ts`, `docs/technical/rebase-flow.md`.

### ADV-05 · Gestion de plusieurs stashes — `todo`

Liste de tous les stashes, nommage, apply ou pop de n'importe lequel, stash
partiel (fichiers sélectionnés). Desktop gère un seul stash « Desktop » par
branche.

Pistes techniques : `app/src/lib/git/stash.ts` (`getStashes` liste déjà tout),
`app/src/models/stash-entry.ts`, `app/src/ui/stashing/`.

### ADV-06 · Blame et historique d'un fichier — `todo`

Annotations ligne par ligne, historique d'un fichier ou d'un dossier qui suit
les renommages (`git log --follow`).

Pistes techniques : nouveau module `app/src/lib/git/blame.ts` (utiliser
`--porcelain` ou `--line-porcelain`, voir les règles sur les sorties machine
dans [patterns.md](patterns.md)), vue basée sur les composants de diff
existants.

### ADV-07 · Plusieurs remotes dans la barre latérale — `todo`

Afficher toutes les remotes et leurs branches. Ajouter, supprimer, renommer ou
modifier une remote depuis l'interface. Desktop ne gère vraiment que `origin`
et `upstream`.

Pistes techniques : `app/src/lib/git/remote.ts` (`addRemote`, `removeRemote`,
`setRemoteURL` existent), `app/src/ui/branches/`,
`app/src/ui/repository-settings/`.

## Priorité 2 : utile

| ID | Fonctionnalité | Statut | Notes / pistes |
|----|----------------|--------|----------------|
| ADV-08 | Recherche dans l'historique (message, auteur, SHA, contenu `-S`, dates) | todo | `log.ts`, filtre de `commit-list.tsx` |
| ADV-09 | Comparer deux commits ou branches quelconques (diff A..B) | todo | `app/src/ui/history/compare.tsx` ne compare qu'avec la branche courante |
| ADV-10 | Undo / redo global des opérations Git, basé sur le reflog | todo | `app/src/lib/git/reflog.ts`, `app/src/ui/undo/` |
| ADV-11 | Reset soft / mixed / hard sur n'importe quel commit | partiel | `app/src/lib/git/reset.ts`, `app/src/ui/reset/` |
| ADV-12 | Checkout d'un commit en HEAD détaché plus visible | partiel | `app/src/lib/git/checkout.ts` le supporte déjà |
| ADV-13 | Gestion des submodules (add, update, init, ouvrir comme dépôt) | todo | `app/src/lib/git/submodule.ts`, `app/src/models/submodule.ts` |
| ADV-14 | Profils : plusieurs identités (nom, email, clé GPG/SSH) selon le dépôt, interface pour la signature | todo | `app/src/models/commit-identity.ts`, `app/src/lib/git/config.ts` |
| ADV-15 | PR dans l'application : liste, reviewers, labels, revue avec commentaires, approve ou merge | todo | `app/src/lib/api.ts`, `app/src/lib/stores/pull-request-store.ts` |
| ADV-16 | Support complet de GitLab, Bitbucket et Azure DevOps (connexion, PR/MR, liste de dépôts) | todo | voir `docs/integrations/` |
| ADV-17 | Git Flow / Git Flow AVH (feature, release, hotfix, préfixes configurables) | todo | pur Git, pas de dépendance externe nécessaire |

## Priorité 3 : confort et qualité de vie

| ID | Fonctionnalité | Statut | Notes / pistes |
|----|----------------|--------|----------------|
| ADV-18 | Onglets de dépôts ouverts en même temps et workspaces (groupes de dépôts) | todo | impacte fortement `IAppState`, conflits upstream probables |
| ADV-19 | Palette de commandes (Ctrl+P) | todo | réutiliser `MenuEvent` (`app/src/main-process/menu/menu-event.ts`) |
| ADV-20 | Recherche floue de fichiers dans un commit ou les changements | todo | `app/src/lib/fuzzy-find.ts` existe |
| ADV-21 | Éditeur de fichiers intégré | todo | CodeMirror déjà présent |
| ADV-22 | Rechercher, filtrer, masquer ou mettre en évidence des branches dans le graphe | partiel | masquer / solo par clic droit sur la colonne Branch / Tag, mémorisé par dépôt (`lib/commit-graph/revisions.ts`) ; reste la recherche |
| ADV-23 | Avatars et couleurs par auteur dans le graphe | todo | dépend de ADV-01, `app/src/ui/lib/avatar.tsx` |
| ADV-24 | Diff mot à mot, mise en évidence du code déplacé, options de whitespace | partiel | `app/src/ui/diff/` |
| ADV-25 | Interface LFS : lock/unlock, fichiers suivis, patterns | partiel | `app/src/lib/git/lfs.ts`, `app/src/ui/lfs/` |
| ADV-26 | Git hooks : liste et activation dans l'interface | todo | `app/src/lib/hooks/` |
| ADV-27 | Bisect assisté (good / bad, navigation) | todo | — |
| ADV-28 | Liens vers des tickets (Jira, Issues, GitLab) : branche depuis un ticket, commit lié | todo | `app/src/lib/stores/issues-store.ts` |
| ADV-29 | IA au-delà du message de commit et des conflits : explication d'un commit ou d'une branche, résumé de PR | partiel | `app/src/lib/copilot/`, `app/src/lib/stores/copilot-store.ts` |

## Ordre recommandé

Meilleur ratio impact / effort :

1. ADV-01 + ADV-02 : gros chantier, mais c'est le vrai différenciateur.
2. ADV-05 : relativement simple, `stash.ts` existe déjà.
3. ADV-06.
4. ADV-04 : s'appuie sur `multi-commit-operation`, `reorder.ts` et `squash.ts`.
5. ADV-03.
