# Cantine

Le menu du jour ou du lendemain, service par service.

![Aperçu de la carte Cantine](../assets/cartes/menu.svg)

*Illustration synthétique : rien n'y vient d'un élève réel. Les dates, les
horaires et les valeurs sont inventés ; les plats sont des plats de cantine
ordinaires.*

## Configuration

```yaml
type: custom:carnet-scolaire-menu
device_id: <appareil de l'enfant>
day: today
```

## Options

| Option | Défaut | Effet |
| --- | --- | --- |
| `day` | `today` | `today` ou `tomorrow`. Change l'entité lue. |

### Exemple complet

L'unique option de cette carte :

```yaml
type: custom:carnet-scolaire-menu
device_id: <appareil de l'enfant>
day: tomorrow
```

Pour afficher les deux jours, posez **deux** cartes : il n'y a pas d'option
qui les combine, chaque carte lit une entité et une seule.

`title` et `entities` fonctionnent en plus sur toutes les cartes : voir
[Deux options communes](../installation.md#deux-options-communes-a-toutes-les-cartes).

## Entités consommées

| Clé | Rôle |
| --- | --- |
| `sensor:menu_today` | Requise avec `day: today`. |
| `sensor:menu_tomorrow` | Requise avec `day: tomorrow`. |

Un menu n'est pas une liste plate : il a des services. Les attributs sont
donc **six** listes — `first_meal`, `main_meal`, `side_meal`, `cheese`,
`dessert`, `other_meal` — plus deux booléens, `is_lunch` et `published`. Il
n'y a pas d'`items[]`.

La carte affiche une ligne par service non vide, toujours dans cet ordre, et
tolère les trois formes rencontrées dans la nature : une chaîne, un tableau
de chaînes, un tableau d'objets nommés. Un service vide ne produit pas de
ligne vide : il disparaît.

## Le menu du jour n'est pas forcément le déjeuner

L'entité porte **un** menu par jour, et c'est l'intégration qui le choisit :
le déjeuner s'il est publié, sinon le premier repas trouvé ce jour-là. Un
établissement qui ne publie que le dîner d'internat renseigne donc la même
entité, et la carte l'affiche sous « Aujourd'hui ».

L'attribut `is_lunch` dit lequel des trois cas s'applique.

| `is_lunch` | Ce que le menu affiché est |
| --- | --- |
| `true` | Le déjeuner. |
| `false` | Un autre repas de la journée. L'intégration ne publie pas lequel. |
| `null` | Rien n'est publié ce jour-là. |

C'est pourquoi l'intitulé de la carte dit « Aujourd'hui » et jamais « ce
midi » : la journée est une affirmation que la donnée soutient, le service
ne l'est pas. Si vous reprenez ces attributs dans un message vocal ou un
modèle, gardez la même prudence — annoncer « au menu ce midi » peut
énoncer quelque chose de faux.

## Les allergènes ne sont pas disponibles

PRONOTE attache à chaque plat des **étiquettes** — allergènes, régimes,
origine. L'intégration ne les publie pas : elle réduit chaque plat à son nom
avant de construire ses entités, et l'information est perdue à ce
moment-là. Aucune carte ne peut donc les afficher, et ce n'est pas un
réglage à chercher.

**Ne vous servez pas de cette carte pour décider si un enfant peut manger un
plat.** Elle donne l'intitulé du service, rien de plus.

## Une carte pilotée par ses attributs

L'intégration laisse délibérément l'**état** de ces capteurs à
« inconnu », même quand la collecte a réussi : un nombre de plats à zéro
affirmerait qu'un menu existe. Le socle écarterait donc normalement la
carte avec un « pas encore collectée ».

Cette carte porte pour cette raison le drapeau `attributeDriven`, comme le
prochain cours : le socle lui rend la main, et elle assume les **deux**
phrases, parce qu'elle est la seule à pouvoir les distinguer.

## Si la carte est vide

| Ce que la carte dit | Ce que ça veut dire |
| --- | --- |
| « Pas de menu publié pour ce jour » | La collecte a réussi. L'établissement ne publie rien ce jour-là — mercredi après-midi, vacances, ou cantine sans service. |
| « Donnée pas encore collectée » | Rien n'est encore arrivé : ni l'indicateur de publication, ni aucun des six services. |

La distinction repose sur l'attribut `published` : à `false`, la collecte a
réussi et l'établissement ne publie rien. Sur une intégration antérieure à
cet attribut, la carte se rabat sur la présence des six clés de service —
au moins une présente signifie que quelque chose est arrivé.
