# Notes

Moyenne générale, dernières notes, moyennes par matière et bulletin.

![Aperçu de la carte Notes](../assets/cartes/notes.svg)

*Illustration synthétique : rien n'y vient d'un élève réel. Les dates, les
horaires et les valeurs sont inventés ; les matières sont des matières de
programme.*

## Configuration

```yaml
type: custom:carnet-scolaire-notes
device_id: <appareil de l'enfant>
sections:
  - average
  - latest
  - subjects
```

## Options

| Option | Défaut | Effet |
| --- | --- | --- |
| `sections` | `average`, `latest`, `subjects` | Blocs affichés, dans cet ordre : `average` (moyenne de l'élève et de la classe), `latest` (dernières notes), `subjects` (moyennes par matière), `report_card` (bulletin). |
| `limit` | `8` | Nombre de dernières notes affichées. |
| `show_date` | désactivée | Ajoute la date de chaque note aux dernières notes, après le coefficient. |
| `subjects` | toutes | Matières montrées dans les dernières notes, les moyennes par matière et le bulletin. Voir plus bas. |
| `subject_colors` | — | Table matière → couleur. **En YAML uniquement**, voir plus bas. |

`report_card` n'est **pas** dans les valeurs par défaut : le bulletin
n'existe qu'en fin de période, et une section vide la plupart de l'année
n'aide personne.

### Exemple complet

Toutes les options renseignées, les quatre sections comprises :

```yaml
type: custom:carnet-scolaire-notes
device_id: <appareil de l'enfant>
sections:
  - average
  - latest
  - subjects
  - report_card
limit: 10
show_date: true
subjects:
  - Mathématiques
  - Anglais
```

L'ordre des sections dans le YAML ne change pas l'ordre d'affichage : la
carte les rend toujours dans le même ordre, `sections` ne fait que choisir
lesquelles paraissent. Une seule exception : quand `latest` et `subjects`
sont affichées ensemble, les notes se rangent sous la moyenne de leur
matière (voir [Ranger les notes par matière](#ranger-les-notes-par-matiere)).

`title` et `entities` fonctionnent en plus sur toutes les cartes : voir
[Deux options communes](../installation.md#deux-options-communes-a-toutes-les-cartes).

## Ce que montre chaque note

Une ligne par note, la note à droite. Dessous :

- l'**intitulé** que le professeur a donné au devoir — « Contrôle n° 1
  (chapitre 1) », « Interrogation 2 » — sur sa propre ligne, quand il en a
  donné un ;
- puis le coefficient, la date si `show_date` est activée, la **moyenne de
  la classe** à ce devoir, et la note la plus basse et la plus haute de la
  classe (« min. 5 · max. 20 ») ;
- enfin les **documents** du devoir, quand le professeur en a déposé : une
  pastille « Sujet », une pastille « Corrigé ». Le nom du fichier s'affiche
  au survol.

Un document s'ouvre comme une pièce jointe de devoir : l'adresse du
fichier n'est demandée à l'intégration qu'au moment du clic, par
`carnet_scolaire.get_attachment_url`, et n'est jamais publiée dans un
attribut. Ces pastilles n'apparaissent qu'avec une version de
l'intégration qui publie `attachment_refs` sur les notes. Avant, la ligne
s'affiche simplement sans elles.

## Ranger les notes par matière

Quand `latest` et `subjects` sont affichées ensemble, avec ou sans filtre,
la carte range les notes par matière. La moyenne de chaque matière devient
un **en-tête** : nom et moyenne de l'élève en plus grand, moyenne de la
classe dessous. Les notes de cette matière se rangent sous cet en-tête,
les plus récentes d'abord, puis vient la matière suivante. Chaque note y
est nommée par la **date** du devoir, en petite page de calendrier, plutôt
que par sa matière, que l'en-tête dit déjà, et ce même sans `show_date`.
Une note dont la matière n'a pas encore de moyenne publiée suit les
groupes, sans en-tête, et garde sa matière.

`limit` compte toujours les dernières notes de toute la carte, pas celles
de chaque matière : une matière sans note récente garde son en-tête, seul.

## Filtrer les matières

`subjects` limite la carte aux matières listées. Le nom s'écrit comme
PRONOTE l'affiche, mais la casse, les accents et les espaces en bord ne
comptent pas : `mathematiques` retrouve `MATHÉMATIQUES`. C'est la même
comparaison que pour `subject_colors`.

Le filtre s'applique aux dernières notes, aux moyennes par matière et au
bulletin. Il ne touche **pas** la moyenne générale ni celle de la classe :
elles portent sur toutes les matières. Une carte filtrée sur une seule
matière affiche donc encore la moyenne générale.

Une carte filtrée range ses notes par matière comme les autres (voir
[Ranger les notes par matière](#ranger-les-notes-par-matiere)).

Une liste vide revient à ne rien filtrer. Si le filtre écarte toutes les
notes, la carte affiche « Aucune note pour les matières choisies » plutôt
que « Aucune note pour cette période » : des notes existent, mais dans
d'autres matières.

## Les couleurs de matière

Chaque moyenne par matière, et chaque note, porte un filet vertical à
gauche, dans la couleur de sa matière.

Depuis la version 0.0.13 de l'intégration, cette couleur vient
**du serveur** : vous n'avez rien à écrire pour la voir. Une table
`subject_colors` ne sert plus qu'à colorer une matière que votre
établissement laisse sans couleur, ou à remplacer une teinte qui vous
déplaît — et le serveur **gagne** sur votre table, donc une entrée qui
double une couleur reçue ne fait plus rien.

Les **notes individuelles** n'ont pas de couleur côté protocole : PRONOTE
colore la matière, pas la note. La carte leur donne donc celle de la
moyenne de la même matière, rapprochée sans casse ni accents, et votre
table en secours. Une note dont la matière n'a pas encore de moyenne
publiée, et que la table ne nomme pas, reste sans accent — ce n'est pas un
défaut de collecte.

```yaml
type: custom:carnet-scolaire-notes
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
| `sensor:overall_average` | Au moins une des trois. Moyenne générale ; son attribut `out_of` porte le barème. |
| `sensor:grades` | Au moins une des trois. `items[]` porte chaque note. |
| `sensor:averages` | Au moins une des trois. `items[]` porte les moyennes par matière. |
| `sensor:class_average` | Optionnelle. Moyenne de la classe. |
| `sensor:latest_grade` | Optionnelle, et lue seulement pour son **motif** (voir ci-dessous). |
| `sensor:current_period` | Optionnelle. Ligne transverse, hors des sections. |
| `sensor:report_card` | Optionnelle. `subjects[]` et l'appréciation générale. |

La carte s'affiche dès qu'**une** des trois premières est résolue. C'est ce
qui permet à un parent dont l'intégration ne publie qu'un palier d'obtenir
quelque chose d'utile.

## Les notes sans valeur numérique

PRONOTE emploie des sentinelles — « Absent », « Non noté », « Dispensé » —
qui rendent l'état non numérique. Le motif vit alors dans l'attribut
`status`, et c'est lui qui est montré : jamais un vide, jamais un zéro.

## Aucun sélecteur de période

L'intégration crée une entité par période close, toutes avec le même nom
de traduction sur le même appareil. La résolution rend la première
correspondance et rien ne permet de distinguer les autres — un sélecteur
afficherait donc une période qu'il ne maîtrise pas. La période **en cours**
s'affiche en revanche comme une ligne transverse, dès qu'elle est
exploitable.

## Le code couleur des matières

Les **moyennes par matière** portent la couleur que l'établissement associe
à la matière, en bordure gauche — le même code visuel que sur l'emploi du
temps, dont la page explique [comment il fonctionne et pourquoi il n'est pas
encore visible](emploi-du-temps.md#le-code-couleur-des-matieres).

C'est la seule section colorée de cette carte : PRONOTE n'envoie pas de
couleur pour une note individuelle ni pour une matière de bulletin. Les
autres lignes gardent malgré tout le même retrait, pour que la liste des
notes et celle des moyennes — qui se suivent sans intertitre — restent
alignées.

## Si la carte est vide

« Aucune note pour cette période » : c'est le cas normal à la rentrée, et
il est distinct de « pas encore collectée ». Les moyennes par matière ont
leur propre phrase, parce qu'un relevé peut porter des notes sans qu'aucune
moyenne ne soit encore publiée.
