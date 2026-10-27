![Carnet scolaire](docs/assets/banniere.jpg)

# Carnet scolaire — Cartes Lovelace pour Home Assistant
[![Version](https://img.shields.io/github/v/release/FiveElements/ha-carnet-scolaire-cards?style=flat-square&label=version)](https://github.com/FiveElements/ha-carnet-scolaire-cards/releases)
![Home Assistant 2026.9.0 minimum](https://img.shields.io/badge/Home%20Assistant-2026.9.0%2B-41BDF5?style=flat-square&logo=homeassistant&logoColor=white)
[![validate](https://img.shields.io/github/actions/workflow/status/FiveElements/ha-carnet-scolaire-cards/validate.yml?branch=main&style=flat-square&label=validate)](https://github.com/FiveElements/ha-carnet-scolaire-cards/actions/workflows/validate.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/FiveElements/ha-carnet-scolaire-cards/codeql.yml?branch=main&style=flat-square&label=CodeQL)](https://github.com/FiveElements/ha-carnet-scolaire-cards/actions/workflows/codeql.yml)
[![HACS](https://img.shields.io/github/actions/workflow/status/FiveElements/ha-carnet-scolaire-cards/hacs.yml?branch=main&style=flat-square&label=HACS)](https://github.com/FiveElements/ha-carnet-scolaire-cards/actions/workflows/hacs.yml)
[![Couverture des tests](https://img.shields.io/endpoint?url=https%3A%2F%2Ffiveelements.github.io%2Fha-carnet-scolaire-cards%2Fcoverage.json&style=flat-square)](https://github.com/FiveElements/ha-carnet-scolaire-cards/actions/workflows/docs.yml)
[![Dependabot](https://img.shields.io/badge/Dependabot-activ%C3%A9-025E8C?style=flat-square&logo=dependabot&logoColor=white)](https://github.com/FiveElements/ha-carnet-scolaire-cards/blob/main/.github/dependabot.yml)
[![Alertes CVE](https://img.shields.io/badge/alertes%20CVE-Dependabot-025E8C?style=flat-square&logo=github&logoColor=white)](https://github.com/FiveElements/ha-carnet-scolaire-cards/security)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/FiveElements/ha-carnet-scolaire-cards/badge?style=flat-square)](https://scorecard.dev/viewer/?uri=github.com/FiveElements/ha-carnet-scolaire-cards)
[![Licence](https://img.shields.io/github/license/FiveElements/ha-carnet-scolaire-cards?style=flat-square&label=licence)](LICENSE)
[![Téléchargements](https://img.shields.io/github/downloads/FiveElements/ha-carnet-scolaire-cards/total?style=flat-square&label=t%C3%A9l%C3%A9chargements)](https://github.com/FiveElements/ha-carnet-scolaire-cards/releases)


[📖 Documentation](https://fiveelements.github.io/ha-carnet-scolaire-cards/) · [🔌 Carnet scolaire](https://github.com/FiveElements/ha-carnet-scolaire) · [🐛 Signaler un problème](https://github.com/FiveElements/ha-carnet-scolaire-cards/issues/new/choose)

---

  **Carnet scolaire — Cartes** est un ensemble de **cartes Lovelace personnalisées pour Home Assistant**, conçu pour afficher de manière claire et moderne les données scolaires fournies par l'intégration **[Carnet scolaire](https://github.com/FiveElements/ha-carnet-scolaire)**.

 Les cartes permettent de transformer ces données en un véritable **tableau de bord scolaire dans Home Assistant**.

 Vous pouvez notamment afficher :

 - 📅 l'emploi du temps
- 🕐 le prochain cours
- 📝 les devoirs
- 📊 les notes
- 🎯 les évaluations
- 🍽️ le menu de cantine
- 🏫 la vie scolaire
- 👨‍🎓 les informations de l'élève
- 🚦 le budget de requêtes PRONOTE

 > **Ces cartes nécessitent l'intégration [Carnet scolaire](https://github.com/FiveElements/ha-carnet-scolaire)** — voir son [guide de l'utilisateur](https://fiveelements.github.io/ha-carnet-scolaire/GUIDE-UTILISATEUR/) pour l'installer et la connecter.

---

 ## ✨ Les 10 cartes

 Chaque carte a sa page : aperçu, options, exemple complet à copier,
entités consommées, et ce qu'elle ne peut pas savoir.

 ### 👨‍🎓 [Élève](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/eleve/)

 Une carte de synthèse permettant d'afficher les principales informations concernant l'élève.

---

 ### 🕐 [Prochain cours](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/prochain-cours/)

 Affiche rapidement le prochain cours :

 - matière
- horaire
- salle
- enseignant
- informations complémentaires

 Idéal pour avoir une vue immédiate de ce qui arrive ensuite.

---

 ### 📅 [Vue journée](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/journee/)

 Une représentation graphique de la journée avec :

 - horaires
- matières
- salles
- enseignants
- couleurs par matière
- zone repas

 Cette carte est particulièrement adaptée à un tableau de bord principal.

 L'option `day_offset` décale le jour de la carte : plusieurs cartes côte à
côte font une **[fenêtre glissante sur la semaine](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/journee/#plusieurs-jours-cote-a-cote)**
— chacune sur son jour, chacune avec sa date dans son en-tête.

---

 ### 🗓️ [Emploi du temps](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/emploi-du-temps/)

 Affiche l'emploi du temps de l'élève dans Home Assistant.

 La carte permet de visualiser les cours à venir et leur contexte directement depuis le tableau de bord.

---

 ### 📝 [Devoirs](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/devoirs/)

 Affiche les devoirs récupérés par l'intégration Carnet scolaire.

 Les informations peuvent notamment inclure :

 - matière
- description
- date
- échéance
- état du devoir

---

 ### 📊 [Notes](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/notes/)

 Affiche les notes et informations associées dans une présentation adaptée à Home Assistant.

---

 ### 🎯 [Évaluations](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/evaluations/)

 Permet d'afficher les évaluations et les informations de compétences fournies par l'établissement.

---

 ### 🍽️ [Cantine](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/menu/)

 Affiche les menus de cantine directement dans le tableau de bord Home Assistant.

---

 ### 🏫 [Vie scolaire](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/vie-scolaire/)

 Permet de visualiser les informations liées à la vie scolaire, notamment les absences et autres événements publiés par l'établissement.

---

 ### 🚦 [Limiteur](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/limiteur/)

 Affiche l'état du limiteur de requêtes de Carnet scolaire.

 Cette carte permet notamment de suivre :

 - le budget d'appels
- l'utilisation actuelle
- l'état du limiteur
- le rafraîchissement des données

 Elle est particulièrement utile pour comprendre l'activité de l'intégration Carnet scolaire.

---

 ## 🖼️ Aperçu

 Les cartes sont conçues pour être utilisées ensemble afin de créer un tableau de bord scolaire complet.

 > 📸 Les captures d'écran de démonstration ne contiennent aucune donnée scolaire réelle.

---

 ## 🚀 Installation

 ### Avec HACS

 Les cartes s'installent depuis **HACS** en tant que dépôt personnalisé.

[![Ouvrir ce dépôt dans HACS sur votre Home Assistant](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=FiveElements&repository=ha-carnet-scolaire-cards&category=plugin)

 Ce bouton ouvre **votre** Home Assistant sur la fiche du dépôt dans HACS. Il ne
reste qu'à **Télécharger**, puis à recharger la page du navigateur.

<details>
<summary>Ajouter le dépôt à la main, si le bouton n'aboutit pas</summary>

1. Ouvrez **HACS**
2. Ouvrez le menu **⋮** puis **Dépôts personnalisés**
3. Ajoutez `https://github.com/FiveElements/ha-carnet-scolaire-cards`
4. Sélectionnez la catégorie **Lovelace**, puis **Ajouter**
5. Installez **Carnet scolaire — Cartes** et rechargez la page

</details>

 > 💡 Après l'installation, les ressources JavaScript nécessaires aux cartes sont automatiquement gérées par HACS.
 >
 > Sur un tableau de bord en **mode YAML**, la ressource doit en revanche être
 > déclarée à la main — c'est le seul cas où une carte n'apparaît même pas
 > dans le catalogue. La procédure est dans [Installation](https://fiveelements.github.io/ha-carnet-scolaire-cards/installation/).

---

 ## 🔌 Prérequis

 Ces cartes sont une extension d'affichage.

 Vous devez donc avoir installé et configuré :

 **[Carnet scolaire — Intégration pour Home Assistant](https://github.com/FiveElements/ha-carnet-scolaire)**

 L'intégration Carnet scolaire récupère les données de l'établissement, depuis PRONOTE ou EcoleDirecte.

 Les cartes se chargent ensuite de les présenter dans votre interface Lovelace.

```
PRONOTE · EcoleDirecte
   │
   ▼
Carnet scolaire
   │
   ├── Sensors
   ├── Events
   ├── Calendar
   ├── Todo
   └── autres entités
          │
          ▼
   Carnet scolaire — Cartes
          │
          ▼
   Tableau de bord Home Assistant
```

---

 ## 🧩 Utilisation

 Après installation, ajoutez une carte depuis l'éditeur de tableau de bord Home Assistant.

 Les cartes Carnet scolaire sont disponibles comme cartes Lovelace personnalisées.

 Pour chaque carte, la documentation fournit :

 - les propriétés disponibles
- les paramètres obligatoires
- les paramètres optionnels
- des exemples YAML
- les entités nécessaires
- les possibilités de personnalisation

 👉 **[Consulter la documentation complète](https://fiveelements.github.io/ha-carnet-scolaire-cards/)**

---

 ## 🧱 Avec les composants natifs de Home Assistant

 **Ces cartes ne sont pas obligatoires.** L'intégration publie des entités
ordinaires — `calendar`, `todo`, `sensor`, `binary_sensor` — donc plusieurs
cartes livrées avec Home Assistant fonctionnent directement, sans rien
installer de plus. C'est souvent le chemin le plus court, et pour l'emploi du
temps de la semaine c'est même le meilleur.

 ### La carte Agenda, pour l'emploi du temps

 Trois entités `calendar` sont publiées — emploi du temps, devoirs, punitions —
et la carte **Agenda** les affiche telles quelles :

```yaml
type: calendar
entities:
  - calendar.enfant_un_emploi_du_temps
initial_view: listWeek
title: Agenda de la semaine
grid_options:
  columns: full
  rows: 9
```

 `initial_view: listWeek` donne la semaine en liste, ce qui se lit mieux qu'une
grille sur un téléphone ; `dayGridMonth` et `dayGridDay` sont les deux autres
vues. `grid_options` appartient à la disposition en sections : `columns: full`
occupe toute la largeur, ce dont un agenda a besoin.

 Ajoutez `calendar.enfant_un_devoirs` et `calendar.enfant_un_punitions` à la
même carte pour tout voir au même endroit — les couleurs distinguent les
agendas.

 Remplacez `enfant_un` par le prénom tel qu'il apparaît dans **vos**
identifiants d'entité : ils sont dérivés du nom de l'appareil, donc propres à
votre installation.

 👉 **[L'agenda natif de Home Assistant](https://fiveelements.github.io/ha-carnet-scolaire-cards/ha-calendar/)**
détaille chaque option, ce que contiennent les trois agendas, deux tableaux de
bord complets, et la seule chose qui surprend : **jusqu'où l'agenda sait**.

 ### La carte Liste de tâches, pour les devoirs

```yaml
type: todo-list
entity: todo.enfant_un_devoirs
title: Devoirs à faire
```

 Les devoirs y sont **cochables**, et cocher renvoie l'information à PRONOTE —
à condition d'avoir activé les écritures dans les options de l'intégration, qui
sont coupées par défaut.

 ### La carte Tuile, pour un fait unique

```yaml
type: tile
entity: sensor.enfant_un_prochain_cours
```

 Chaque fait a son entité et son état porte une valeur — un horodatage, un
nombre, un booléen — jamais un texte à découper. Une tuile, une jauge ou un
graphique d'historique marchent donc sans modèle Jinja.

 ### Ce que les cartes de ce dépôt ajoutent

 Les cartes natives ignorent ce qu'elles affichent : elles ne savent pas qu'une
heure de fin a été **déduite** plutôt que fournie, qu'une note est un **bonus**
qui ne compte pas, ou qu'une absence est justifiée malgré son motif. C'est ce
que les cartes de ce dépôt savent, et c'est la seule raison de les installer.

 👉 Le tour complet des deux chemins — quelle carte native pour quelle
donnée, et les trois choses qu'aucune carte ne montrera — est dans
[Afficher les données](https://fiveelements.github.io/ha-carnet-scolaire/AFFICHER-LES-DONNEES/)
côté intégration.

---

 ## 📖 Documentation

 La documentation complète est disponible ici :

 **[📖 Documentation des cartes Carnet scolaire](https://fiveelements.github.io/ha-carnet-scolaire-cards/)**

 Vous y trouverez notamment :

 - [Guide d'installation](https://fiveelements.github.io/ha-carnet-scolaire-cards/installation/)
- [Assembler un tableau de bord](https://fiveelements.github.io/ha-carnet-scolaire-cards/tableaux-de-bord/)
- [Documentation de chaque carte](https://fiveelements.github.io/ha-carnet-scolaire-cards/cartes/eleve/) — une page par carte
- Exemples YAML — un exemple complet sur la page de chaque carte
- [Personnalisation des couleurs de matière](https://fiveelements.github.io/ha-carnet-scolaire-cards/couleurs-de-matiere/)
- [Limites connues](https://fiveelements.github.io/ha-carnet-scolaire-cards/limites/)
- [Guide pour les contributeurs](CONTRIBUTING.md)

---

 ## ⚙️ Architecture

 Les cartes sont volontairement séparées de l'intégration Carnet scolaire.

 Cela permet de garder deux responsabilités distinctes :

 ### Carnet scolaire

 Récupère les données de l'établissement, depuis PRONOTE ou EcoleDirecte, et les expose dans Home Assistant. Le [catalogue de ses entités et services](https://fiveelements.github.io/ha-carnet-scolaire/annexe-a-entites/) donne, pour chaque champ publié, d'où il vient — c'est le contrat que ces cartes lisent.

 ### Carnet scolaire — Cartes

 Présente ces données dans l'interface Lovelace.

 Cette séparation permet d'utiliser Carnet scolaire sans installer les cartes personnalisées.

 Inversement, les cartes peuvent évoluer indépendamment de la récupération des données.

---

 ## 🔒 Données personnelles

 Les captures et illustrations du projet sont conçues pour ne pas contenir de données scolaires réelles.

 Lorsque vous partagez une capture d'écran ou un exemple de configuration, veillez toutefois à ne jamais publier :

 - nom ou prénom d'un élève
- identifiant PRONOTE ou EcoleDirecte
- établissement
- adresse
- informations personnelles d'un enseignant
- données scolaires privées

---

 ## ⚠️ Limites

 Ces cartes sont uniquement une interface d'affichage.

 Elles ne remplacent pas l'intégration Carnet scolaire et ne communiquent jamais directement avec PRONOTE ni EcoleDirecte.

 Les limitations liées à la récupération des données, au protocole PRONOTE ou au rate limiting sont donc principalement gérées par **[Carnet scolaire](https://github.com/FiveElements/ha-carnet-scolaire)** — son [annexe sur le limiteur de requêtes](https://fiveelements.github.io/ha-carnet-scolaire/annexe-b-rate-limit/) en donne le détail.

 👉 Consultez la page **[Limites](https://fiveelements.github.io/ha-carnet-scolaire-cards/limites/)** pour connaître précisément le comportement des cartes.

---

 ## 🧑‍💻 Développement

 Le projet est développé avec :

 - TypeScript
- Vite
- Home Assistant Lovelace
- Web Components

 Le dépôt contient également des tests et des contrôles de qualité automatisés.

 Pour contribuer au projet :

```
npm install
npm run build
npm test
```

 Consultez également :

 **[`CONTRIBUTING.md`](CONTRIBUTING.md)**

---

 ## 🤝 Contribuer

 Les contributions sont les bienvenues.

 Vous pouvez contribuer en :

 - 🐛 signalant un bug
- 💡 proposant une amélioration
- 🎨 améliorant l'interface
- 📖 améliorant la documentation
- 🧪 ajoutant des tests
- 💻 proposant une Pull Request

 👉 **[Voir les issues](https://github.com/FiveElements/ha-carnet-scolaire-cards/issues)**

 Lorsque vous signalez un problème, indiquez si possible :

 - version de Carnet scolaire
- version des cartes Carnet scolaire
- version de Home Assistant
- carte concernée
- configuration YAML utilisée
- capture d'écran anonymisée

---

 ## ⚠️ Important

 **Les cartes Carnet scolaire ne sont pas développées, maintenues ou officiellement supportées par Index Éducation (PRONOTE) ni par l'éditeur d'EcoleDirecte.**

 PRONOTE et EcoleDirecte sont des services tiers.

 Le fonctionnement des cartes dépend des données exposées par l'intégration Carnet scolaire et peut évoluer lorsque PRONOTE, EcoleDirecte ou Home Assistant évoluent.

---

 ## 📄 Licence

 Les cartes Carnet scolaire sont distribuées sous licence **MIT**.

---

 ## ⭐ Le projet vous est utile ?

 Si les cartes Carnet scolaire vous permettent de construire votre tableau de bord scolaire dans Home Assistant :

 - ⭐ ajoutez une étoile au projet
- 🐛 signalez les problèmes
- 💡 proposez des améliorations
- 📖 contribuez à la documentation
- 📣 partagez le projet avec d'autres utilisateurs de Home Assistant

 Chaque étoile et chaque contribution aide d'autres utilisateurs à découvrir les **cartes Lovelace Carnet scolaire pour Home Assistant**.
