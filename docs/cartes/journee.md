# Vue journée

La journée d'aujourd'hui en grille : la date et les bornes de la journée de
classe en en-tête, puis un filet de couleur par matière, une colonne
d'horaires, l'intitulé, la salle, le professeur, et les créneaux sans cours
du midi.

C'est un portage d'apparence d'une carte de l'ancien format. Elle
ouvre sur **aujourd'hui**, et deux flèches parcourent les autres jours de la
semaine déjà collectée. Pour voir la semaine d'un seul tenant, voyez
[Emploi du temps](emploi-du-temps.md).

![Aperçu de la carte Vue journée](../assets/cartes/journee.svg)

*Illustration synthétique : rien n'y vient d'un élève réel. Les dates, les
horaires et les valeurs sont inventés ; les matières sont des matières de
programme.*

## Configuration

```yaml
type: custom:carnet-scolaire-journee
device_id: <appareil de l'enfant>
show_meal: true
show_rooms: true
show_teachers: true
show_nav: true
```

## Options

| Option | Défaut | Effet |
| --- | --- | --- |
| `show_meal` | `true` | Affiche la zone repas dans le creux du midi. |
| `meal_label` | « Repas » | Le mot affiché sur cette zone. |
| `meal_from` | `11:00` | Début de la plage du midi, en `HH:MM`. |
| `meal_to` | `14:30` | Fin de la plage du midi, en `HH:MM`. |
| `show_rooms` | `true` | Affiche la salle sous la matière, sous la forme « Salle 2.14 ». |
| `show_teachers` | `true` | Affiche le ou les professeurs. |
| `show_current` | `true` | Met en avant le cours en cours. |
| `show_header` | `true` | Affiche la date et les bornes de la journée. |
| `show_nav` | `true` | Affiche les flèches de navigation d'un jour à l'autre. |
| `auto_advance` | `false` | Passe au prochain jour de cours quand la journée est finie. |
| `auto_advance_after` | `30` | Délai après le dernier cours, en minutes, avant ce saut. |
| `day_offset` | `0` | Le jour de cette carte, en jours : `1` demain, `-1` la veille. Voir [Plusieurs jours côte à côte](#plusieurs-jours-cote-a-cote). |
| `subject_colors` | — | Table matière → couleur. **En YAML uniquement**, voir ci-dessous. |

Une plage du midi illisible (`meal_from: midi`) est **ignorée** : la plage
par défaut reprend, plutôt que de faire disparaître la zone repas sur une
faute de frappe.

**Les sept bascules, les trois champs de texte et le champ numérique
figurent dans l'éditeur graphique** de la carte : aucun YAML n'est nécessaire
pour les régler. Seule la table de couleurs demande le mode YAML, pour la
raison expliquée plus bas.

## Passer au prochain jour de cours tout seul

À 18 h, la journée affichée est finie et la carte montre encore des cours qui
ont eu lieu. `auto_advance` la fait passer au **prochain jour de cours** une
fois le dernier cours terminé, plus le délai de `auto_advance_after`.

```yaml
type: custom:carnet-scolaire-journee
device_id: <appareil de l'enfant>
auto_advance: true
auto_advance_after: 30
```

Avec ces valeurs, une journée qui finit à 16 h 30 laisse la carte sur
aujourd'hui jusqu'à 17 h, puis affiche le jour de cours suivant. Le délai
existe parce qu'à la sonnerie l'élève est encore dans l'établissement, et que
le parent qui regarde la carte à ce moment-là cherche justement l'heure de
sortie. `auto_advance_after: 0` saute à la sonnerie ; c'est une valeur
acceptée, pas un réglage manquant.

**La carte avance seule, sans qu'on touche à rien.** Un tableau de bord laissé
ouvert sur le mur de la cuisine bascule tout seul dans la minute qui suit
l'échéance. Aucune requête n'est envoyée à PRONOTE pour cela : le prochain jour
de cours est déjà en mémoire du navigateur, dans la semaine collectée.

**Les flèches continuent de fonctionner**, et elles comptent à partir du jour
affiché. Depuis le jour avancé, la flèche gauche ramène à aujourd'hui. Le
bouton de retour, lui, ne dit plus « Aujourd'hui » mais « Prochain jour de
cours » — il ramène là où la carte se repose, et « Aujourd'hui » au-dessus d'un
bouton qui mène à demain serait faux.

### Trois choses à savoir avant de l'activer

**L'option est inactive par défaut, et le restera.** Une carte qui montre
demain là où elle montrait aujourd'hui change ce qu'elle affirme. Ça ne
s'impose pas par une mise à jour.

**Un jour sans cours est traversé.** Le déclencheur est la fin du dernier
cours ; un mercredi libre n'en a pas, donc il n'y a rien à attendre et la carte
affiche directement le jour suivant. Conséquence : au repos, vous ne verrez
plus « aucun cours ce jour-là ». C'est une information vraie et parfois celle
qu'on venait chercher — les flèches y mènent toujours.

**Elle ne fait rien sans la semaine collectée.** Si le palier hebdomadaire est
désactivé dans les options de l'intégration, `sensor:timetable_week` n'existe
pas, la carte n'a aucun autre jour en mémoire et l'option reste sans effet —
exactement comme les flèches. Et même avec la semaine, la carte **ne saute
jamais au-delà du dernier jour collecté** : un vendredi soir, il n'y a pas de
lundi en mémoire, donc elle reste sur le vendredi. Sauter quand même
afficherait « aucun cours ce jour-là » pour une date dont la carte ne sait
rien, et c'est la seule affirmation fausse qu'elle pourrait produire.

## La navigation d'un jour à l'autre

```
‹  mercredi 9 septembre  ›                    08:00 – 14:30
```

Les flèches ne coûtent **aucune requête**, et c'est la seule raison pour
laquelle elles existent ici. PRONOTE facture son emploi du temps à la
**semaine** : demander « aujourd'hui » coûte exactement le même appel que
demander la semaine entière, et l'intégration a replié son palier hebdomadaire
dans le palier emploi du temps pour cette raison. Toute la semaine courante est
donc déjà dans un attribut, en mémoire de votre navigateur — changer de jour
n'est qu'un filtre sur une liste.

Une flèche ne déclenche donc jamais de collecte, et ne peut pas en déclencher :
une carte de ce dépôt n'a que deux appels de service à sa disposition et
celle-ci n'en utilise aucun. Votre budget de requêtes ne bouge pas, quel que
soit le nombre d'aller-retours.

### Ce que les flèches atteignent, et ce qu'elles n'atteignent pas

Elles s'arrêtent aux bornes de la **semaine collectée**, et ces bornes viennent
des données, non d'un calcul de calendrier. La différence compte un jour sur
sept : le lundi, la veille appartient à la semaine précédente, que personne n'a
collectée. La flèche est alors éteinte plutôt que de vous montrer un dimanche
dont la carte ne sait rien.

À l'intérieur de la fenêtre, en revanche, un jour **sans cours** reste
atteignable — et il le doit : « aucun cours mercredi » est l'information qu'on
venait souvent chercher. Le message n'est alors pas le même que pour
aujourd'hui, parce qu'« aucun cours aujourd'hui » posé au-dessus d'un mercredi
qu'on n'est pas serait tout simplement faux.

Au bord de la fenêtre, la flèche **saute au jour collecté le plus proche**
plutôt que d'avancer d'un jour civil dans le vide. Sans ce rattrapage, un
dimanche placé devant une semaine qui commence le mardi serait un cul-de-sac :
flèche éteinte alors que quatre jours sont en mémoire. Un lundi férié produit
exactement cette situation.

### Le bouton de retour n'apparaît que si vous êtes parti

Un bouton « Aujourd'hui » se pose à côté des flèches **seulement** quand le
jour affiché n'est pas le jour courant. C'est pour cela que l'aperçu en tête
de page montre les deux flèches sans ce bouton : il illustre aujourd'hui, et
un bouton qui ramène là où l'on est déjà n'apprendrait rien.

### Sans le palier hebdomadaire, pas de flèches

Si `sensor:timetable_week` n'existe pas chez vous — le palier peut être
désactivé — la carte est exactement ce qu'elle était : aujourd'hui, sans
flèches. Rien à configurer, rien à retirer.

### Le jour consulté n'est pas une option, le jour de la carte en est une

**Où vous avez navigué** n'est pas une option et ne le sera pas : c'est un état
d'affichage, il vit dans l'onglet comme une position de défilement, et un
rechargement de page ramène au jour de la carte. Le bouton de retour apparaît
dès qu'on n'y est plus.

**De quel jour la carte parle**, en revanche, est bien une option :
[`day_offset`](#plusieurs-jours-cote-a-cote).

Cette page affirmait le contraire, et son argument était à moitié faux — il
disait qu'une option de jour afficherait « l'avant-veille le lendemain ». C'est
vrai d'une **date** écrite en dur ; c'est faux d'un **décalage**, qui est
recalculé à chaque affichage et désigne donc toujours la veille. La correction
a été faite le 10 septembre 2026, quand le décalage a été demandé pour un
usage que le curseur ne peut pas servir : plusieurs cartes visibles en même
temps.

La distinction est celle-là, et c'est elle qui décide ce qui va dans le YAML :
une position de consultation est personnelle et momentanée ; le jour d'une
carte est une propriété de cette carte, et il ne se périme jamais.

## Plusieurs jours côte à côte

`day_offset` décale le jour d'une carte. `0` — le défaut — affiche
aujourd'hui, `1` demain, `2` le surlendemain, `-1` la veille. Trois cartes sur
la même vue font une fenêtre glissante :

```yaml
type: vertical-stack
cards:
  - type: custom:carnet-scolaire-journee
    device_id: VOTRE_ENFANT
    day_offset: 0
  - type: custom:carnet-scolaire-journee
    device_id: VOTRE_ENFANT
    day_offset: 1
  - type: custom:carnet-scolaire-journee
    device_id: VOTRE_ENFANT
    day_offset: 2
```

Chaque carte est indépendante : ses flèches partent de **son** jour, et son
bouton de retour y ramène. Naviguer dans l'une ne déplace pas les autres.

![Trois cartes Vue journée côte à côte : jeudi 12 mars et vendredi 13, puis samedi 14 qui n'est pas dans la semaine collectée](../assets/cartes/journee-fenetre-glissante.svg)

*Illustration synthétique : rien n'y vient d'un élève réel. Les dates, les
horaires, les salles et les professeurs sont inventés ; les matières sont des
matières de programme.*

Trois choses s'y lisent, et aucune n'est un choix de dessin :

- **le rangement en colonnes vient de la vue, pas des cartes.** Le
  `vertical-stack` ci-dessus les empile ; une vue `sections` à `max_columns: 3`
  les met côte à côte, et retombe en pile sur un téléphone — voir
  [Assembler un tableau de bord](../tableaux-de-bord.md#une-fenetre-glissante-sur-la-semaine) ;
- **la flèche « suivant » du vendredi est éteinte**, parce que c'est le dernier
  jour collecté et qu'il n'y a rien au-delà à atteindre ;
- **le samedi porte sa date, mais pas de bornes.** Sans le moindre créneau, il
  n'y a pas de journée de classe dont donner le début et la fin : il ne reste
  que la phrase, et la date au-dessus d'elle qui dit de quel jour on n'a rien.

!!! tip "Coupez l'en-tête ou les flèches si la pile est chargée"

    Trois en-têtes et six flèches sur une même vue font beaucoup. `show_nav:
    false` garde les dates et retire les flèches ; la date, elle, reste
    affichée dès que le jour n'est pas aujourd'hui, même avec `show_header:
    false` — des créneaux de demain sans date au-dessus se lisent comme ceux
    d'aujourd'hui.

### Le décalage part du jour de repos

Sans `auto_advance`, le jour de repos est aujourd'hui : `1` est donc bien
demain, et il n'y a rien de plus à savoir.

Avec `auto_advance`, le jour de repos avance au prochain jour de cours une fois
la journée finie — et la fenêtre glisse **avec** lui. Le mercredi à 22 h, vos
trois cartes montrent jeudi, vendredi et samedi.

C'est ce que ce choix d'origine achète. Si le décalage partait d'aujourd'hui,
la carte à `0` suivrait le saut et les deux autres non : **jeudi, jeudi,
vendredi** — un jour en double, et un de perdu.

Le décalage est un décalage de **calendrier**, pas un saut de jour de cours :
il ne traverse pas les jours vides. Le samedi de l'exemple tombe donc hors de
la semaine collectée, et la troisième carte le dit — voir juste en dessous.

### Un jour hors de la semaine collectée le dit

Tout jour autre qu'aujourd'hui se lit dans `sensor:timetable_week`. Un décalage
qui pointe au-delà — ou sans ce capteur du tout — affiche **« ce jour n'est
pas dans la semaine collectée »**, et pas « aucun cours ce jour-là ».

La différence n'est pas de la précision de langage. « Aucun cours » est une
**affirmation** sur une journée ; la carte n'a pas le droit de la faire sur une
date dont elle ne sait rien. C'est la seule affirmation fausse que cette carte
puisse produire, et une option qui désigne un jour à la main est le chemin le
plus court pour l'atteindre. L'en-tête reste affiché dans ce cas : il porte la
date demandée, donc la phrase dit de quel jour on n'a rien.

En pratique, la semaine collectée couvre la semaine en cours. Un `day_offset:
5` un jeudi tombera donc souvent hors fenêtre, et un `-1` un lundi aussi.

## La salle et le professeur

Ils s'affichent sur une **deuxième ligne**, sous la matière, séparés d'un
point médian : « Salle 2.14 · MARTIN P. ».

**La salle est précédée de son mot**, et ce n'est pas décoratif : un nombre
seul ne dit pas ce qu'il est. Sur une ligne où il voisine avec des horaires et
un nom de professeur, « 2.14 » se lit aussi bien comme une note — et la carte
notes, elle, écrit vraiment des nombres à cet endroit. Le mot est traduit
(« Aula », « Sala »), il ne vient pas du code.

Si votre établissement écrit déjà le mot dans le champ — « SALLE 204 »,
« Salle polyvalente » — il n'est **pas ajouté une seconde fois**. La
comparaison ignore la casse et les accents.

Cette deuxième ligne n'est pas cosmétique. Un nom de professeur fait
facilement trente caractères ; mis à la suite de la matière, il repoussait
les pastilles d'annulation hors du champ visible dès que la carte partageait
sa largeur avec une autre. Le point médian ne s'affiche que si les deux
éléments sont présents.

Chacun se coupe indépendamment (`show_rooms`, `show_teachers`). Les deux
coupés, la deuxième ligne disparaît entièrement plutôt que de laisser un
espace vide.

## L'en-tête : la date et les bornes de la journée

```
mercredi 9 septembre                    08:00 – 14:30
```

Les bornes viennent des attributs que l'intégration publie
(`first_start`, `last_end`) : la carte ne les recalcule pas. Deux précisions
qui viennent de la source de l'intégration :

- **elles comptent les cours annulés.** Un premier cours annulé fixe donc
  quand même le début de la journée — ce qui est le bon sens de « journée de
  classe » : l'élève est attendu à cette heure-là tant qu'on ne lui a pas dit
  le contraire.
- **la fin peut être une heure déduite**, parce qu'elle est la plus tardive
  des fins de cours et qu'une fin de cours peut l'être. L'attribut, lui, ne le
  dit pas : la carte va chercher le drapeau sur le créneau qui porte cette
  fin, et le dit en infobulle sur les bornes — sans marqueur visible, voir
  [L'heure de fin déduite](#lheure-de-fin-deduite).

Sur une **journée vide**, l'en-tête reste et porte la date. C'est le moment où
il sert le plus : « aucun cours » tout seul laisse le doute sur le jour dont
on parle.

Si votre version de l'intégration ne publie pas ces attributs, la date
s'affiche et les bornes disparaissent — rien n'est inventé.

## Les couleurs de matière

Le filet vertical **entre l'heure et la matière** prend la couleur de cette
matière. Depuis la version 0.0.13 de l'intégration, elle vient du serveur :
vous n'avez **rien à écrire**. Mesuré sur une instance, les trois créneaux du
jour et les 27 de la semaine arrivent tous colorés.

Une table `subject_colors` reste utile pour deux choses seulement : colorer une
matière que votre établissement ne colore pas, et remplacer une teinte qui vous
déplaît. Les couleurs de PRONOTE sont choisies pour le fond blanc de son
interface, donc certaines sont vives — c'est aussi pourquoi la carte ne s'en
sert que comme filet, jamais comme fond.

Un créneau dont la matière n'a pas de couleur garde un filet **gris**. Ce n'est
pas un défaut de collecte : c'est la carte qui dit « cette matière n'a pas de
couleur » plutôt que de laisser un vide qu'on lirait comme un défaut
d'affichage.

```yaml
type: custom:carnet-scolaire-journee
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

## La zone repas

Elle apparaît sur un **creux sans cours** qui recouvre la plage du midi et
dure au moins une demi-heure. Un interclasse de dix minutes n'en déclenche
pas.

Ce qu'elle dit : **il n'y a pas cours ici.** Rien de plus. Ni qu'un menu est
servi, ni que votre enfant mange au réfectoire — la carte ne lit aucune
entité de cantine. Le mot « Repas » est une convention que vous assumez,
c'est pourquoi il est modifiable.

Pour le menu du jour, voyez la carte [Cantine](menu.md), qui lit les
entités faites pour ça.

### Exemple complet

Toutes les options renseignées, `subject_colors` compris — c'est la seule
option de la bibliothèque qui ne s'écrit qu'en YAML :

```yaml
type: custom:carnet-scolaire-journee
device_id: <appareil de l'enfant>
show_header: true
show_nav: true
show_current: true
show_rooms: true
show_teachers: true
show_meal: true
meal_label: Cantine
meal_from: "11:00"
meal_to: "14:30"
subject_colors:
  mathematiques: "#2e90fa"
  francais: "#12b76a"
  anglais: "#7a5af8"
```

**Les deux heures se citent entre guillemets.** Dans un tableau de bord en
mode YAML, `11:00` sans guillemets est lu comme un nombre — 660 — et la carte
n'accepte qu'une chaîne `HH:MM` : elle écarte alors la valeur et **retombe
silencieusement sur la fenêtre par défaut**, 11:00 → 14:30. Aucun message ne
le signale. Les guillemets sont inutiles depuis l'éditeur de Home Assistant,
et sans inconvénient dans les deux cas.

`title` et `entities` fonctionnent en plus sur toutes les cartes : voir
[Deux options communes](../installation.md#deux-options-communes-a-toutes-les-cartes).

## Entités consommées

| Clé | Rôle |
| --- | --- |
| `sensor:lessons_today` | Requise. Son attribut `lessons` porte toute la journée. |
| `sensor:timetable_week` | Optionnelle. La semaine collectée : c'est elle qui rend les flèches possibles. |
| `binary_sensor:in_class` | Optionnelle. **Droit de veto** sur la mise en avant. |

Les créneaux du capteur de semaine sortent de la **même** liste dédoublonnée
que ceux d'aujourd'hui, en amont côté intégration : les deux capteurs ne
peuvent pas se contredire sur un même jour. C'est pourquoi aujourd'hui se lit
toujours sur son propre capteur, avec ses bornes publiées, et les autres jours
sur la fenêtre.

Le capteur de cours en cours dit **si** un cours a lieu ; les horodatages
disent **lequel**. À `off`, aucun créneau n'est mis en avant même si
l'horloge le suggère : le capteur voit ce que l'attribut ne porte pas — jour
banalisé, cours déplacé après la collecte, élève dispensé.

## L'heure de fin déduite

PRONOTE n'envoie pas toujours l'heure de **fin** d'un cours. L'intégration la
calcule alors depuis la grille horaire de l'établissement, et ce calcul peut
se tromper. Cette carte le dit en **infobulle**, en survolant l'heure : elle
n'affiche aucun marqueur visible.

!!! note "Le « ≈ » a été retiré de cette carte"

    Elle marquait la fin déduite d'un `≈` devant l'heure, comme le fait
    encore la carte [prochain cours](prochain-cours.md). Ce marqueur a été
    retiré le 10 septembre 2026, pour la raison même qui l'avait fait poser :
    beaucoup d'établissements ne publient **aucune** heure de fin, et sur
    celui où ces cartes sont validées les 37 créneaux d'une semaine étaient
    tous déduits. Le signe était donc sur chaque ligne de chaque journée — et
    un marqueur que tout porte n'avertit plus de rien.

    La différence avec la carte prochain cours est ce qui explique qu'elle le
    garde : elle n'affiche **qu'une** heure de fin. Un signe rare y reste un
    signe ; répété trente-sept fois il devient une décoration.

L'information n'est pas perdue : l'infobulle n'a jamais dépendu du glyphe, et
c'est elle qu'il faut lire pour savoir si une heure est donnée ou calculée.
La **zone repas** a la sienne, sur son libellé : le creux commence à la fin du
cours précédent, donc quand cette fin est déduite, la position du repas l'est
aussi.

Sur les jours **autres** qu'aujourd'hui, les bornes de l'en-tête sont
calculées par la carte, faute que l'intégration les publie pour ces jours-là.
Elle reprend la formule à l'identique — la première heure de début, la dernière
heure de fin, cours annulés compris — pour que l'en-tête veuille dire la même
chose d'un jour à l'autre. L'infobulle des bornes y suit le même drapeau.

## Si la carte est vide

« Aucun cours aujourd'hui » : week-end, jour férié, vacances. C'est un état
normal, distinct de « pas encore collectée ». Un cours **annulé** reste
visible, barré et marqué : le retirer donnerait l'illusion qu'il n'a jamais
existé. Un cours dont l'élève est **dispensé** porte la pastille
« dispensé » et n'est jamais surligné comme cours en cours.

Sur un autre jour, le message devient « Aucun cours ce jour-là » — la même
information, sans l'affirmation fausse. L'en-tête reste et porte la date : c'est
le moment où il sert le plus, « aucun cours » tout seul laissant le doute sur le
jour dont on parle.
