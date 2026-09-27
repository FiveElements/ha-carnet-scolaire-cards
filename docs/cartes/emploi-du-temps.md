# Emploi du temps

Les cours du jour, du lendemain ou de la semaine, le créneau en cours
surligné.

![Aperçu de la carte Emploi du temps](../assets/cartes/emploi-du-temps.svg)

*Illustration synthétique : rien n'y vient d'un élève réel. Les dates, les
horaires et les valeurs sont inventés ; les matières sont des matières de
programme.*

## Configuration

```yaml
type: custom:carnet-scolaire-emploi-du-temps
device_id: <appareil de l'enfant>
range: today
show_rooms: true
```

## Options

| Option | Défaut | Effet |
| --- | --- | --- |
| `range` | `today` | `today`, `tomorrow` ou `week`. Change l'entité lue, pas seulement l'affichage. |
| `show_rooms` | `true` | Affiche la salle sous chaque cours. |
| `show_teachers` | `false` | Affiche le ou les professeurs. |
| `subject_colors` | — | Table matière → couleur. **En YAML uniquement**, voir plus bas. |

En mode `week`, un intertitre marque chaque jour. La hauteur annoncée à
Home Assistant suit le mode : une poignée de lignes en mode journée, trois
fois plus en mode semaine — sans quoi la répartition en colonnes se ferait
de travers.

### Exemple complet

Toutes les options renseignées, copiable tel quel :

```yaml
type: custom:carnet-scolaire-emploi-du-temps
device_id: <appareil de l'enfant>
range: week
show_rooms: true
show_teachers: true
```

`title` et `entities` fonctionnent en plus sur toutes les cartes : voir
[Deux options communes](../installation.md#deux-options-communes-a-toutes-les-cartes).

## Les couleurs de matière

Chaque créneau porte un filet vertical à gauche, dans la couleur de sa
matière.

Depuis la version 0.0.13 de l'intégration, cette couleur vient
**du serveur** : vous n'avez rien à écrire pour la voir. Une table
`subject_colors` ne sert plus qu'à colorer une matière que votre
établissement laisse sans couleur, ou à remplacer une teinte qui vous
déplaît — et le serveur **gagne** sur votre table, donc une entrée qui
double une couleur reçue ne fait plus rien.

```yaml
type: custom:carnet-scolaire-emploi-du-temps
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
| `sensor:lessons_today` | Requise en mode `today`. |
| `sensor:timetable_tomorrow` | Requise en mode `tomorrow`. |
| `sensor:timetable_week` | Requise en mode `week`. |
| `binary_sensor:in_class` | Optionnelle. **Droit de veto** sur le surlignage (voir ci-dessous). |
| `binary_sensor:test_today` | Optionnelle. Pastille de tête, en mode `today` uniquement. |
| `binary_sensor:outing_today` | Optionnelle. Idem. |

Chaque cours porte ses propres attributs `test` et `outing` : ce sont eux
qui situent l'information au bon créneau dans tous les modes. Les deux
pastilles de tête ne sont qu'un résumé du **jour**, et un résumé faux vaut
moins que pas de résumé — c'est pourquoi elles ne s'affichent pas en mode
`tomorrow` ni `week`.

## Qui décide du cours « en cours »

Deux sources pourraient répondre, et les faire concourir produirait tôt ou
tard deux réponses contradictoires. Elles ont donc des rôles distincts :

- les **horodatages** des créneaux désignent lequel ;
- `binary_sensor:in_class` a un **droit de veto**, jamais celui de désigner.

À `off`, aucun créneau n'est surligné même si l'horloge le suggère : le
capteur voit ce que l'attribut ne porte pas — jour banalisé, cours déplacé
après la collecte, élève dispensé. À `on` sans créneau correspondant, la
carte ne fabrique rien.

## Le code couleur des matières

PRONOTE laisse l'établissement choisir une couleur par matière, et l'élève
la connaît déjà de l'interface officielle. Les cartes la reprennent : une
**bordure colorée** à gauche de la ligne, de la couleur de la matière.

C'est la seule couleur que ces cartes n'inventent pas. Trois précisions,
parce qu'elle se comporte différemment de tout le reste.

**Une bordure, jamais un fond.** Les couleurs PRONOTE sont choisies pour le
fond blanc de son interface. Posées en aplat derrière du texte, elles
cassent le contraste dès qu'un thème sombre est actif, et le thème n'y peut
alors plus rien. En bordure, le pire cas est un accent peu visible : on perd
un rappel, jamais la lisibilité de la ligne.

**Rien à configurer, et rien à faire si votre établissement n'en met pas.**
Les lignes sans couleur gardent le même retrait que les autres — la
gouttière est réservée, simplement transparente. Une matière sans couleur ne
décale donc pas son voisinage.

**Trois entités portent la couleur du serveur** : les créneaux d'emploi du
temps, les [devoirs](devoirs.md) et les moyennes par matière de la carte
[notes](notes.md) — mesuré sur une instance, 27 créneaux et 12 devoirs sur
27 et 12. Les notes individuelles, les évaluations et le bulletin n'en
portent pas côté PRONOTE.

!!! info "Deux cartes attendent encore l'intégration"

    Le [prochain cours](prochain-cours.md) et les
    [évaluations](evaluations.md) ne reçoivent **pas** la couleur du
    serveur : l'entité du prochain cours compose ses attributs un à un, et
    la couleur n'y a pas encore été ajoutée. Sur ces deux cartes-là, une
    table `subject_colors` reste le seul moyen d'obtenir un accent, et elle
    y garde tout son sens.

## Si la carte est vide

« Aucun cours » : week-end, jour férié, vacances. Ce n'est pas une panne
de collecte. Un cours **annulé** reste visible, barré : le retirer
donnerait l'illusion qu'il n'a jamais existé. Un cours dont l'élève est
**dispensé** reste visible lui aussi, avec la pastille « dispensé », et
n'est jamais marqué « en cours ».
