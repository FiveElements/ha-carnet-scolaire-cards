# Agenda de l'établissement

Les évènements de l'onglet Agenda de PRONOTE : arrêt des notes, conseils de
classe, réunions, vacances et jours fériés.

!!! note "Il faut une version récente de l'intégration"
    La carte lit le capteur « Prochain évènement », qu'ajoute le palier
    `agenda` de l'intégration Carnet scolaire. Avec une version qui ne le
    publie pas encore, la carte affiche « Entité introuvable ».

## Configuration

Un seul réglage obligatoire : l'appareil de l'enfant.

```yaml
type: custom:carnet-scolaire-agenda
device_id: <appareil de l'enfant>
```

## Options

| Option | Défaut | Effet |
| --- | --- | --- |
| `limit` | `6` | Nombre d'évènements affichés, le plus proche en tête. |
| `show_holidays` | `true` | Affiche les vacances et les jours fériés. À `false`, la carte n'en garde que les autres évènements. |
| `show_category` | `true` | Affiche sous le titre la famille PRONOTE de l'évènement (« Etablissement »…) et son public, quand PRONOTE les donne. Les vacances et les conseils de classe n'ont pas de famille. |

### Exemple complet

Toutes les options renseignées, copiable tel quel :

```yaml
type: custom:carnet-scolaire-agenda
device_id: <appareil de l'enfant>
limit: 6
show_holidays: true
show_category: true
```

`title` et `entities` fonctionnent en plus sur toutes les cartes : voir
[Deux options communes](../installation.md#deux-options-communes-a-toutes-les-cartes).

## Ce que montre chaque évènement

Une ligne par évènement, dans la forme de l'appli PRONOTE :

- la **date** en petite page de calendrier (le jour et le mois abrégé), la
  date en toutes lettres au survol ;
- le **titre** en gras ;
- la période : « Le 20 novembre », « Le 1 décembre de 17:15 à 18:30 »,
  « Du 19 décembre au 3 janvier » ;
- la famille et le public, si `show_category` n'est pas désactivée, puis le
  lieu quand il est renseigné ;
- un **liseré** à gauche, dans la couleur que PRONOTE donne à la famille de
  l'évènement.

Comme la couleur de matière ailleurs, cette couleur ne sert que de liseré,
jamais de fond : choisie pour un fond blanc, elle casserait le contraste sous
un thème sombre. Seul l'hexadécimal strict est accepté ; une autre valeur
laisse simplement le liseré vide.

## Les vacances

`show_holidays: false` repose sur un indicateur que l'intégration pose sur
chaque évènement, et **pas** sur le nom de la famille : ce nom est un libellé
libre, propre à chaque établissement. Un évènement ne disparaît donc jamais
parce que sa famille s'appelle comme celle des vacances.

Des vacances déjà commencées restent affichées jusqu'à leur dernier jour,
avec leur période complète.

## Quand un évènement est terminé

L'intégration collecte l'agenda une fois par jour. Pour qu'un conseil de
classe fini à 18 h 30 ne reste pas affiché toute la soirée, la carte retire
d'elle-même un évènement dès son heure de fin, et un évènement d'une journée
entière le lendemain de son dernier jour.

## Entités consommées

| Clé | Rôle |
| --- | --- |
| `sensor:next_school_event` | Requise. Son attribut `items` porte tous les évènements à venir, vacances comprises. |

L'état de ce capteur est le début du prochain évènement **hors vacances**.
Quand il ne reste que des vacances à venir, il vaut `unknown` alors que la
liste n'est pas vide : la carte affiche quand même la liste, et ne dit
« pas encore collectée » que si aucune collecte n'a eu lieu.

L'intégration publie aussi un calendrier, « Agenda de l'établissement », que
la carte n'utilise pas : la carte Calendrier de Home Assistant sait déjà
l'afficher. L'entité évènement « Nouvel évènement à l'agenda » (type
`school_event_added`) sert aux automatisations, par exemple pour être
prévenu d'un nouveau conseil de classe.

## Si la carte est vide

« Aucun évènement à venir » : l'établissement n'a rien publié pour la suite
de l'année. Avec `show_holidays: false`, la phrase devient « Aucun évènement
à venir en dehors des vacances » : il reste des vacances, que l'option masque.
