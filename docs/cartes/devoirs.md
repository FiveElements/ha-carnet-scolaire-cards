# Devoirs

Les devoirs à faire, groupés par échéance ou par matière, avec la case à
cocher quand l'intégration l'autorise.

![Aperçu de la carte Devoirs](../assets/cartes/devoirs.svg)

*Illustration synthétique : rien n'y vient d'un élève réel. Les dates, les
horaires et les valeurs sont inventés ; les matières sont des matières de
programme.*

## Configuration

```yaml
type: custom:carnet-scolaire-devoirs
device_id: <appareil de l'enfant>
status: todo
period: all
group_by: date
```

## Options

| Option | Défaut | Effet |
| --- | --- | --- |
| `status` | `todo` | `todo` (à faire) ou `all` (tous, faits compris). |
| `period` | `all` | `all` (toutes les échéances), `from_today` (aujourd'hui et après), `tomorrow` (demain), `from_tomorrow` (demain et après) ou `week` (les 7 prochains jours). Voir [Les deux filtres](#les-deux-filtres). |
| `filter` | — | L'ancien filtre unique, remplacé par les deux précédents. Toujours lu : voir [Les deux filtres](#les-deux-filtres). |
| `group_by` | `date` | `date` ou `subject`. Les devoirs sont toujours ordonnés par échéance — groupés par matière, à l'intérieur de chaque matière. Voir [Ce que chaque niveau dit](#ce-que-chaque-niveau-dit). |
| `limit` | *tout* | Nombre maximum de devoirs. Absent ou négatif : tout. `0` : rien — et la carte dit alors que la cause est l'option, non l'absence de devoirs. |
| `max_lines` | *aucun repli* | Nombre de lignes d'énoncé avant repli. Voir [L'énoncé long](#lenonce-long-et-la-hauteur-de-la-carte). |
| `show_attachments` | `true` | Afficher les pièces jointes d'un devoir, une pastille par pièce. Voir [Les pièces jointes](#les-pieces-jointes). |
| `subject_colors` | — | Table matière → couleur. **En YAML uniquement**, voir plus bas. |

### Exemple complet

Les trois options les plus courantes, copiables telles quelles. Les autres
— la table de couleurs, le repli de l'énoncé, les pièces jointes — ont chacune
leur section plus bas :

```yaml
type: custom:carnet-scolaire-devoirs
device_id: <appareil de l'enfant>
status: todo
period: from_tomorrow
group_by: date
limit: 12
```

`title` et `entities` fonctionnent en plus sur toutes les cartes : voir
[Deux options communes](../installation.md#deux-options-communes-a-toutes-les-cartes).

## L'énoncé long, et la hauteur de la carte

C'est la plus haute des onze cartes, pour une raison qui lui est propre :
l'énoncé est son **contenu**, pas sa décoration. Mesuré le 10 septembre 2026
sur une instance — des énoncés allant jusqu'à 313 caractères, l'un d'eux
occupant à lui seul 161 pixels, et la carte atteignant **1 376 pixels** avec
le filtre « à faire », **1 647** avec « tous ».

`max_lines` replie l'énoncé au nombre de lignes voulu :

```yaml
type: custom:carnet-scolaire-devoirs
device_id: <appareil de l'enfant>
max_lines: 3
```

Trois choses rendent ce repli sûr, et elles comptent : un énoncé tronqué sans
le dire cacherait la moitié d'un devoir à quelqu'un qui ne sait pas qu'il y a
une moitié cachée.

- **Le repli se signale tout seul.** Les points de suspension sont peints par
  le navigateur, et **seulement quand le texte déborde vraiment**. Un énoncé
  qui tient déjà dans le nombre de lignes demandé n'est pas replié du tout.
- **Un bouton court déplie**, et referme. « Déplier l'énoncé », pas
  l'énoncé lui-même : c'était un bloc `details` dont le résumé contenait tout
  le texte, et un lecteur d'écran annonçait donc **269 caractères comme
  libellé d'un bouton**, puis proposait de déplier quelque chose de vide.
  Mesuré le 10 septembre 2026.
- **Le texte entier reste dans la page** pendant qu'il est replié. Une
  recherche dans le navigateur le trouve, et un lecteur d'écran le lit en
  entier : la coupe est faite par `overflow`, qui n'ôte rien de l'arbre
  d'accessibilité. Le bouton n'apporte donc rien à qui écoute la carte — il
  ne lui promet rien non plus.

L'option est vide par défaut : sans elle, rien ne change.

!!! note "Le repli n'est pas exact, et l'erreur dépend de la largeur"

    La carte décide de replier **avant** de connaître sa largeur, en comptant
    80 caractères par ligne. Mesuré sur les mêmes vingt devoirs, à trois
    largeurs, avec `max_lines: 3` :

    | largeur | caractères par ligne | replis posés | replis utiles | replis inutiles |
    |---|---|---|---|---|
    | 380 px | ≈ 54 | 6 | 6 | 0 |
    | 700 px | ≈ 104 | 6 | 4 | 2 |
    | 1 100 px | ≈ 168 | 6 | 3 | 3 |

    Cette page a d'abord annoncé que l'erreur allait toujours dans le même
    sens — replier moins souvent qu'il ne faudrait. C'est vrai sur une carte
    étroite et **faux** au-delà d'environ 550 pixels, où la constante devient
    trop basse : la carte replie alors des énoncés qui tenaient déjà.

    Ce qui reste exact à toute largeur, et c'est ce qui fait tenir le
    mécanisme : les points de suspension sont peints par le navigateur, et
    seulement sur un débordement réel. Un repli inutile pose donc un bloc
    dépliable qui n'annonce rien — le canal visuel ne ment jamais. Seule la
    sémantique se trompe, en offrant à déplier ce qui était entier.

    Aucune constante ne corrige les deux bouts. Le rendre exact demande de
    faire descendre la largeur de la carte jusqu'au rendu, ce qui touche le
    socle et n'est pas décidé.

### La hauteur annoncée à Home Assistant

Home Assistant demande à chaque carte sa hauteur pour équilibrer les colonnes
d'une vue en maçonnerie. Celle-ci annonçait **5**, soit environ 250 pixels,
pour 1 376 mesurés — un facteur cinq, et le plus large écart du dépôt : la
carte la plus haute se déclarait parmi les plus courtes. Elle l'estime
désormais d'après ses deux filtres, son `limit` et son `max_lines`.

Cette estimation reste approximative, et il vaut mieux le savoir que le
découvrir : la hauteur dépend surtout de la longueur des énoncés, qui est une
**donnée** et non une option — or Home Assistant ne passe que la
configuration. Un `limit` explicite, lui, est exact et remplace l'estimation.

## Les couleurs de matière

La couleur de la matière est une **gouttière à gauche** du bloc, comme sur
les quatre autres cartes à gouttière. La [vue journée](journee.md) est
l'exception : elle pose son filet **entre l'heure et la matière**, parce que
sa colonne d'horaires se lit seule et qu'un filet à sa gauche colorerait
l'heure autant que la matière. Un devoir sans couleur
garde sa gouttière, réservée mais transparente : sans elle, la ligne se
décalerait de neuf pixels par rapport à sa voisine colorée, ce qui se lit
comme un défaut d'affichage plutôt que comme une matière sans couleur.

Cette page a décrit pendant un temps un autre placement — un filet pleine
hauteur posé entre la matière et l'énoncé, qui coupait la ligne en deux —
et une colonne de matière de largeur commune à toutes les lignes d'un même
jour. Les deux ont été retirés par la même décision, et pour une raison qui
n'est pas l'esthétique : la matière **titre** désormais le bloc, et
l'énoncé passe dessous sur toute la largeur de la carte. En colonne, il ne
disposait que de 132 pixels sur une carte de 420 — or l'énoncé est ce que
la carte a à dire.

Depuis la version 0.0.13 de l'intégration, cette couleur vient
**du serveur** : vous n'avez rien à écrire pour la voir. Une table
`subject_colors` ne sert plus qu'à colorer une matière que votre
établissement laisse sans couleur, ou à remplacer une teinte qui vous
déplaît — et le serveur **gagne** sur votre table, donc une entrée qui
double une couleur reçue ne fait plus rien.

```yaml
type: custom:carnet-scolaire-devoirs
device_id: <appareil de l'enfant>
subject_colors:
  MATHEMATIQUES: '#1e88e5'
  histoire-géographie: '#8d6e63'
  Sciences: '#43a047'
```

Les trois rangs de la couleur, le format accepté — hexadécimal strict,
le reste est refusé sans un mot — le repliement de la casse et des
accents, et ce que l'option ne fait pas sont décrits une fois pour
toutes dans [Les couleurs de matière](../couleurs-de-matiere.md).

## Entités consommées

| Clé | Rôle |
| --- | --- |
| `sensor:homework_tomorrow` | Requise avec `period: tomorrow`. |
| `sensor:homework_todo` | Requise avec `status: todo`, pour toute autre période. |
| `sensor:homework` | Requise avec `status: all`, pour toute autre période que demain. |
| `binary_sensor:homework_overdue` | Optionnelle. Bandeau « en retard » en tête. |
| `todo:homework` | Optionnelle. Rend la case à cocher possible (voir ci-dessous). |
| `calendar:homework` | Optionnelle. Nomme la prochaine échéance, quel que soit le filtre. |

Trois entités distinctes portent le même nom de traduction sur des
domaines différents — `sensor:homework`, `calendar:homework` et
`todo:homework`. C'est la raison pour laquelle toutes les clés du projet
sont qualifiées par leur domaine.

`calendar:homework` n'est lue que dans ses **attributs**. Obtenir la liste
de ses évènements demanderait un appel de service, donc une collecte au
rendu — que le projet interdit et que le type refuse à la compilation. La
ligne « prochaine échéance » survit à l'état vide, et c'est là qu'elle sert
le plus : rien à rendre demain, mais une échéance existe plus loin.

## Les deux filtres

Un devoir se filtre sur deux questions indépendantes : **est-il fait ?** et
**quand est-il dû ?** L'ancien réglage `filter` n'en offrait qu'une à la fois
— « à faire » ou « pour demain » — et on ne pouvait donc pas demander les
devoirs à faire pour demain seulement. `status` et `period` se combinent
librement :

| `period` | ce qui est montré | le retard ? |
| --- | --- | --- |
| `all` | toutes les échéances de l'horizon | oui |
| `from_today` | aujourd'hui et après | non |
| `tomorrow` | le lendemain seulement | non |
| `from_tomorrow` | demain et après | non |
| `week` | aujourd'hui et les six jours suivants | non |

Les jours se comptent dans le fuseau de la carte, comme le retard. Un devoir
sans échéance lisible n'entre dans aucune période datée : on ne peut pas dire
qu'il est pour demain. Il reste visible avec `period: all`.

Écarter les retards de la liste ne les fait pas disparaître de la carte : le
bandeau « en retard » en tête compte à part, sur le capteur de l'intégration,
quelle que soit la période.

**Un tableau de bord existant ne change pas d'aspect.** `filter` est toujours
lu quand `status` ou `period` manque, et chacune de ses valeurs se traduit
exactement :

| ancien réglage | équivaut à |
| --- | --- |
| *(aucun)* ou `filter: todo` | `status: todo`, `period: all` |
| `filter: tomorrow` | `status: all`, `period: tomorrow` |
| `filter: all` | `status: all`, `period: all` |

Les deux nouveaux champs priment, chacun pour lui-même : `filter: tomorrow`
avec `status: todo` donne les devoirs à faire pour demain. Le formulaire ne
propose plus `filter`, et le remplace dès qu'on touche l'un des deux.

Sous le capot, la carte lit toujours le capteur le plus étroit qui contienne
ce qu'elle va montrer — celui « pour demain », celui « à faire », ou celui de
tous les devoirs — puis trie elle-même. Sur le capteur « à faire », elle ne
retrie pas l'état : c'est l'intégration qui sait ce qu'est un devoir fait.

## Ce que « en retard » veut dire, et ses deux sources

La pastille apparaît à **deux** endroits, qui ne disent pas la même chose.

En tête de carte, un bandeau suit `binary_sensor:homework_overdue`. Il porte
sur l'élève entier, pas sur la fenêtre affichée : avec `filter: tomorrow`,
vous pouvez donc le voir alors qu'aucune ligne visible n'est en retard. C'est
voulu, et c'est même le seul endroit où l'information vous parvient dans ce
filtre.

**Y compris quand la fenêtre est vide**, et cette page a affirmé le contraire
en pratique pendant plusieurs versions. Le message « Rien à rendre demain »
était rendu **avant** que le bandeau soit calculé, donc un vendredi soir, un
week-end ou un jour férié la carte annonçait qu'il n'y avait rien à faire
au-dessus de quatre devoirs en retard. C'était le pire défaut de cette carte
— une **fausse mise en sécurité** — et il est corrigé depuis le 10 septembre
2026. Le bandeau et la prochaine échéance ne dépendent pas de la liste
affichée : c'est vide qu'ils servent le plus.

Il annonce **combien** : « 4 en retard », et non le seul mot. Le chiffre vient
de l'attribut `count` du capteur, que la carte jetait jusqu'au 10 septembre
2026. Sur une intégration antérieure à cet attribut, le bandeau garde le
libellé nu plutôt que de disparaître.

Sur une ligne, la pastille suit la **date du devoir** : échéance passée **et**
devoir non fait. Les deux conditions comptent. Un devoir coché dont l'échéance
est passée est le cas normal — on coche après avoir fait, et l'échéance passe
ensuite.

Ce second point a été corrigé le 10 septembre 2026. La carte ne regardait que
la date : mesuré sur une instance avec `filter: all`, **neuf** lignes portaient
la pastille pour **quatre** retards réels, et les cinq de trop étaient
exactement les cinq devoirs cochés. L'intégration, elle, comptait juste. La
carte criait donc au retard d'autant plus fort que l'élève avait travaillé, et
elle contredisait son propre bandeau sur la même page.

## Ce que chaque niveau dit

**L'intertitre porte ce qui distingue le bloc ; la ligne porte ce qui distingue
le devoir.** Une seule règle, et c'est ce qui décide de la disposition :

| `group_by` | l'intertitre dit | la tête de ligne dit |
|---|---|---|
| `date` (défaut) | l'échéance | la matière |
| `subject` | la matière | l'échéance |

La fin de ligne ne porte, dans les deux cas, que la pastille « en retard ».

Cette règle a d'abord été écrite pour un seul cas, et c'est l'erreur à
retenir. Groupée par échéance, la carte répétait la date en fin de chaque
ligne : corrigé le 10 septembre 2026, après mesure — quinze lignes sur
dix-sept dont la fin reprenait mot pour mot le titre juste au-dessus. Le
symétrique est resté cassé un jour de plus, et il était pire : groupée par
matière, **vingt lignes sur vingt** portaient en tête la même chaîne que leur
intertitre. Le propriétaire l'a signalé le 11 septembre 2026 — « le titre dit
la matière, puis chaque ligne dit la même matière ».

**Une correction écrite pour le cas qu'on regarde laisse debout le cas
symétrique**, et elle le laisse debout avec, juste à côté, un commentaire qui
explique pourquoi il faudrait le corriger. Un test vérifie désormais la règle
dans les **deux** regroupements, plutôt qu'un cas dans chaque sens.

Un détail de forme : groupée par matière, la tête de ligne écrit « pour le
11 septembre » et non la date nue. En tête de ligne, une date seule ne dit pas
de quoi elle est la date, et cette carte en porte deux notions — le jour du
rendu, et le retard.

## Les pièces jointes

Un devoir peut porter des documents. L'intégration les publie dans
`attachments`, et la carte les a ignorés pendant onze versions : un devoir qui
demandait d'ouvrir une fiche ne le disait pas.

Chaque pièce apparaît désormais en **pastille** sous l'énoncé, et
`show_attachments: false` les retire. Elles restent visibles quand l'énoncé
est replié : c'est justement le devoir dont on ne lira que les premières
lignes, et s'il porte un document il doit continuer à le dire.

La pastille n'est pas une décoration, c'est le vocabulaire de la carte
notes, de la carte élève et de l'emploi du temps — elle prend ses couleurs
du thème, elle passe à la ligne toute seule quand la carte est étroite, et
elle donne une cible de clic prenable au doigt le jour où il y aura quelque
chose à ouvrir. Une première version reprenait le gabarit du site web de
PRONOTE, une liste à tirets précédée d'un libellé « Pièces jointes : ».
Ce libellé coûtait une ligne entière pour ce qu'un nom de fichier dit déjà :
il ne s'écrit plus, mais il nomme le groupe pour un lecteur d'écran, qui
annoncerait sinon « liste, deux éléments » sans dire de quoi.

Deux mesures faites dans un thème réel, parce qu'elles ont chacune renversé
une préférence :

- **la pastille lit à la taille de l'énoncé**, pas plus petit. La primitive
  réduit de 0,8 et la ligne secondaire déjà de 0,9 : un nom de fichier tombait
  à dix pixels, plus petit que le texte au-dessus de lui. Un nom de document
  est du contenu, pas une étiquette d'état ;
- **une pastille ouvrable est soulignée**, et de la même couleur que les
  autres. La couleur d'accent du thème sur le fond de pastille donnait 2,59
  contre 1 — la règle sur le contraste des textes demande 4,5. Le soulignement
  ne dépend d'aucune couleur, ce qui est justement ce qu'on attend d'un lien
  posé au milieu d'un texte. Sans adresse, pas de soulignement : c'est ce qui
  distingue ce qui s'ouvre de ce qui se lit.

Les pastilles de pièces jointes ne se confondent pas avec la pastille
« en retard », et c'est mesuré plutôt qu'espéré : celle-ci est blanche sur
rouge, plus petite, et posée dans la partie finale de la ligne, là où les
pièces sont grises sur gris, sous l'énoncé. La couleur porte l'alerte, la
taille porte la lisibilité : les deux familles n'occupent pas le même canal.

Mesuré le 10 septembre 2026 sur une instance : douze pièces réparties sur neuf
devoirs sur vingt, deux au plus par devoir — et vingt-trois en balayant tous
les capteurs de devoirs, fenêtres et périodes confondues. Les deux comptes
sont justes et ne mesurent pas la même chose : le premier est ce que la vue
par défaut affiche, le second ce que l'intégration publie.

### Ouvrir la pièce : chez le tiers, ou par l'intégration

**Toutes les pastilles s'ouvrent désormais, par deux chemins différents.**

Cette page a affirmé le contraire, en gras, et il faut le lire avant la
suite : « une pastille sur trois s'ouvre, et les autres ne s'ouvriront
**jamais** ». La phrase était fondée — elle décrivait une vraie propriété de
PRONOTE, établie dans la source de la bibliothèque — et elle était fausse
comme **énoncé sur le produit**. Ce qui n'a pas d'adresse stable chez PRONOTE
peut très bien en recevoir une ailleurs, et c'est ce que l'intégration a fait
en relayant les octets elle-même. L'erreur n'était pas dans le fait, elle
était dans la **portée** que je lui ai donnée : une limite vraie d'un composant
publiée comme une limite du produit. C'est la troisième fois que cette section
décrit une limite en se trompant sur son origine, et les trois fois le défaut
a la même forme.

Il y a **deux sortes de pièces**, et la différence décide encore de tout — non
plus de ce qui s'ouvre, mais de **qui** l'ouvre. Établi dans la source de la
bibliothèque, pas déduit d'une adresse observée :

- une pièce de type **lien** porte son adresse telle quelle — stable, sans
  secret. Un lien vers elle vivrait ;
- une pièce de type **fichier** n'a pas d'adresse stable du tout. Le long
  jeton de son chemin n'identifie pas le document : c'est son numéro chiffré
  avec la clé **et** le vecteur de la session en cours, suivi d'un paramètre
  de session. Deux adresses du même document, obtenues depuis deux sessions,
  n'ont aucun octet commun. Une telle adresse meurt à la connexion suivante,
  et une session inactive est abandonnée au bout d'une heure.

Ce que ça change : republier telle quelle l'adresse d'un fichier aurait donné
un lien mort à la connexion suivante — et une pastille cliquable qui ouvre une
page d'erreur est pire qu'un nom, parce qu'elle a promis. L'intégration ne le
fait donc pas. Elle **relaie** : elle publie une adresse **chez elle**, un
chemin de son propre point d'entrée, et c'est elle qui va chercher les octets
au moment où vous cliquez, avec la session vivante. Vous ne voyez jamais
l'adresse PRONOTE, et il n'y a rien à renouveler.

Une pastille de type lien s'ouvre donc chez le tiers, dans un nouvel onglet ;
une pastille de type fichier s'ouvre chez votre Home Assistant. Les deux sont
soulignées, parce que les deux s'ouvrent — la carte ne fait pas de différence
visible entre elles, et c'est voulu : la distinction intéresse celui qui écrit
la carte, pas celui qui cherche la fiche de révisions.

Mesuré le 10 septembre 2026 sur une instance, avant et après : sur les
vingt-trois pièces jointes de l'instance, **sept portent une adresse absolue**
vers un tiers — un site de vente, une vidéo, un éditeur scolaire — et
**seize un chemin relayé**. La carte refusait les seize : `new URL` sans base
lève sur un chemin enraciné, et le filtre traitait cette exception comme un
refus. Cinq de ces pastilles muettes étaient visibles dans la vue par défaut.

**Un clic ouvre le document à toute heure, heures calmes comprises**, depuis
la version 0.0.28 de l'intégration. Avant elle, le relais traitait le
téléchargement comme une collecte ordinaire : entre 22 h et 6 h, un document
jamais ouvert répondait « deferred by the rate limiter: quiet_hours » au lieu
de s'afficher. Le propriétaire l'a résumé en une phrase, qui est devenue la
règle : **heure calme ne signifie pas déconnecté.** Les heures calmes arrêtent
les collectes automatiques ; un geste humain — ce clic, la case d'un devoir,
un rafraîchissement demandé — passe, parce qu'il ne coûte qu'une requête et
que quelqu'un l'attend.

Il reste soumis au reste des protections de l'intégration : le budget du jour,
l'espacement entre requêtes, et le cache — un document déjà ouvert ne repart
pas vers l'établissement. Si l'une d'elles refuse, l'onglet affiche une
réponse brute de l'intégration, en anglais, avec un délai après lequel
réessayer. Ce n'est pas « introuvable » : c'est « pas maintenant ».

Ce paragraphe disait l'inverse, en l'attribuant à l'intégration et en
précisant « non mesuré ici ». La précaution était juste, la phrase aussi à
l'époque — et c'est le propriétaire qui l'a trouvée fausse **à l'usage**, en
voulant vérifier un devoir un soir. Une limite rapportée par une
autre couche est datée comme une forme d'attribut : elle dure tant que cette
couche ne change pas d'avis.

**Une phrase en bas de carte dit pourquoi**, une seule fois, dès qu'au moins
une pièce affichée ne s'ouvre pas. Sans ça la carte ressemble à une panne, et
c'est exactement la conclusion qu'en a tirée le propriétaire : « les liens sur
les fichiers ne fonctionnent pas ». Il avait raison, et la correction a pris
cinq versions.

Cette phrase se voit maintenant beaucoup moins, et ce qu'elle dit a changé.
Elle annonçait que les pièces non soulignées étaient des fichiers que PRONOTE
ne laisse pas ouvrir — ce n'est plus vrai. Elle dit désormais que
l'intégration n'a **pas publié d'adresse** pour ces pièces, ce qui reste vrai
quelle qu'en soit la raison : une version d'intégration antérieure au relais,
ou une sorte de pièce qu'elle ne sait pas servir. La phrase ne nomme plus la
cause qu'elle croyait connaître.

Cette phrase a d'abord été posée en **infobulle** sur chaque pastille muette,
et cette page présentait le dispositif comme acquis. Il ne l'était pas : il
n'y a pas de survol au doigt, et une pastille sans lien n'est pas
focalisable au clavier. Sur téléphone — qui est la cible de ce projet —
l'explication était donc **invisible**, et les cinq pastilles muettes de la
vue par défaut restaient inexpliquées. Une fois par carte plutôt que sous
chaque devoir : l'information se lit une fois.

Si vous comptez les ancres et qu'il vous en manque une, vérifiez d'abord quel
capteur la carte lit. Un devoir **coché fait** sort de la liste à faire par
construction, avec sa pièce ouvrable : c'est arrivé le 10 septembre 2026, où
`filter: all` montrait quatre liens et le réglage par défaut trois.

#### L'adresse d'un fichier se demande au clic

**Avec une intégration récente, l'adresse d'un fichier n'est plus publiée
nulle part.** La pastille est un bouton : au clic, la carte ouvre un onglet,
demande l'adresse au service `carnet_scolaire.get_attachment_url`, et y dirige
l'onglet. Rien ne change à l'œil — la pastille reste soulignée.

La raison est la sécurité, et c'est le propriétaire qui l'a tranchée : une
adresse relayée ouvre le document **sans identifiant**. Publiée dans un
attribut d'entité, elle était enregistrée dans l'historique de Home
Assistant, envoyée à chaque navigateur abonné, et valable douze heures.
Frappée au clic, elle n'existe que le temps d'ouvrir l'onglet, et
l'intégration la fait expirer en cinq minutes. La carte ne la retient pas :
un second clic en demande une autre.

L'intégration publie désormais `attachment_refs` sur chaque devoir, et deux
genres de pièces :

| genre | ce qui est publié | ce que fait la carte |
|---|---|---|
| `external` — un lien collé par un professeur | l'adresse, absolue | un lien, ouvert directement |
| `local` — un fichier | une empreinte, qui n'ouvre rien seule | un bouton, qui demande l'adresse au clic |

Les liens externes gardent leur adresse dans l'attribut, et c'est un choix
contesté puis **mesuré** : sur l'instance, aucune des onze adresses de ce
genre ne pointait vers l'établissement ni ne portait de jeton de session. Ce
sont des adresses publiques, déjà visibles de l'élève dans PRONOTE, que
personne ne frappe. Si l'intégration voyait un jour un « lien » pointant vers
l'établissement lui-même, elle s'est engagée à le traiter comme un fichier.

Quatre choses sont vérifiées par la suite de tests, pas seulement promises :

- **aucun appel à l'affichage.** Le bouton existe, le service n'est pas
  touché tant qu'on n'a pas cliqué ;
- **l'onglet s'ouvre avant la demande.** Dans l'ordre inverse, l'ouverture
  arrive après l'attente de la réponse et n'est plus rattachée au clic :
  Safari la bloque sans un mot. Si le navigateur la bloque quand même, la
  carte le dit ;
- **l'adresse rendue par le service passe par le même filtre** qu'une adresse
  d'attribut — schéma, origine de l'instance. Refusée, l'onglet se referme et
  la carte dit que la pièce n'a pas pu être ouverte ;
- **deux refus ont chacun leur phrase** : « pas encore collecté », qui passe
  tout seul, et « plus dans les devoirs publiés », qui se règle en
  rafraîchissant la page.

Un genre de pièce que cette carte ne connaît pas reste un nom muet : une
intégration plus récente pourrait en publier un, et se taire vaut mieux que
deviner. Pendant le décalage de versions, une intégration antérieure qui ne
publie que `attachment_links` fonctionne comme avant ; dès que
`attachment_refs` est là, l'ancienne liste n'est plus lue du tout, parce que
c'est elle qui porte le jeton qu'on retire.

Un retour sur la première des limites ci-dessous : elle affirmait qu'ouvrir
une pièce « demanderait un appel de service ». C'était faux à l'époque, et ça
l'est encore dans le sens où elle l'entendait — rien ne l'imposait. Qu'un
appel de service soit **aujourd'hui** le chemin est un choix de sécurité fait
après coup, pas la confirmation d'une limite.

#### Comment les deux listes se rejoignent

L'intégration publie sur chaque devoir `attachments`, les noms de toutes les
pièces, et `attachment_links`, les seules pièces ouvrables. La carte les
rapproche **par le nom**, la même chaîne des deux côtés, et garde l'ordre de
la première liste — un tri qui remonterait les pièces ouvrables ferait bouger
les pastilles d'un devoir à l'autre sans qu'on puisse le prévoir.

Pourquoi deux listes et non une adresse ajoutée à la première, puisque ça
aurait été plus simple ici : `attachments` porte des chaînes depuis l'origine,
et y mettre des objets casserait tout gabarit qui la joint par des virgules
— ce qui est la façon normale d'écrire « Pièces jointes : a.pdf, b.pdf »
dans une notification. Le coût a été pesé des deux côtés, et une ligne de
carte coûtait moins cher qu'une rupture pour tous les lecteurs de l'attribut.

Ce rapprochement a une **faiblesse connue**, signalée plutôt que découverte :
si un même devoir porte deux pièces de même nom dont une seule est un lien,
le nom ne les distingue plus et les deux pastilles s'ouvrent vers la même
adresse. C'est rare, c'est cosmétique, et c'est le prix assumé de ne pas
rompre la forme. La carte ne « corrige » pas ce cas en n'ouvrant que la
première pastille : rien ne dirait que c'est la bonne.

Six précautions encadrent ce lien. Elles étaient trois, et les trois ajoutées
portent toutes sur la même question : contre quoi résoudre un chemin, et
comment vérifier qu'il n'en est pas sorti.

- **seuls `http` et `https` sont acceptés.** Cette valeur vient du serveur et
  atterrit dans un attribut `href` : un `javascript:` y exécuterait du code
  dans votre page Home Assistant. Un schéma refusé laisse la pastille
  affichée sans lien — l'information ne disparaît pas ;
- **un chemin enraciné est résolu contre l'adresse de votre instance**, et
  seulement s'il y reste. C'est la forme du relais, et le point délicat est la
  base : ni la page, ni son `baseURI`, mais l'adresse que Home Assistant
  publie de lui-même. La différence est invisible chez vous, où les deux
  coïncident, et décisive sur le tableau de bord **Cast**, servi depuis une
  origine tierce : résolu contre la page, le lien y pointerait vers ce tiers
  — mort, **et** lui livrant la signature dans l'adresse demandée. Un
  « nouvel onglet sans référent » n'y changerait rien, puisque le jeton n'est
  pas dans le référent mais dans l'adresse. Si l'instance ne publie pas son
  adresse, la pastille reste muette : deviner une base, c'est précisément
  envoyer le jeton ailleurs ;
- **la vérification porte sur l'origine après analyse, jamais sur le début de
  la chaîne.** Mesuré, et c'est ce qui a décidé de la forme du filtre : une
  valeur qui commence par une barre oblique suivie d'une barre oblique
  *inverse* satisfait « commence par une seule barre oblique », et l'analyseur
  d'URL la normalise pourtant en nom d'hôte — elle sort donc de votre
  instance en ayant l'air d'y rester ;
- **la carte ne vérifie pas que le chemin mène bien au relais**, et c'est
  assumé. Exiger le début du chemin ne serait pas une garantie de sécurité —
  c'est l'égalité d'origine qui en est une — et ça inscrirait dans la carte un
  chemin dont l'intégration est propriétaire : le jour où elle le renommerait,
  toutes les pastilles redeviendraient muettes **sans un mot**. Sans ce
  contrôle, la même panne donne une page introuvable, visible et
  diagnosticable. Une régression bruyante vaut mieux qu'une silencieuse ;
- **une adresse de pièce jointe ouvre le document sans demander
  d'identifiant.** Elle se traite comme l'URL iCal : sa place n'est ni dans le
  dépôt, ni dans cette documentation, ni dans une capture d'écran. Les quatre
  adresses mesurées sont publiques et ne portent aucune autorisation, mais
  c'est une propriété de ces quatre-là et pas une garantie de la clé ;
- **le lien s'ouvre dans un nouvel onglet, sans référent.** Quand le document
  est sur un serveur tiers, `rel="noreferrer"` évite de lui annoncer
  l'adresse de votre Home Assistant. Pour une pièce relayée, la précaution ne
  sert à rien — l'origine est la vôtre — et elle ne coûte rien : la carte ne
  distingue pas les deux cas, et un attribut appliqué partout est un attribut
  qu'on ne peut pas oublier au mauvais endroit.

Un détail de forme, pour finir : quand une adresse arrive sans nom, la
pastille écrit « Ouvrir la pièce jointe » plutôt que le dernier segment du
chemin. Le chemin d'une pièce PRONOTE ne porte pas de nom de fichier, et ce
segment serait le même mot sous chaque devoir.

Une dernière chose, parce que cette section a décrit **trois** limites qui
n'en étaient pas, et que l'ordre des erreurs vaut d'être connu — elles ont la
même forme, et c'est ça qui est utile.

1. Elle a d'abord affirmé qu'ouvrir une pièce « demanderait un appel de
   service, interdit au rendu ». Faux : un lien n'appelle aucun service. La
   limite était écrite parce qu'elle **arrangeait** — elle dispensait
   d'ouvrir le sujet.
2. Elle a ensuite affirmé que la carte ne pourrait « pas encore » ouvrir de
   document, ce qui laissait attendre un jour indéfini.
3. Elle a enfin affirmé que ce jour **n'existerait jamais pour les fichiers**.
   C'était la plus solide des trois : elle reposait sur une propriété vérifiée
   dans la source de la bibliothèque, pas sur une supposition. Et c'est celle
   qui a tenu le moins longtemps, parce que l'intégration a changé le monde
   dont la propriété parlait : elle s'est mise à relayer les octets.

Les trois fois, l'erreur était de décrire une limite sans en situer
l'**origine**. La troisième est la plus instructive parce qu'elle montre que
l'exactitude ne suffit pas : un fait vrai d'un composant, publié comme une
propriété du produit, devient faux dès qu'une autre couche s'en mêle. Avant
d'écrire « jamais », demandez-vous de qui vous parlez.

`docs/limites.md` porte déjà deux leçons de ce genre.

## La case à cocher

Elle n'apparaît que si `todo:homework` est résolue **et** annonce la
capacité d'écriture dans son attribut `supported_features`. La capacité est
lue, jamais supposée.

**Sur un compte parent, il n'y a jamais de case**, même avec l'écriture
activée dans l'intégration. PRONOTE accepte la coche venue d'une session
parent sans rien enregistrer. Depuis la version 0.1.6 de l'intégration, la
liste de devoirs d'un compte parent n'annonce donc plus la capacité
d'écriture, et la carte n'affiche pas de case. Ce n'est pas un défaut : la
case ne s'afficherait que pour revenir en arrière à chaque clic.

Cocher appelle `todo.update_item`, l'un des quatre appels de service que
ces cartes peuvent émettre. Si l'appel échoue, la case revient à son état
précédent : elle ne doit pas mentir sur ce que le serveur sait. C'est aussi
le cas quand l'intégration relit la coche et constate que PRONOTE ne l'a
pas appliquée.

## L'énoncé

PRONOTE écrit les énoncés en HTML. L'intégration publie une variante en
texte simple (`description_text`), et c'est elle qui est affichée. Sur une
intégration plus ancienne, la carte dévêt le HTML elle-même — sans jamais
l'injecter.

Cette section dit d'où vient le texte ; sa **longueur**, et ce qu'elle fait à
la hauteur de la carte, sont traitées dans
[L'énoncé long](#lenonce-long-et-la-hauteur-de-la-carte).

## Si la carte est vide

Trois phrases, selon le filtre : « rien à faire », « rien à rendre
demain », « aucun devoir ». C'est le vide qui appartient à la carte : elle
seule sait qu'une liste de zéro devoir pour demain se dit ainsi, et non
« donnée indisponible ».
