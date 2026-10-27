# Installation

Cette bibliothèque de cartes ne fonctionne qu'avec l'intégration
**Carnet scolaire** (domaine `carnet_scolaire`, dépôt
[`FiveElements/ha-carnet-scolaire`](https://github.com/FiveElements/ha-carnet-scolaire)).
Installez et configurez d'abord cette intégration : les cartes se
contentent de lire les entités qu'elle crée, elles ne collectent rien
par elles-mêmes.

**Version minimale de Home Assistant : 2026.10.0.** C'est ce que déclare
le fichier `hacs.json` du dépôt, et HACS refuse l'installation en deçà.

## Installer par HACS (dépôt personnalisé)

Cette bibliothèque n'est pas dans le magasin par défaut de HACS.

1. Dans HACS, ouvrez le menu, puis **Dépôts personnalisés**, et ajoutez
   l'URL `https://github.com/FiveElements/ha-carnet-scolaire-cards` avec la
   catégorie **Lovelace / greffon**.
2. Installez le dépôt qui apparaît, puis rechargez Home Assistant (ou
   au moins le cache du navigateur).

## Ajouter la ressource à la main (tableau de bord en mode YAML)

Sur un tableau de bord géré par l'interface (le mode par défaut), HACS
ajoute la ressource tout seul : rien de plus à faire, passez à la
section suivante.

Si votre tableau de bord est en **mode YAML** (un fichier
`ui-lovelace.yaml` ou équivalent), HACS n'injecte rien pour vous : il
faut déclarer la ressource vous-même.

1. Allez dans **Paramètres → Tableaux de bord**, ouvrez le menu (les
   trois points en haut à droite), puis choisissez **Ressources**.
2. Cliquez sur **Ajouter une ressource**.
3. Renseignez l'URL `/hacsfiles/ha-carnet-scolaire-cards/carnet-scolaire-cards.js`
   et choisissez le type **Module JavaScript**.
4. Rechargez la page, ou tout le navigateur, avant de chercher les
   cartes.

Si les cartes n'apparaissent pas dans le catalogue de l'éditeur alors
que l'étape précédente s'est bien déroulée, c'est le signe le plus
probable que cette ressource manque encore ou pointe vers la mauvaise
URL.

## Ajouter une carte

Dans l'éditeur de tableau de bord, ajoutez une carte, cherchez
« Carnet scolaire » : les cartes de cette bibliothèque apparaissent.
Choisissez-en une, puis choisissez l'enfant dans le sélecteur
d'appareil qui apparaît.

**Toutes les cartes se configurent avec l'appareil de l'enfant — sans
exception.** Aucune ne demande d'identifiant d'entité. C'est vrai aussi
de la carte « limiteur », qui affiche pourtant des données portées par
l'appareil de *compte* (budget d'appels, état du limiteur) : elle
remonte toute seule jusqu'à cet appareil en suivant le lien technique
qui relie l'appareil de l'enfant à celui du compte. Vous choisissez
l'enfant, comme pour les sept autres cartes — jamais le compte.

## Pourquoi aucun identifiant d'entité n'apparaît nulle part

Les identifiants d'entités de l'intégration Carnet scolaire dérivent du nom
affiché de l'enfant dans Home Assistant : ils sont donc propres à
chaque installation, et une simple correction orthographique du nom
affiché les change — silencieusement. Un identifiant copié depuis un
exemple de documentation ne fonctionnerait donc jamais chez vous, et un
identifiant qui fonctionne aujourd'hui peut cesser de fonctionner après
un renommage.

Pour cette raison, les cartes ne prennent jamais d'identifiant
d'entité en configuration. Elles prennent l'appareil de l'enfant, et
retrouvent chaque entité dont elles ont besoin par sa clé technique
stable (sa « `translation_key` »), identique sur toutes les
installations et dans toutes les langues. C'est aussi pourquoi cette
documentation ne montre jamais un identifiant d'entité complet : il
n'y en a pas d'universel à montrer. Chaque page de carte, à la place,
donne la clé qualifiée qu'elle recherche (par exemple
`sensor:next_lesson`) — c'est ce que l'éditeur de carte affiche aussi
dans son diagnostic de résolution.

## Langue de l'interface

L'interface des cartes (libellés, messages d'état, éditeur) est
traduite en français, italien, portugais (européen) et espagnol
(d'Espagne). Elle suit la langue configurée pour l'utilisateur Home
Assistant connecté, et retombe sur le français si la langue de
l'utilisateur n'est pas prise en charge.

Cette documentation, elle, reste uniquement en français.

## Deux options communes à toutes les cartes

Les onze cartes acceptent deux réglages qui n'apparaissent sur la page
d'aucune d'entre elles, parce qu'ils ne dépendent pas de la carte.

`title` remplace l'intitulé affiché en tête. Sans lui, la carte n'affiche
pas de titre du tout : c'est le nom de l'appareil, pris au registre Home
Assistant, qui identifie l'enfant partout où c'est utile. Mettez-en un
quand vous empilez plusieurs cartes du même type dans une colonne.

```yaml
type: custom:carnet-scolaire-notes
device_id: <appareil de l'enfant>
title: Notes du premier trimestre
```

`entities` force la résolution d'une clé vers un identifiant d'entité
précis. **Vous ne devriez jamais en avoir besoin** : les cartes retrouvent
chaque entité à partir de l'appareil et d'une clé technique stable, ce qui
est précisément ce qui les rend insensibles à un renommage. L'option existe
pour les cas où la résolution automatique ne peut pas aboutir — une entité
que vous avez déplacée sur un autre appareil, par exemple.

```yaml
type: custom:carnet-scolaire-notes
device_id: <appareil de l'enfant>
entities:
  sensor:overall_average: sensor.un_identifiant_choisi_par_vous
```

Une clé forcée l'est pour cette carte seulement, et les autres continuent de
se résoudre normalement. `device_id` peut même être omis si `entities`
couvre toutes les clés requises — mais la carte perd alors le nom de
l'appareil, et donc son intitulé par défaut.

## Si une carte reste vide

Si la carte n'apparaît même pas dans le catalogue de l'éditeur, voyez
d'abord [Ajouter la ressource à la main](#ajouter-la-ressource-a-la-main-tableau-de-bord-en-mode-yaml) :
c'est le symptôme d'un tableau de bord en mode YAML sans ressource
déclarée.

Si la carte apparaît mais reste vide, ouvrez son éditeur : il affiche
un diagnostic de résolution qui indique, pour l'appareil choisi,
quelles clés d'entités il a trouvées et lesquelles manquent. Les pages
de chaque carte listent ces clés et précisent lesquelles sont
indispensables.

Voir aussi [ce que ces cartes ne feront jamais](limites.md) pour ce qui
est volontairement absent de cette bibliothèque.
