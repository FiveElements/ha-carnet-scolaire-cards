# Les formes que l'intégration publie vraiment

Ce fichier existe parce que **trois défauts de ce dépôt ont été causés par une
forme d'attribut supposée plutôt que vérifiée**, et que les trois avaient des
tests verts :

| défaut                                 | ce que le code lisait                     | ce que l'intégration publie                            |
| -------------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| toutes les notes affichées en « — »    | `grade`                                   | `value`                                                |
| deux cartes entièrement vides          | `locale.time_zone` comme identifiant IANA | une préférence, `'local'` ou `'server'`                |
| « 22 h 33 » pour une session de 29 min | des minutes supposées                     | des secondes, **déclarées** dans `unit_of_measurement` |

Le point commun n'est pas l'inattention : c'est que **la fixture répétait
l'hypothèse du code**. Un test dont les données viennent de la même supposition
que le code ne teste que la cohérence de la supposition. Écrire
`compte('sensor:session_age', 'sensor.abc_age', '45')` sans unité ne vérifie
rien — ça fige l'erreur.

**Avant d'écrire une fixture, prenez la forme ici.** Ne l'inventez pas, et ne
la déduisez pas du nom de l'attribut.

## Aucune donnée réelle ici

Ce fichier ne porte que des **noms** d'attributs, leurs **types** et leurs
**unités**. Aucun identifiant d'entité réel, aucun nom d'élève, aucun nom
d'établissement : les identifiants dépendent de l'installation, et seule la clé
qualifiée est stable. C'est aussi pourquoi le tableau est indexé par clé et non
par `entity_id`.

## D'où vient un identifiant d'entité, et le piège du suffixe

Le suffixe d'un identifiant d'entité est le **nom affiché** replié par Home
Assistant. Il ne vient **pas** de la clé de traduction, et il ne vient pas non
plus de l'`unique_id`.

La distinction n'est pas théorique : elle a produit un défaut dans ce dépôt et
onze dans la documentation de l'intégration, le même jour.

| ce qu'on croit lire                                 | ce que l'installation produit                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `sensor.<é>_averages` (la clé `averages`)           | `sensor.<é>_subject_averages` — le nom est « Subject averages »                                     |
| `sensor.<é>_homework_todo` (la clé `homework_todo`) | `sensor.<é>_homework_to_do` — le nom est « Homework to do »                                         |
| `sensor.<é>_notes_p1` (le `p<n>` de l'`unique_id`)  | le nom est « Notes ({period}) », donc le suffixe porte le **libellé de période de l'établissement** |

Le troisième cas est le pire, et il n'a pas de forme fixe : le nom contient un
trou que Home Assistant remplit avec une donnée qu'aucun test ne peut voir. Une
fixture ne peut donc que montrer une forme _plausible_ — d'où
`sensor.abc_notes_trimestre_1` dans `resolve.test.ts`, avec le commentaire qui
dit pourquoi elle est plausible et non exacte.

**Ce que cela ne change pas :** aucune carte ne cible un identifiant. La
résolution passe par la clé qualifiée comparée en égalité stricte, et c'est
précisément ce qui rend le dépôt insensible à ce piège. Un identifiant de
fixture est un décor — mais un décor qu'un lecteur prendra pour la réalité,
donc il doit rester honnête.

## Les deux attributs que portent presque toutes les entités de données

| attribut     | type                              | sens                                               |
| ------------ | --------------------------------- | -------------------------------------------------- |
| `fetched_at` | `string` (ISO 8601 avec décalage) | instant de la collecte qui a produit cet état      |
| `stale`      | `boolean`                         | l'état est un repli, la dernière collecte a échoué |

Aucune carte ne les lit aujourd'hui. Ils sont là si une carte veut un jour dire
« figée depuis 11:21 » plutôt que de se taire.

**Et leur absence ne prouve rien.** Home Assistant ne publie **aucun** attribut
sur une entité `unavailable` — quelle qu'en soit la cause, pas seulement une
entité restaurée. Seuls survivent `restored`, `state_class`, `friendly_name` et
`supported_features`. Donc « le capteur n'a plus `fetched_at` » est une
reformulation de « le capteur est `unavailable` », et non un indice
supplémentaire sur ce que l'intégration porte en mémoire : elle peut très bien
tenir un instantané frais derrière une entité qui s'affiche indisponible.

Ce dépôt avait déjà la moitié de l'observation — les 56 entités restaurées ne
gardaient que ces quatre attributs — et il l'avait attribuée à la
**restauration**, qui n'en est qu'un cas. La généralisation vient de la session
du dépôt de l'intégration, **qui l'a mesurée** le 10 septembre 2026 : dix-neuf
entités indisponibles alors que les dix paliers avaient collecté et publié.

Conséquence pratique pour un banc de test : le discriminant fiable est du côté
des diagnostics de l'intégration — `data.account.limiter` → `calls_by_tier`, et
`data.account.scheduler` → `age_seconds`. Si l'âge est renseigné, la donnée est
là et le problème est l'affichage ; `homeassistant.update_entity` suffit alors à
la faire réapparaître, sans redémarrage ni publication.

**Le pendant positif, et c'est lui qui rend la règle utilisable.** Une entité
`unknown` **qui porte ses attributs** est un cas entièrement différent : elle
est disponible, l'intégration l'a bien nourrie, et sa valeur est légitimement
inconnue. Mesuré par la session de l'intégration le 10 septembre 2026 à 00:47 :
`sensor:menu_du_jour` à `unknown` avec `fetched_at` renseigné — aucun menu
publié ce jour-là, et la collecte avait pourtant réussi.

C'est exactement ce que `CardSpec.attributeDriven` exploite pour la cantine, et
c'est pourquoi la règle ci-dessus porte sur le mot `unavailable` et non sur
« pas d'attributs ». Les deux états se confondent à l'œil sur un tableau de
bord — tous les deux affichent un tiret — et ils ne se confondent pas du tout
dans les attributs. Le test est donc : `unavailable` + rien = on ne sait pas ce
que l'intégration porte ; `unknown` + `fetched_at` = elle porte la donnée, et
la valeur est vide pour de vrai.

**Un palier peut rester indisponible pour une raison qui n'est ni la carte ni
le socle.** `sensor:equipe_pedagogique` — palier `static` — restait
`unavailable` après le correctif du 10 septembre, seule sur trente-quatre
entités : PRONOTE répond sans la clé attendue, et le composant traite ce
mappage vide comme un échec plutôt que comme une collection vide, **exprès**,
pour ne pas écraser une donnée valide par du néant. Aucune carte de ce dépôt
ne lit cette clé aujourd'hui ; celle qui le fera un jour ne doit pas chercher
la panne chez elle. Rapporté par la session de l'intégration, trois occurrences
le même soir.

## Le piège des unités

Deux capteurs de durée, **deux unités différentes**, toutes deux déclarées :

| clé                       | `unit_of_measurement`   |
| ------------------------- | ----------------------- |
| `sensor:session_age`      | `s` — des **secondes**  |
| `sensor:session_lifetime` | `min` — des **minutes** |

Passez par `durationToMinutes(état, unité)` (dans `src/core/format.ts`), jamais
par `Number(état)` supposé être des minutes. Et **déclarez l'unité dans la
fixture** : sans elle, le test valide l'hypothèse au lieu de la forme.

`sensor:next_collection.overdue_by` est aussi en secondes, mais sans unité
déclarée — c'est un attribut, pas un état : la conversion est donc explicite
sur son site d'appel.

## Enfant — les clés que les cartes lisent

| clé                         | attributs                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `sensor:class_name`         | `establishment` (`string`)                                                                                            |
| `sensor:next_lesson`        | `subject`, `classroom`, `end` (ISO), `teachers` (`array<string>`), `canceled` (`boolean`), `end_inferred` (`boolean`) |
| `sensor:end_of_lessons`     | `subject`, `end_inferred` (`boolean`)                                                                                 |
| `sensor:next_wake_up`       | `first_lesson` (ISO), `subject`, `margin_minutes` (`number`)                                                          |
| `sensor:lessons_today`      | `lessons` (voir plus bas), `first_start`, `last_end`, `canceled_count` (`number`)                                     |
| `sensor:timetable_tomorrow` | `lessons`                                                                                                             |
| `sensor:timetable_week`     | `lessons`, `weeks` (`array<number>`)                                                                                  |
| `sensor:homework_todo`      | `items` (voir plus bas), `next_due` (ISO)                                                                             |

### Ce que `timetable_week` couvre vraiment

**Toute la semaine PRONOTE courante, jours déjà passés compris** — plus la
semaine suivante quand le lendemain change de semaine. Relevé dans
`gateway.timetable` : la fenêtre est `[get_week(today)]`, à laquelle
`get_week(today + 1 jour)` s'ajoute s'il diffère.

Ce n'est **pas** « à partir d'aujourd'hui », et c'est ce qui rend la navigation
de la carte vue journée possible vers le passé. Deux conséquences pour une
fixture :

- le lundi, la veille n'est **pas** dans la fenêtre. Une carte qui déduirait
  ses bornes de navigation d'un calcul de calendrier proposerait un dimanche
  dont elle ne sait rien ; les bornes se prennent donc sur les jours
  réellement présents dans `lessons` ;
- `lessons` est **dédoublonnée** (`deduplicate_lessons`), et `lessons_today`
  est un simple filtre de jour sur la même liste. Les deux capteurs ne peuvent
  pas se contredire sur un même jour — une fixture qui les ferait diverger
  testerait une situation impossible.

`weeks` porte les numéros de semaine PRONOTE effectivement demandés : un ou
deux éléments, jamais zéro quand l'état est exploitable.
| `sensor:homework`, `sensor:homework_tomorrow` | `items` |
| `calendar:homework` | `message`, `start_time`, `end_time`, `location`, `description`, `all_day` — voir plus bas pour la forme de `start_time` |
| `sensor:absences` | `items` (voir plus bas) |
| `sensor:unjustified_absences`, `sensor:delays`, `sensor:punishments` | `items` |
| `sensor:grades` | `items` (voir plus bas) |
| `sensor:averages` | `items` |
| `sensor:overall_average`, `sensor:class_average` | `period` (`string`), `out_of` (`number`) |
| `sensor:latest_grade` | `subject`, `out_of`, `coefficient`, `date` (ISO), `class_average`, `status` |
| `sensor:report_card` | `subjects` (voir plus bas), `comments` (`array<string>`), `period` |
| `sensor:current_period` | `start`, `end`, `index` (`number`) |
| `sensor:periods` | `items` : `{index, name, start, end}` ; `current_index` (`number`) |
| `sensor:evaluations` | `items` |
| `sensor:menu_today`, `sensor:menu_tomorrow` | `first_meal`, `main_meal`, `side_meal`, `other_meal`, `cheese`, `dessert` (tous `array`), `is_lunch`, `published` (`boolean`) |
| `binary_sensor:in_class` | `subject`, `classroom`, `teachers`, `ends_at` (ISO) |
| `binary_sensor:homework_overdue` | `count` (`number`), `items` : `{subject, due, description}` |
| `binary_sensor:test_today` | `count`, `subjects` (`array`) |
| `binary_sensor:lessons_canceled` | `count`, `items` |
| `binary_sensor:holidays` | `inferred` (`boolean`), `lookahead_days`, `next_lesson`, `weeks_fetched` |
| `todo:homework` | `supported_features` — le bit `UPDATE_TODO_ITEM` vaut **4** |

### Les listes imbriquées

```
lessons[]   id, subject, subject_id, background_color, teachers, classroom,
            start, end, canceled, status, test, outing, detention, exempted,
            memo, end_inferred

items[] de sensor:homework*
            id, subject, description, description_text, due, done,
            background_color, attachments, attachment_refs,
            attachment_links (déprécié)

items[] de sensor:evaluations
            id, name, subject, date, acquisitions[]
            (acquisitions : name, level, abbreviation)

items[] de sensor:delays
            id, date, minutes, justified, justification, reasons

items[] de sensor:absences
            id, from_date, to_date, justified, hours, days, reasons

subjects[] de sensor:report_card
            id, name, student_average, class_average, coefficient,
            comments, teachers
```

`description` est du **HTML** ; `description_text` est le même énoncé en texte
simple, avec de vrais retours à la ligne. Lisez `description_text` d'abord.

`due` est une **date seule** (`AAAA-MM-JJ`), pas un horodatage. La
distinction n'est pas théorique : `new Date('2026-09-10')` rend minuit **UTC**,
et reprojeté dans un fuseau à décalage négatif ce minuit recule d'un jour —
mesuré, la même échéance s'affichait le 10 à Paris et le 9 à la Martinique, à
Cayenne et à Tahiti, où **tout devoir dû aujourd'hui était donc déclaré en
retard**. Une date seule se compare et se met en forme comme un jour, jamais
comme un instant. Le champ était nommé dans le tableau ci-dessus sans être
typé, et c'est ce silence qui a laissé passer l'hypothèse.

**La `date` d'une évaluation est elle aussi une date seule** (`AAAA-MM-JJ`) :
`evaluation.date.isoformat()` sur un champ de type `date` côté intégration.
Le piège est le même que pour `due`, et il a frappé : la fixture des
évaluations écrivait un horodatage avec décalage, que l'intégration ne publie
pas, et la carte affichait la veille à la Martinique. `formatDayLabel` lit
désormais toute date seule comme un jour, pour toutes les cartes.

**`from_date` et `to_date` d'une absence, `date` d'un retard, sont des
horodatages complets** (`datetime.isoformat()`), et `hours` d'une absence est
la **chaîne** que PRONOTE écrit (« 2h00 »), jamais un nombre. Les fixtures de
la vie scolaire écrivaient des dates seules et `hours: 2`, et ne couvraient
donc pas la branche que les vraies données traversent.

**`start_time` et `end_time` d'un calendrier sont une heure locale de
l'instance, sans décalage** : Home Assistant les publie par
`strftime('%Y-%m-%d %H:%M:%S')`. `new Date()` les interprète dans le fuseau du
**navigateur**, et une carte qui les reprojette ensuite dans le fuseau
d'affichage change de jour dès que les deux diffèrent. Les échéances de
devoirs sont des évènements sur la journée entière (`all_day: true`) : seul le
jour compte, et il est écrit en tête de la valeur. Les devoirs **faits**
restent dans le calendrier, préfixés de « ✅ », et les attributs ne décrivent
que le **premier** évènement, fait ou non.

`attachments` est une liste de **chaînes** — des **noms**, jamais des
adresses — et les adresses vivent dans une **seconde** liste sur le même
devoir, `attachment_links`, de la forme `[{ name, url }]`. Le rapprochement se
fait par le nom, la même chaîne des deux côtés. `attachment_links` est
**absent** de l'entité : il est sur chaque élément de `items`, ce qui a coûté
une mesure pour être trouvé.

**`url` a deux formes, et c'est le piège de cet attribut.** Mesuré le
10 septembre 2026 en balayant tous les capteurs de devoirs de l'instance,
vingt-trois pièces :

| forme | compte | ce que c'est |
|---|---|---|
| `https://hôte/...` | 7 | une pièce de type **lien**, chez un tiers |
| `/api/carnet_scolaire/attachment/<empreinte>?authSig=<jeton>` | 16 | une pièce de type **fichier**, relayée par l'intégration |

La seconde est **enracinée**, donc `new URL(valeur)` sans base **lève**. Une
carte qui traite cette exception comme un refus écarte silencieusement les
seize — c'est ce qu'a fait la carte devoirs jusqu'au 11 septembre 2026. Elle
se résout contre l'adresse de l'**instance** (`hass.hassUrl`), jamais contre
celle du document : le tableau de bord Cast est servi depuis une origine
tierce, et résoudre contre la page y enverrait le jeton chez ce tiers.

Deux propriétés de cette adresse relayée, qui interdisent deux usages :

- **elle change à chaque écriture d'état** (le jeton porte sa date d'émission
  et d'expiration). Elle ne peut donc **jamais** servir de clé de comparaison
  ni de mémoïsation — le nom est la clé stable ;
- **elle ouvre le document sans demander d'identifiant.** Elle se traite comme
  l'URL iCal : jamais dans le dépôt, un test, la documentation ou une capture.
  Les fixtures n'en portent que la **forme**, avec un jeton synthétique.

Ce qui suit reste vrai de `attachments` seul, et explique pourquoi les deux
listes existent. Mesuré le 10 septembre 2026 : douze pièces
sur neuf devoirs de vingt, de treize à trente-neuf caractères, huit avec une
extension, aucune ne contenant `://` ni même une barre oblique — et aucune
adresse dans les soixante-sept entités. C'est une mesure à une date, pas une
garantie de forme : `attachmentsOf` (carte devoirs) accepte donc aussi
`{ name, url }` et une chaîne qui serait une adresse.

Pourquoi l'adresse est absente, parce que la question se repose sinon : il y
a deux sortes de pièces côté PRONOTE. Une pièce de type **lien** a une
adresse stable et sans secret. Une pièce de type **fichier** n'en a pas : son
chemin contient son numéro chiffré avec la clé et le vecteur de la session
en cours, plus un paramètre de session — l'adresse meurt à la connexion
suivante, et l'horizon réel est l'heure. Publier une telle adresse
produirait un lien mort garanti, pas un lien fragile.

C'est pourquoi l'intégration ne la publie pas et **relaie** : pour un fichier,
`url` est un chemin de son propre point d'entrée, et c'est elle qui va
chercher les octets avec la session vivante au moment du clic.

Ce paragraphe a longtemps fini par « `attachment_links` ne porte que les
pièces de type lien, et une pastille muette est le cas courant ». Les deux
moitiés sont fausses depuis que le relais existe, et la leçon vaut pour tout
ce fichier : **une forme d'attribut est une observation datée, pas une
propriété.** Ce qui reste vrai est la contrainte qui l'a produite — pas d'adresse
stable côté PRONOTE pour un fichier — et une contrainte peut être levée par la
couche du dessous sans que personne ici ne le sache.

**`attachment_refs`, la forme qui remplace `attachment_links`** (contrat
convenu avec l'intégration le 24 septembre 2026, pas encore observé sur
instance au moment d'écrire — à vérifier contre la première version qui la
publie) :

| clé | type | présente quand |
|---|---|---|
| `name` | chaîne | toujours |
| `kind` | `"external"` ou `"local"` | toujours ; toute autre valeur = pièce non ouvrable |
| `url` | chaîne, adresse **absolue** | `kind: "external"` seulement |
| `key` | seize chiffres hexadécimaux minuscules | `kind: "local"` seulement |

`key` est l'empreinte que l'intégration calcule sur l'identifiant du devoir et
celui de la pièce ; elle n'ouvre rien seule. L'adresse d'un `local` se demande
à `carnet_scolaire.get_attachment_url` (entrée `device_id` + `key`, réponse
`{url, expires_at}`), au clic, et elle expire en cinq minutes. Deux refus
typés, portés par `translation_key` dans l'erreur : `attachment_not_collected`
et `attachment_unknown`.

**`attachment_refs` ne couvre pas toutes les pièces.** Une pièce que
l'intégration ne sait pas ouvrir (`OPAQUE`) en est **absente**, et n'est plus
nommée que dans `attachments` (`_homework_dict` : « An OPAQUE attachment is
absent … and still named in attachments »). Lire les refs seules faisait
disparaître le document de la carte ; la carte ajoute donc, en pastilles
muettes, les noms d'`attachments` qui n'ont pas de ref.

`attachment_links` reste publié **une** version, déprécié, puis disparaît. La
carte ne le lit plus dès que `attachment_refs` est présent.

`end_inferred` vaut **exactement** « le serveur n'a pas envoyé la fin » —
vérifié dans les deux chemins de décodage de l'intégration, qui le posent tous
deux comme un simple test d'absence du champ. Rien d'autre ne le lève. Le
champ est toujours présent, et il peut valoir `true` sur **tous** les créneaux
— sur l'instance de référence, 37 sur 37 et **zéro** `false`, parce que cet
établissement ne publie aucune heure de fin. Le champ existe bel et bien côté
protocole et d'autres serveurs le renseignent : ne concluez pas de ce 37/37
que la donnée est toujours déduite.

Attention au sens de `false` : l'intégration remplace aussi une fin
**impossible** (à l'heure de début ou avant) par un créneau d'une heure, et ce
remplacement **ne lève pas** le drapeau. `false` veut donc dire « le serveur a
envoyé une fin », pas « cette fin est celle du serveur ». Aucun créneau de ce
genre n'a été observé sur l'instance de référence, faute de fin envoyée du
tout.

Les `lessons` publiées sont un **sous-ensemble** de ce que la passerelle
décode : `groups`, `virtual_classrooms`, `num`, `place` et `duration` existent
côté intégration mais **ne sont pas** dans l'attribut. Une carte ne peut donc
pas s'en servir — ce n'est pas une donnée manquante côté serveur, c'est une
donnée non exposée.

`background_color` et `subject_id`, que ce paragraphe rangeait parmi eux,
**sont** publiés par `_lesson_dict` depuis le 9 septembre 2026 (voir la
section « `background_color` » plus bas) : la phrase n'avait pas suivi.

### Le champ `id` des éléments — **une clé stable depuis l'intégration 0.1.5**

Jusqu'à la 0.1.4, l'`id` d'un devoir (et l'`uid` de la todo) était
l'identifiant de **session** PRONOTE, `147#…` : chiffré par session, il
changeait à chaque reconnexion. Une page ouverte avant une reconnexion
cochait donc un devoir sous un identifiant que PRONOTE ne reconnaissait plus
— réponse normale, rien d'enregistré. Mesuré le 26 septembre 2026 : l'uid
envoyé à 22:59:58 n'existait plus du tout après la reconnexion de 22:57.

Depuis la 0.1.5 (#76 côté intégration), chaque élément porte une clé
**calculée sur son contenu**, stable d'une session à l'autre. Formes
annoncées par l'intégration, puis **observées sur instance** le 26 septembre
2026 après la première collecte de la 0.1.5 : 54 devoirs en `hw-` (dont les
31 de la todo), 5 notes en `grade-`, 2 absences en `absence-`, 18
`attachment_refs[].key` en seize hex. Aucun suffixe `-N` n'est apparu : la
ligne des doublons reste une forme annoncée, non observée.

| élément | forme de `id` |
|---|---|
| devoir (`items[]` de `sensor:homework*`), et `uid` de `todo:homework` | `hw-` + 16 hex minuscules |
| créneau, note, absence, retard, punition, évaluation, information, discussion, message | `lesson-`, `grade-`, `absence-`, `delay-`, `punishment-`, `evaluation-`, `news-`, `discussion-`, `message-`, + 16 hex |
| deux éléments au contenu identique | la même clé, suffixée `-2`, `-3`… dans l'ordre d'apparition |

`attachment_refs[].key` **ne change pas de forme** : seize hex minuscules,
ni préfixe ni suffixe — la carte l'exige (`CLE_PIECE`). Seules les entrées du
condensé passent des identifiants de session aux clés stables.

Deux conséquences pour une carte :

- **aucune ne dépend de la forme** : seule la carte devoirs lit `id`, et elle
  le transmet tel quel à `todo.update_item`. Rien n'est à changer côté cartes ;
- **un énoncé modifié change la clé.** Une coche faite entre la modification
  et la collecte suivante vise une clé devenue inconnue : l'intégration lève
  alors une erreur plutôt que de répondre normalement, et la case revient à
  son état d'avant.

### `background_color` — **publié depuis le 9 septembre 2026, et mesuré**

Cette section demandait explicitement d'être refaite le jour où une
installation recevrait le champ. C'est arrivé, et voici le relevé — plus une
demande, plus une supposition.

| étage                            | attribut    | relevé sur instance                      |
| -------------------------------- | ----------- | ---------------------------------------- |
| créneaux (jour, demain, semaine) | `lessons[]` | 27 / 27 remplis                          |
| devoirs                          | `items[]`   | 12 / 12 remplis                          |
| moyennes par matière             | `items[]`   | liste vide (début d'année), clé présente |
| **prochain cours**               | —           | **le champ n'est pas publié**            |
| **évaluations**                  | —           | **le champ n'est pas publié**            |

Recensement en trois seaux sur les trois étages qui ont des données : **zéro
absent, zéro vide**. Trois seaux et non deux parce que l'intégration résout la
clé en mode tolérant : une clé absente rend `null`, une clé présente et vide
rend `""`, et un compteur à deux seaux dirait « pas de couleur » dans les deux
cas.

**La forme reçue :** hexadécimal à six chiffres, dièse compris, en
**capitales** — `#E73A1F`, `#FFED00`, `#144897`. Jamais de forme courte, jamais
de nom CSS, jamais d'entier. `subjectColor` accepte les capitales sans les
reformuler, donc rien à convertir.

**Ce que ces couleurs ne sont pas :** une palette de tableau de bord. Elles
viennent de l'établissement et sont choisies pour le fond blanc de l'interface
officielle. `#FFED00` est un jaune vif, `#144897` un bleu nuit. C'est la raison
pour laquelle les cartes ne s'en servent **qu'en accent** — un filet, jamais un
fond ni une couleur de texte. En aplat, la moitié de ces teintes casserait le
contraste sur un thème sombre.

**Six** cartes lisent le champ, pas trois : emploi du temps et journée sur
`lessons[]`, devoirs sur `items[]`, notes sur les `items[]` de
`sensor:averages`, évaluations sur ses propres `items[]`, prochain cours sur
l'attribut plat de `sensor:next_lesson`. Les deux dernières lisent un champ que
l'intégration ne publie pas encore sur leur étage : elles tombent donc sur la
table de l'utilisateur, ce qui est le rang 2 et non un défaut.

**Le rang 1 écrase le rang 2.** Une table `subject_colors` écrite pour
compenser l'absence du champ est devenue inopérante à l'instant où le champ est
arrivé, **sans un mot**. C'est le piège de cette publication, plus que la
couleur elle-même : personne ne relit ses tableaux de bord après une mise à
jour.

`subject_id` est publié en même temps, 27 / 27 sur les créneaux. C'est la clé
stable qu'une carte doit préférer au nom pour indexer quoi que ce soit : PRONOTE
écrit les matières en capitales, avec accents, et un établissement peut les
renommer en cours d'année.

La couleur est par ailleurs **exclue de la détection de changement**, et c'est
voulu : `Lesson.change_signature` écarte `memo`, `background_color` et le
contenu du cours, parce qu'« une correction de coquille ne doit pas réveiller
la maison ». Une couleur modifiée en cours d'année apparaîtra donc à la
collecte suivante **sans émettre d'évènement**. N'attendez pas d'`event` sur ce
champ.

Une valeur qui n'est pas un hexadécimal strict est ignorée par `subjectColor`,
et la ligne s'affiche alors sans accent de couleur. Le pire cas reste donc le
rendu d'avant la couleur.

`status` est **orthogonal** à `canceled` : `canceled` dit si le cours a lieu,
`status` dit pourquoi. Relevé réel sur une semaine — `canceled: true` avec
« Prof. absent », et `canceled: false` avec « Cours modifié ». Traitez `status`
comme du texte opaque : les libellés observés sont ceux qu'un établissement a
écrits, pas une énumération fermée.

`hours` est une **chaîne écrite par l'établissement** (« 2h00 »), pas un nombre,
et `reasons` un tableau de chaînes. Ni l'un ni l'autre ne se reformule : un
motif d'absence peut contredire le drapeau `justified` sans que ce soit une
erreur à corriger.

### `classroom` — du texte libre, mesuré

37 créneaux relevés sur une instance le 9 septembre 2026 : **32 portent une
salle, 5 non** — le champ manque, il n'est pas vide. Les 32 valeurs ont toutes
la même forme : trois ou quatre caractères, commençant par un chiffre, en
capitales, une seule salle par créneau, et **aucune ne contient le mot
« salle »**.

Ce relevé sert une décision de carte. La vue journée écrit « Salle 2.14 »
plutôt que « 2.14 », parce qu'un nombre seul, posé à côté d'horaires et d'un
nom de professeur, se lit aussi bien comme une note. Le mot n'est **pas**
ajouté quand la valeur le porte déjà, et c'est là que le relevé compte : sur
cette instance, ce cas ne se produit jamais. La garde existe pour un
établissement qui écrirait « SALLE 204 » ou « Salle polyvalente » — le champ
est du texte libre côté serveur, donc il faut s'y attendre sans pouvoir le
mesurer ici.

**Ce que ce relevé ne dit pas** : rien sur les créneaux à plusieurs salles.
Aucune valeur observée ne contenait de séparateur, mais 32 valeurs d'un seul
établissement ne suffisent pas à conclure qu'un dédoublement de salle est
impossible. Si le cas apparaît, il arrivera probablement comme une chaîne à
séparer, pas comme un tableau — c'est ainsi que `teachers` a évolué.

## Compte — les clés de la carte limiteur

| clé                                             | attributs                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `sensor:limiter_state`                          | `options` (`array<string>`), `reason`, `until`, `consecutive_failures` (`number`)                                  |
| `sensor:remaining_budget`                       | `daily_cap`, `hourly_rate`, `tokens`                                                                               |
| `sensor:calls_today`                            | `by_tier` (`object`, palier → nombre), `logins`, `failed_logins`                                                   |
| `sensor:next_collection`                        | `tiers_due` (`array<string>`), `overdue_by` (secondes), `failing` (`object`, palier → nombre d'échecs consécutifs) |
| `sensor:last_collection`                        | `tier`, `duration_ms`, `calls`                                                                                     |
| `sensor:logins_today`                           | `failed`, `cap`                                                                                                    |
| `sensor:session_age`, `sensor:session_lifetime` | voir « Le piège des unités »                                                                                       |

`consecutive_failures` du limiteur et `failing` de la prochaine collecte **ne
comptent pas la même chose**, délibérément : le premier ne compte que les
erreurs de transport et les refus du serveur, parce que c'est lui qui pilote le
recul exponentiel. Un palier qui ne sait pas décoder une réponse pourtant bien
formée apparaît donc dans `failing` avec un limiteur à zéro. « Le serveur va
bien, un palier ne comprend pas sa réponse » est l'histoire que les deux
nombres racontent ensemble : ne les réconciliez pas sur une carte.

## Ce qui n'est PAS vérifié sur instance

Les formes ci-dessus viennent d'une instance réelle, sauf celles dont la liste
était vide au moment du relevé. Leur forme vient alors du source Python de
l'intégration — la bonne provenance, mais pas une observation :

- `items` de `sensor:grades`, `sensor:averages`, `sensor:evaluations`,
  `sensor:punishments`, `sensor:delays`
- `subjects` de `sensor:report_card`, et tous les attributs de
  `sensor:latest_grade` : les deux entités étaient `unknown`, la période
  venant de commencer
- `image:photo` — **l'entité n'existe pas** sur toutes les installations.
  L'intégration ne la crée que si le compte annonce une photo.

Quand vous vérifiez une de ces formes sur une instance où elle est renseignée,
mettez la ligne à jour ici.

## La cantine — trois pièges, tous mesurés dans la source

Relevés dans `sensor.py` et `gateway.py` de l'intégration, avec les lignes,
parce que ce sont trois cas où le nom de l'attribut ne dit pas ce qu'il fait.

**1. Le capteur du jour ne sert pas forcément le déjeuner.** `_menu_for`
(`sensor.py:816-820`) :

> _« The lunch menu for one day, falling back to any meal that day. »_
> `return lunch or (same_day[0] if same_day else None)`

Un établissement qui publie un dîner et pas de déjeuner alimente donc
`sensor:menu_today` avec le **dîner**. Une carte qui titre « le midi » sur ce
capteur peut affirmer quelque chose de faux, et `is_lunch` est le seul champ
publié qui le dirait.

**2. `is_lunch` a trois valeurs, et le troisième est délibéré.** La source dit
qu'il « reste `None` plutôt que de deviner un service ». Donc `true`, `false`,
et le silence du producteur — trois phrases, pas deux. Et `false` permet de
**nier** qu'un service soit le déjeuner sans permettre de **nommer** ce qu'il
est : `is_dinner` existe dans l'objet de transfert et n'est pas publié, pas
plus que `name` (l'intitulé du repas).

**3. Un plat est une chaîne, et il ne l'était pas en amont.** `_food_names`
(`gateway.py:1716-1720`) ne retient que `food.name` : le tableau `labels` de
chaque plat — où vivent les libellés de régime et d'allergène — est jeté à la
frontière entre la bibliothèque et la passerelle. Ce n'est donc pas une donnée
que PRONOTE n'envoie pas ; c'est une donnée aplatie avant d'atteindre le
moindre objet de transfert. Aucune carte ne peut la récupérer, et l'exposer
demanderait de changer le type des six champs de repas.

Ne concluez pas de l'absence d'un champ dans la forme publiée qu'il n'existe
pas côté serveur. C'est l'erreur que ce dépôt a commise sur ce point précis :
lire l'objet de transfert, puis affirmer quelque chose sur toute la chaîne.

## Et `sensor:teaching_staff`

Elle existe, et **aucune carte ne la lit**. Ce n'est pas un oubli à corriger
sans réfléchir : ajouter une carte qui la consomme demande d'abord d'en voir la
forme renseignée, ce qui n'a pas encore été le cas.
