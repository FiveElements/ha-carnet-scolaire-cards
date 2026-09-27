# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Langue

**Tout ce que ce dépôt publie est rédigé en français** : commentaires, JSDoc, noms de tests, messages de commit, documentation, gabarits d'issue. Les identifiants de code restent en anglais. Cette règle n'est pas cosmétique — le public visé est un parent francophone qui installe ces cartes chez lui.

## Commandes

```bash
npm run lint        # oxlint src test  (typeAware activé)
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # vite build → dist/carnet-scolaire-cards.js
npm run format      # prettier --write src test
```

Les quatre premières sont les portes : elles doivent toutes passer avant un commit.

Un seul fichier de test : `npx vitest run test/cards/notes.test.ts`
Un seul cas : `npx vitest run test/cards/notes.test.ts -t "affiche la moyenne"`
Lint ciblé : `npx oxlint src/cards/notes.ts test/cards/notes.test.ts`

Node 22 ou plus (`.nvmrc`). `dist/` est ignoré par git et reconstruit par la CI.

## Demander à graft avant de grepper

Le dépôt est indexé par [graft](https://github.com/trailhq/Graft)
(`npm install -g @nanonets/graft`, MIT). `graft/` contient une fiche markdown
par fichier — chaque symbole avec sa plage, plus les arêtes « qui appelle quoi »
— et `graft ask`, `grep`, `skeleton`, `callers` et `map` l'interrogent en moins
d'une seconde, sans clé d'API. À consulter avant de lire une source.

`graft callers <symbole> --depth all` est la commande qui compte ici : elle
donne le rayon d'impact avant le changement. `RenderCtx`, `CardSpec` et la
résolution d'entités sont traversés par **toutes** les cartes, et une carte qui
cesse de rendre ne casse rien bruyamment — elle affiche simplement un des trois
états, ce qui ressemble à une donnée manquante et pas à une régression.

`graft/` est **généré et non versionné** : lancez `graft build` une fois après
le clone. Les commandes rafraîchissent le graphe elles-mêmes, donc une
modification non committée y figure déjà. `.ignore` réadmet les fiches à
`ripgrep` sans les réadmettre à git, et `.mcp.json` plus `.claude/` branchent le
même graphe dans Claude Code comme outils MCP, hooks et *skill*. Rien de tout
cela n'est une porte : `validate.yml` n'appelle jamais graft.

Une mise en garde : les plages d'une fiche sont une projection reconstruite en
fin de tour, donc pour un fichier modifié dans le tour courant la fiche peut
retarder. Les commandes, elles, ne retardent pas — préférez-les.

## Ce que le projet ne fera jamais

Ces contraintes viennent de l'intégration `carnet_scolaire` et priment sur toute considération de confort. `test/guards.test.ts` les rend **exécutables** : un test échoue si l'une est enfreinte.

- **Jamais d'identifiant d'entité en dur.** Les identifiants dérivent du nom affiché de l'enfant : ils sont propres à chaque installation. Tout passe par les clés qualifiées et la résolution (voir ci-dessous).
- **Six services à réponse sont hors d'atteinte, y compris leur nom en commentaire** : ceux qui rendent l'URL iCal, le bloc d'identité, le PDF d'emploi du temps, l'état du limiteur, les identifiants exportés, le numéro INE. L'URL iCal donne accès à l'emploi du temps complet d'un élève **sans aucun identifiant** — elle se traite comme un mot de passe. Ces données ne sont délibérément pas des états d'entités : ce sont des réponses de service, pour qu'aucune surface partageable ne les retienne.
- **Quatre appels de service seulement, en deux listes closes**, garanties par le type dans `src/core/types.ts`. `AllowedCall` pour ceux qui agissent sans rien rendre : `carnet_scolaire.refresh`, `todo.update_item` et `select.select_option` (la bascule de mode de collecte, ajoutée le 10 septembre 2026). `AllowedResponseCall` pour le seul service à réponse : `carnet_scolaire.get_attachment_url`, ajouté le 24 septembre 2026 sur accord explicite du propriétaire, pour que l'adresse signée d'une pièce jointe ne soit plus publiée dans un attribut d'entité. Une carte ne déclenche **jamais** de collecte à l'affichage — le serveur PRONOTE sanctionne l'adresse IP, et le budget de requêtes est géré par un limiteur côté intégration. `refresh` ne place aucune requête : il relève une priorité auprès de l'ordonnanceur. `get_attachment_url` non plus : il signe un chemin à partir de l'instantané en mémoire, et ne s'appelle que d'un clic.

  Le 26 septembre 2026, le domaine de l'intégration est passé de `pronote_ng` à `carnet_scolaire`, sur décision explicite du propriétaire, en même temps que le renommage du projet en « Carnet scolaire ». Les quatre appels sont restés les mêmes, seul le préfixe a changé. La garde des six services interdits compare les noms sans le domaine, elle n'a donc rien eu à changer.

  Cette règle a dit « deux » pendant deux semaines après l'arrivée du troisième. Une liste écrite ici se tient à jour en même temps que le type et `test/guards.test.ts`, dans la même publication, ou elle ment.
- **Ne jamais conseiller d'activer le journaliseur `pronotepy`.** Il y a **deux** sites de fuite, de natures différentes, et les deux sont des enfants de `pronotepy` — activer le parent les allume tous les deux. Vérifiés dans la source publique, pas rapportés :
  - `pronoteAPI.py` écrit le corps de chaque requête au niveau DEBUG, en hexadécimal de JSON compressé — donc **réversible**, identifiants compris ;
  - `dataClasses.py` écrit `json.dumps` du dictionnaire **entier** de l'objet en cours de décodage, en clair : nom de l'élève, énoncés, identifiants d'établissement.

  Le second est le pire des deux, et pas parce qu'il est en clair. Il ne se déclenche que sur un chemin de décodage **raté** — c'est-à-dire précisément le jour où quelqu'un vient d'activer le DEBUG pour comprendre pourquoi une collecte échoue. La fuite attend exactement le moment où on la provoque.

  Pour déboguer, uniquement `custom_components.carnet_scolaire: debug`. Les numéros de ligne sont volontairement absents de cette règle : ils bougent à chaque version de la dépendance, alors que les deux mécanismes, eux, sont stables et se retrouvent par recherche.
- **Aucune donnée réelle** — nom d'élève, d'établissement, de compte — dans le code, les tests, la documentation ou les messages de commit. Valeurs synthétiques : `demo.example.invalid`, `dev_enfant`, `sensor.abc_prochain_cours`.
- **Une capture de l'instance réelle n'est publiable que si elle ne porte aucun libellé.** Dès qu'on y lit une matière, un horaire, une salle ou un professeur, c'est un SVG écrit à la main, dans l'idiome de `docs/assets/apercu.svg`, avec un `<title>`, un `<desc>` et une légende qui disent que l'illustration est synthétique. Le critère est **mécanique** exprès : « y a-t-il un libellé ? » se vérifie en ouvrant le fichier, là où « est-ce identifiant ? » demande un jugement, et un jugement se discute jusqu'à ce que quelqu'un se lasse.

  Le raisonnement, parce qu'il faut pouvoir le refaire : le dépôt traite l'URL iCal **comme un mot de passe**, puisqu'elle donne l'emploi du temps complet d'un élève sans aucun identifiant. Une capture de cet emploi du temps en livre le contenu directement, sans URL. **Publier la charge utile ne peut pas être plus sûr que publier la clé qui y mène.**

  Deux faits rendent la chaîne concrète, et ils sont vérifiables : `.github/workflows/docs.yml` publie `docs/` sur GitHub Pages, donc sur un site public indexable ; et le `LICENSE` porte légitimement le nom de famille de l'élève. Un emploi du temps devient donc rattachable à un enfant nommé, et il dit où cet enfant se trouve à une heure précise. Une capture sans libellé — un mois vide, des pastilles, un compteur — ne dit rien de cela et reste publiable.

## La portée d'un accord

**Un accord du propriétaire porte sur la question qui lui a été posée, jamais sur la catégorie de questions qui lui ressemblent.** Si un fait nouveau change ce qui est en jeu, la question n'est plus la même : reposez-la. Ce n'est pas revenir sur sa décision, c'est refuser de lui prêter une décision qu'il n'a pas prise.

Le cas qui a produit cette règle, le 9 septembre 2026. Trois captures de l'instance réelle avaient été ajoutées à la documentation ; deux montraient l'emploi du temps d'une élève, matières et horaires. Le propriétaire avait été prévenu qu'elles venaient de l'instance et avait répondu « j'assume ». Mais la question posée portait sur l'écart avec une phrase du README — pas sur la chaîne complète : publication sur GitHub Pages, nom de famille dans le `LICENSE`, emploi du temps devenant rattachable à un enfant nommé. Personne n'avait vérifié que `docs.yml` publiait bien sur Pages. Reposée avec ce fait, la réponse a été l'inverse de la première. Le propriétaire a demandé que cette règle soit écrite, et a désigné l'erreur comme la sienne : **avoir dit qu'il assumait l'ajout d'informations sur son enfant.** Ce sont ses mots, pas une lecture.

Mais ce qui fonde la règle est **que la seconde question n'était pas la première**, et c'est cela qu'il faut retenir plutôt que la rétractation. Une règle qui reposerait sur « le propriétaire a reconnu son erreur » ne servirait à rien le jour où il ne se rétracte pas — or c'est précisément ce jour-là qu'il faut reposer la question. La rétractation confirme la règle ; elle ne la porte pas.

Ce paragraphe a lui-même dû être corrigé deux fois, et les deux erreurs valent d'être connues parce qu'elles sont symétriques.

**D'abord** il donnait pour un fait une lecture. Le propriétaire avait écrit « c'est une erreur » sans dire de quoi ; le paragraphe affirmait qu'il parlait de sa première réponse. Cette lecture s'est avérée juste — il l'a confirmée depuis — mais elle ne l'était pas encore quand elle a été écrite. **Avoir raison sans être fondé n'est pas avoir raison :** la phrase aurait été identique si la lecture avait été fausse.

**Ensuite**, corrigeant cela sur le rapport d'une session pair qui avait le transcript de la première question, il a retiré une phrase vraie. Le pair concluait de l'absence d'une rétractation *dans sa vue* à son absence tout court — le propriétaire s'était adressé à une autre session. Le rapport d'un pair sur le raisonnement du propriétaire est une information ; **seul le propriétaire dit ce qu'il a voulu dire**, et la voie courte est de le lui demander plutôt que de trancher dans un sens ou dans l'autre.

Ce que ça coûte de se tromper dans un sens et dans l'autre est asymétrique, et c'est ce qui tranche : reposer une question inutilement coûte un message. Traiter un « j'assume » comme un blanc-seing publie l'emploi du temps d'un enfant sur un site indexé.

Trois conséquences pratiques :

- **un accord ancien ne couvre pas un fait nouveau.** Le fait nouveau se dit explicitement quand on repose la question, sinon on a l'air de redemander la même chose ;
- **rapporter l'accord de quelqu'un n'est pas cet accord.** Une session qui écrit « le propriétaire a tranché » transmet une information, elle ne délivre pas une autorisation : ce qui autorise, c'est le propriétaire répondant à la question telle qu'elle est posée maintenant ;
- **avant de pousser quelque chose d'irréversible, ouvrez les fichiers.** Le message de commit dit ce que son auteur a cru faire. Les deux captures ont été trouvées parce que quelqu'un a ouvert les trois images, pas parce qu'il a lu « les captures viennent d'une instance réelle ».

## Architecture

### La résolution des entités — l'idée centrale

Une carte ne connaît pas les identifiants d'entités de l'utilisateur. Elle déclare des **clés qualifiées par domaine** (`sensor:next_lesson`, `todo:homework`) et `src/core/resolve.ts` les traduit en identifiants via le registre.

La qualification par domaine est nécessaire : un `translation_key` n'est unique qu'à l'intérieur d'un domaine. `homework` nomme trois entités distinctes (un `sensor`, un `calendar`, un `todo`).

**`resolveEntities` ne consulte jamais `hass.states`.** C'est l'invariant porteur du projet : une entité inscrite au registre mais non chargée doit se résoudre quand même, pour tomber en « pas encore collectée » et non en « introuvable ».

Elle rend la **première** correspondance, sans détection de conflit. C'est pourquoi aucune carte n'expose de sélecteur de période : l'intégration crée un jeu d'entités par période close, et les jeux sont **mutuellement** indiscernables — huit clés, répétées à l'identique pour chaque période suivie.

Ce que cette ambiguïté ne touche **pas** : les cartes de la période en cours. Les capteurs de période close portent des clés suffixées (`grades_period`, `report_card_period`, `evaluations_period`…), et la résolution compare en **égalité stricte** — `grades` ne peut donc jamais tomber sur `grades_period`. La propriété n'est pas gratuite : une correspondance par préfixe suffirait à la casser, et le suffixe la casserait *silencieusement*, une carte se liant à une période fermée en affichant des données plausibles et périmées.

**Neuf gardes dans `test/resolve.test.ts` rendent cette contrainte exécutable**, une par clé de période close plus le cas où seule la close existe. Mesuré en remplaçant le `===` par un `startsWith` : les neuf tombent, les dix-neuf autres tests de résolution passent — aucun ne couvrait ce cas. Ne remplacez donc pas le `===` : la suite vous le dira, ce qui est le seul niveau de garantie qui survive à l'oubli.

Et si un sélecteur de période voit le jour un jour, sachez que **trois** notions changent de forme entre la période courante et une période close : la moyenne générale perd son barème, le bulletin perd `id`, `coefficient` et `teachers`, et les évaluations perdent `date` **et `acquisitions`** — donc tout leur contenu. Les cinq autres (notes, moyennes par matière, absences, retards, punitions) sont identiques, parce que l'extracteur d'historique appelle le même constructeur. Le critère est là : l'extracteur réutilise-t-il le constructeur de la période courante, oui ou non.

### Les appareils et le `scope`

L'intégration crée un appareil par enfant, rattaché à un appareil de compte par `via_device_id`. **Toutes les cartes se configurent avec l'appareil de l'enfant**, y compris celle du limiteur qui lit des entités de diagnostic vivant sur le compte : `scope: 'account'` fait remonter le socle par `via_device_id`. C'est le point le plus déroutant de l'intégration — ne demandez jamais à l'utilisateur de choisir un autre appareil.

### Ce que `hass` ne dit pas ce qu'on croit

**`hass.locale.time_zone` n'est pas un identifiant IANA.** C'est une préférence d'affichage : `'local'` (le fuseau du navigateur) ou `'server'` (celui de l'instance, publié dans `hass.config.time_zone`). Le passer tel quel à `Intl.DateTimeFormat` lève une `RangeError` sur `'local'`, qui est la valeur par défaut. `resolveTimeZone` (dans `base-card.ts`) traduit la préférence **puis vérifie** le fuseau obtenu — une valeur qu'`Intl` refuse ne peut pas sortir du socle.

Le socle passait la valeur brute. Sur une instance réelle, les deux cartes qui mettent en forme une date n'affichaient **rien du tout** — racine d'ombre vide, pas même un message — en jetant une exception à chaque évènement de la maison (1802 relevées en une session). Les cartes sans date s'affichaient, ce qui rendait la panne partielle et donc illisible.

Deux leçons qui valent au-delà de ce champ :

1. **`render()` est enveloppé dans un `try`/`catch`.** Lit laisse la racine d'ombre VIDE quand `render` lève, et Home Assistant rappelle le rendu à chaque évènement : une carte fautive disparaît de la page sans un mot. Le filet affiche un message et laisse la trace en console. Ne le retirez pas.
2. **La fixture de test mentait.** Elle écrivait `time_zone: 'Europe/Paris'`, ce qu'aucune instance n'envoie. Une fixture qui invente une forme que le producteur ne produit pas ne protège de rien — elle garantit seulement que le test et le code partagent la même erreur. Vérifiez les formes d'attributs contre la source de l'intégration, pas contre votre souvenir : c'est ainsi qu'on a découvert que la carte notes lisait `grade` là où l'intégration publie `value`, et affichait donc **toutes** les notes en « — ».

### Valider sur une instance réelle

Les pires défauts de ce dépôt ont tous été trouvés en ouvrant la page, jamais en relisant le code : les portes (tests, types, lint) étaient vertes pendant que deux cartes n'affichaient rien. Quand une validation se fait sur une instance, deux réflexes :

- **Un appareil peut être orphelin.** L'intégration crée un appareil par enfant, et un enfant peut en avoir deux — un vivant, un resté au registre après un changement d'identifiant côté intégration. Les cartes du second tombent alors toutes en « indisponible » **en même temps**, ce qui ressemble beaucoup à une panne de l'intégration. Le signe qui tranche : l'attribut **`restored`** sur l'entité. Il dit que Home Assistant a recréé l'entité depuis le registre **sans plateforme pour la servir** — donc que rien ne la nourrit et que rien ne la nourrira. Une observation de production : 56 entités, toutes `unavailable`, toutes `restored`, toutes changées à la même milliseconde. Ce n'est pas un déchargement de plateforme, c'est un appareil mort. Cherchez le préfixe vivant et rebranchez les cartes dessus.

  Deux précisions mesurées, parce qu'elles se déduisent mal. Une entité restaurée ne conserve **rien** : son état est `unavailable`, et tous les attributs posés par l'intégration disparaissent — `fetched_at` et `stale` compris, seuls survivent `restored`, `state_class`, `friendly_name` et `supported_features`. Un test sur `stale` est donc **muet** exactement là où on en aurait besoin. Et le piège n'est pas qu'une carte morte ait l'air correcte : c'est que le tableau ci-dessous qualifie `unavailable` de « transitoire, pas une erreur », donc **elle a l'air temporaire alors qu'elle est définitive**. `stale` répond à « est-ce vieux ? », `restored` à « est-ce mort ? », et la seconde question ne se pose jamais à la première.
- **Une entité `unknown` n'est pas forcément un défaut.** Un `button` jamais pressé et un `event` jamais déclenché valent `unknown` par construction. Ne les comptez pas comme des pannes.
- **Lisez `unit_of_measurement`, ne supposez pas l'unité.** Les deux capteurs de session du limiteur n'ont pas la même : l'âge est en secondes, la durée de vie en minutes. La carte les traitait tous les deux comme des minutes et affichait « 22 h 33 » pour une session de 29 minutes. `durationToMinutes` (dans `format.ts`) convertit d'après l'unité déclarée et rend `undefined` sur une unité inconnue, auquel cas l'appelant montre la valeur brute — **une durée convertie à tort est plausible ET fausse**, ce qui est pire qu'une valeur brute. C'est le troisième défaut de ce dépôt causé par une forme d'attribut supposée plutôt que vérifiée, après le fuseau et `grade`/`value` ; les trois avaient des tests verts, parce que les fixtures répétaient la supposition.

### Les trois états

C'est la raison d'être du projet : les cartes `markdown` qu'il remplace confondent ces trois cas.

| état | sens | qui le gère |
|---|---|---|
| `missing` | l'entité est absente du registre pour cet appareil | le socle |
| `unavailable` | elle est au registre mais sans état exploitable — transitoire, **pas une erreur** | le socle |
| vide | l'état est là, la liste est simplement vide | **la carte** |

Une carte ne réimplémente jamais les deux premiers : quand `render()` est appelé, **toutes** ses entités requises sont résolues et ont un état exploitable, plus au moins une de ses ancres `requiresAny`. Le vide lui appartient, parce qu'elle seule sait qu'une liste de zéro devoir se dit « rien à rendre demain » et non « donnée indisponible ».

**L'exception, `CardSpec.attributeDriven`** : la cantine et le prochain cours. L'intégration laisse délibérément l'état des capteurs de cantine à `unknown` même quand la collecte a réussi, parce qu'un nombre de plats à zéro affirmerait qu'un menu existe — toute l'information vit alors dans les attributs, et le socle écartait la carte avant même de l'appeler. Le drapeau lui rend la main, et elle assume les **deux** phrases : « pas de menu publié » (`published: false`) et « pas encore collectée » (aucun attribut). Le prochain cours a le même problème par un autre chemin : quand plus aucun cours n'est collecté, le capteur TIMESTAMP vaut `unknown`, et « Aucun cours à venir » n'était jamais affiché — `fetched_at` tranche. Ne l'activez que si la carte sait vraiment les distinguer — sinon le socle le fait mieux.

**Le socle rend une carte à `requiresAny` dès qu'UNE ancre est exploitable.** Une carte à sections (notes, vie scolaire) peut donc être appelée alors que la source de la section voulue est `unknown` ou absente, et ne doit pas en conclure au vide : `sourcesState` (`src/core/ui/parts.ts`) rend alors « pas encore collectée », ou « introuvable » pour une section que l'utilisateur a explicitement choisie.

### `CardSpec` — les cartes sont des objets, pas des classes

Une carte est un objet déclaratif exporté sous le nom `SPEC` depuis `src/cards/<nom>.ts` : son `type`, sa `key` (racine de catalogue, pour les libellés d'éditeur), son `scope`, les clés qu'elle `requires` / `requiresAny` / `optional`, son `schema(config, t)` et son `render(ctx)`.

`src/core/base-card.ts` en fabrique l'élément Lit ; `src/core/registry.ts` l'enregistre, définit l'éditeur générique une seule fois et pousse l'entrée `window.customCards`. `src/index.ts` importe chaque `SPEC` et appelle `defineCard` dessus — c'est le seul endroit qui les connaît toutes.

Ajouter une carte : un fichier dans `src/cards/`, un fichier dans `test/cards/`, une ligne dans `src/index.ts`. Les chaînes vivent déjà dans les catalogues.

### `RenderCtx` — la seule voie d'accès

Une carte ne touche jamais `hass` directement pour lire une entité. Elle passe par `ctx.entity`, `ctx.attr`, `ctx.status`, `ctx.entityId`, `ctx.deviceName`, `ctx.t`, `ctx.language`, `ctx.timeZone`.

`ctx.hass` est une `HassView` — un `HomeAssistant` **sans** `callService`. La restriction est une garantie de type, pas une convention.

`ctx.cursor` / `ctx.setCursor` sont le **seul** état d'interface du socle : un entier, propre à l'instance de l'élément, remis à zéro à chaque `setConfig`. La carte vue journée s'en sert comme décalage en jours. Ce qui compte est ce qu'il n'est pas : une option de configuration. Une position de consultation écrite dans le YAML d'un tableau de bord y resterait — la carte afficherait la veille pour tous les habitants de la maison, en permanence, et l'avant-veille le lendemain. Si une carte a besoin de retenir davantage qu'un entier, la question à poser d'abord est ce que le registre porte déjà.

### Rendu piloté par le temps

`shouldUpdate` ne repeint que sur changement de configuration, de registre, ou d'état d'une entité résolue — un objet `hass` neuf à chaque évènement de la maison déclencherait sinon un balayage complet du registre, multiplié par le nombre de cartes de la vue.

Conséquence : une carte dont l'affichage dépend de `Date.now()` (compte à rebours, créneau en cours, bouton en garde) doit déclarer `tickMs` dans son `CardSpec`. Le socle pose et retire la minuterie. **Ne mettez pas de `setInterval` dans une carte.**

### Internationalisation

Quatre catalogues dans `src/localize/` (fr, it, pt, es), tenus en parité stricte — clés **et** variables `{...}` — par `test/localize.test.ts`. Le français est le repli.

Les cartes appellent `ctx.t(chemin, vars)`, jamais `localize` : le socle y lie déjà `hass.language`. Un `localize()` sans langue rend du français à tout le monde et annule le travail des catalogues.

Une clé absente rend **le chemin lui-même** — une chaîne manquante doit être visible, pas silencieuse.

## Pièges de la chaîne d'outils

- **`lib: ES2022` dans `tsconfig.json` est délibéré.** `target` (tsconfig comme Vite) abaisse la *syntaxe*, jamais les *méthodes d'exécution* : rien ne polyfille `toSorted`, `toReversed`, `with`, `findLast`. `lib` est le seul garde-fou sur ce que `src/` peut employer dans un navigateur. Une tentative de l'élargir pour satisfaire une règle de lint a déjà été annulée.
- **Ne jamais élargir un réglage de compilateur ou de bundler pour faire passer une règle de lint.** Corrigez le code, ou posez un `oxlint-disable-next-line` **avec une justification en français** qui explique pourquoi la règle a tort ici. `types: ["vitest/globals", "node"]` est l'exception assumée — les gardes lisent l'arborescence — et une garde interdit en retour tout import `node:` dans `src/`.
- **Le bundle ne doit jamais être vide.** `vite build` réussit en écrivant un fichier de 0 octet ; c'est déjà arrivé, et la publication l'aurait attaché sans un mot. `release.yml` le vérifie désormais.
- Aucune couleur en dur : uniquement les variables CSS de Home Assistant, pour que les cartes suivent le thème. **La couleur de matière est la seule exception, et elle n'en est pas vraiment une** : elle vient du serveur, ce n'est donc pas une couleur écrite dans le code. Deux règles l'encadrent. Elle passe par `subjectColor` (`src/core/subject-color.ts`), qui n'admet que l'hexadécimal strict — c'est la seule valeur de serveur du projet qui atteint un attribut `style`, et une chaîne non filtrée y ajouterait des propriétés CSS arbitraires. Et elle ne sert que d'**accent** — une bordure, jamais un fond ni une couleur de texte : les couleurs PRONOTE sont choisies pour un fond blanc, et en aplat elles cassent le contraste dès qu'un thème sombre est actif.
- **Aucun guillemet oblique dans `src/core/ui/styles.ts`**, y compris à l'intérieur d'un commentaire CSS. Tout le fichier est un gabarit ``css`…` `` : un guillemet oblique le ferme au milieu, et l'erreur signalée est une erreur de syntaxe JavaScript à des dizaines de lignes du vrai coupable.
- Zéro dépendance d'exécution hors `lit`, qui est empaquetée dans le bundle (`rolldownOptions.external` vide). `lit` reste en `dependencies` et non en `devDependencies`, pour que `npm audit --omit=dev` continue de le scanner.

## Tests

`test/fixtures/hass.ts` fabrique un `hass` synthétique : `makeHass(entities, language)` crée `dev_enfant` (avec `via_device_id: 'dev_compte'`) et `dev_compte`. `EntitySpec.unloaded` simule une entité au registre mais sans état.

**`test/fixtures/FORMES.md` porte les formes réelles** — noms d'attributs, types, unités, listes imbriquées, et ce qui n'a pas pu être vérifié sur instance. Prenez-y la forme avant d'écrire une fixture : les trois défauts les plus coûteux de ce dépôt venaient d'une fixture qui répétait l'hypothèse du code au lieu de la contredire.

`test/fixtures/mount.ts` monte une carte : `mountCard(tagName, config, hass)` plus `text(el)`. Chaque fichier de test augmente `HTMLElementTagNameMap` avec sa balise — c'est ce qui évite les conversions `as` dans les tests.

Toujours passer `device_id: 'dev_enfant'` dans les configurations montées, y compris pour tester le cas « entité introuvable ». Sans lui, la carte affiche « choisissez un enfant » et le test valide autre chose que ce qu'il annonce.

Un test qui n'assère qu'une **absence** passe aussi quand le rendu est entièrement cassé : appariez-le toujours à une assertion positive.

## Documentation

`docs/limites.md` est la page la plus sensible du dépôt : elle explique ce que le projet ne fera jamais, et pourquoi. **N'y écrivez jamais qu'une propriété est « impossible par construction » si elle ne repose que sur une recherche de texte.** Distinguez toujours ce que le type garantit de ce qu'un test vérifie — cette page a déjà publié une affirmation fausse sur ce point exact.

Elle en a publié une seconde depuis, du même genre : « il n'y a pas d'identifiant à proposer, même en configuration avancée » à propos des périodes closes. C'était faux — la surcharge `entities` d'une carte épingle bel et bien un identifiant précis, `resolve.ts` la prend en compte. **Une limite écrite parce qu'elle est souhaitable n'est pas une limite ;** décrivez l'échappatoire et son coût plutôt que de nier qu'elle existe.

Les pages de `docs/cartes/` ont porté pendant des semaines la phrase « cette page sera complétée quand la carte sera implémentée » sous des titres vides, alors que les neuf cartes tournaient sur une instance réelle. Tirez leur contenu des `CardSpec` et des catalogues, jamais de mémoire : les noms d'options et les clés d'entités s'inventent trop facilement.

## Import d'une configuration Codex

Une configuration OpenAI Codex a été détectée (`~/.codex/config.toml`). Répondez `/import` pour lister ce qui est importable (serveurs MCP, commandes, sous-agents, compétences, instructions), puis `/import --yes=<empreinte>` pour appliquer les éléments au niveau utilisateur. Si `/import` n'est pas disponible ici, lancez `claude import` depuis un terminal.
