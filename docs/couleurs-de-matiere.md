# Les couleurs de matière

**Six cartes** savent colorer une matière : [Vue journée](cartes/journee.md),
[Emploi du temps](cartes/emploi-du-temps.md), [Devoirs](cartes/devoirs.md),
[Notes](cartes/notes.md), [Prochain cours](cartes/prochain-cours.md) et
[Évaluations](cartes/evaluations.md). Elles partagent une seule option,
`subject_colors`, et exactement les mêmes règles. Cette page les décrit une
fois pour toutes.

## La couleur vient du serveur, et ça vient de changer

C'est la première chose à savoir, et elle explique la plupart des surprises.
**Depuis la version 0.0.13 de l'intégration, vous n'avez plus rien à écrire
pour voir les couleurs de votre établissement** — celles que l'élève connaît
déjà de l'interface officielle de PRONOTE.

Cette page a longtemps dit l'inverse, et pour une bonne raison : c'était vrai.
L'intégration décodait la couleur sur quatre chemins de sa passerelle et ne
l'exposait sur **aucune** entité — la chaîne était cassée au dernier mètre.
Elle est réparée.

Mais elle ne l'est pas partout, et le détail décide de ce que vous avez à
écrire :

| ce qui porte une matière | couleur du serveur | comment on le sait |
| --- | --- | --- |
| créneaux d'emploi du temps | **oui** | mesuré, 27 sur 27 |
| devoirs | **oui** | mesuré, 12 sur 12 |
| moyennes par matière | **oui** | mesuré, 4 sur 4 |
| prochain cours | **non** | mesuré : la clé est absente des attributs |
| évaluations | **non** | lu dans le code de l'intégration, liste vide à la mesure |
| notes individuelles | empruntée | PRONOTE colore la matière, pas la note : la carte prend celle de la moyenne de la même matière |
| bulletin | jamais | aucune couleur côté protocole |

La distinction entre « mesuré » et « lu dans le code » n'est pas de la
coquetterie. Les quatre premières lignes ont été vérifiées sur une instance
réelle ; celle des évaluations ne peut pas l'être tant que la liste est vide,
et la dernière tient au protocole. Une page qui rangerait les six ensemble vous
ferait retirer une table qui sert peut-être encore.

## Écrire la table

```yaml
type: custom:carnet-scolaire-journee
device_id: <appareil de l'enfant>
subject_colors:
  MATHEMATIQUES: '#1e88e5'
  histoire-géographie: '#8d6e63'
  Sciences: '#43a047'
```

L'option **n'existe qu'en YAML**, et c'est délibéré : un dictionnaire dont les
clés sont les matières de votre établissement ne se modélise pas dans un
formulaire Home Assistant. Ouvrez l'éditeur de la carte, passez en **Afficher
l'éditeur de code**, et ajoutez le bloc. Les autres options restent modifiables
dans le formulaire ensuite.

## Les trois rangs

La couleur d'une matière se prend dans cet ordre :

1. **la couleur publiée par le serveur**, selon le tableau ci-dessus ;
2. **sinon votre table** ;
3. **sinon rien.**

**Le rang 1 gagne, et il rend votre table muette sans vous le dire.** Si vous
aviez écrit une table pour compenser l'absence de couleur, elle ne s'applique
plus qu'aux matières que le serveur ne colore pas — donc, sur l'emploi du
temps, les devoirs et les moyennes d'un établissement qui colore tout, à
aucune. Le bloc
reste dans votre YAML et ne fait plus rien : c'est le genre de configuration
qui trompe celui qui l'édite, et il trompe dans les deux sens — vous ne voyez
pas que votre table a cessé de servir, et vous ne voyez pas pourquoi la
couleur a changé.

Ce qu'il y a à faire, et ce qu'il ne faut **pas** faire :

- **l'emploi du temps et les devoirs** : la table ne sert plus qu'aux matières
  que votre établissement laisse sans couleur, et à remplacer une teinte qui
  vous déplaît. Vous pouvez la retirer ;
- **le prochain cours et les évaluations** : gardez-la. C'est le seul moyen
  d'y obtenir un accent, puisque le serveur ne colore pas ces deux entités ;
- **les notes** : vous pouvez la retirer. Cette page conseillait jusqu'ici de
  la garder, et le doute était fondé : il ne portait pas sur l'intégration,
  qui pose la clé sur les moyennes par matière comme sur les deux autres
  paliers, mais sur le **serveur**, qui n'écrit pas la couleur sous le même
  nom de champ sur ce palier-là. Tant que la liste était vide, rien ne
  permettait de vérifier qu'il l'écrit tout court. Mesuré le 24 septembre
  2026 : les quatre moyennes par matière portent toutes leur couleur, en
  hexadécimal strict. Rappel de portée — les moyennes par matière portent
  la couleur, chaque note prend celle de la moyenne de sa matière, et le
  bulletin reste sans couleur, avec ou sans table.

**Où la couleur se place, carte par carte.** Le placement n'est pas uniforme,
et ce n'est pas un oubli :

| carte | placement |
| --- | --- |
| emploi du temps, notes, prochain cours, évaluations | gouttière à gauche de la ligne |
| devoirs | gouttière à gauche du bloc, la matière en titre |
| vue journée | **filet entre l'heure et la matière** |

La journée est l'exception assumée. Sa colonne d'horaires se lit seule — on la
consulte pour savoir où en est la journée — donc un filet posé à sa gauche
colorerait l'heure autant que la matière, alors que la couleur n'appartient
qu'à la seconde. Les deux placements ont été rendus et comparés ; celui-ci a
été retenu.

Deuxième différence, plus discrète : sur les cinq cartes à gouttière, une ligne
sans couleur garde une gouttière **réservée et transparente**, pour que rien ne
se décale. Sur la journée, le filet d'un créneau sans couleur est **gris** — la
colonne est fixe, donc rien ne se décale de toute façon, et le gris dit
« cette matière n'a pas de couleur » là où le transparent ne dit rien.

**Il n'y a pas de quatrième rang, et surtout pas une couleur calculée à partir
du nom.** C'est le rang qui n'existe pas, volontairement. Une couleur déclarée
est assumée et corrigible ; une couleur dérivée d'un hachage aurait l'apparence
d'une information sans en porter aucune — deux matières prendraient deux teintes
qu'un lecteur lirait comme une catégorie, et le jour où le serveur publierait
ses vraies couleurs, elles contrediraient l'habitude prise.

## Hexadécimal strict, et rien d'autre

Quatre formes sont acceptées, le `#` étant facultatif : `#1e88e5`, `1e88e5`,
`#f80` et `f80`. Le dièse est ajouté s'il manque, et rien d'autre n'est
normalisé — ni la casse, ni la forme à trois chiffres.

`red`, `rgb(30, 136, 229)` et `var(--primary-color)` sont **refusés sans un
mot** : la ligne s'affiche simplement sans couleur, et aucun message ne vous dit
pourquoi. Si une matière reste grise alors que vous l'avez renseignée, c'est la
première chose à vérifier.

Le filtre est étroit parce que la valeur finit dans un attribut `style` : une
chaîne non filtrée y ajouterait des propriétés CSS arbitraires. La règle vaut
aussi pour **votre** table — l'origine d'une valeur ne dit rien de son
innocuité.

## La casse et les accents sont ignorés

`histoire-géographie`, `HISTOIRE-GEOGRAPHIE` et `Histoire-Geographie` désignent
la même matière. La comparaison retire les signes diacritiques, coupe les
espaces de bord et passe en minuscules.

Ce n'est pas un confort. PRONOTE écrit souvent les matières en capitales
accentuées, et sans ce repliement une table rédigée sans accents laissait la
ligne grise **sans un mot** — rien ne distinguait alors « j'ai mal écrit la
matière » de « cette matière n'a pas de couleur ». Le risque inverse, deux
matières d'un même établissement ne différant que par un accent, n'existe pas.

## Un filet, jamais un aplat

Une couleur derrière du texte casse le contraste dès qu'un thème sombre est
actif, et votre thème n'y peut alors plus rien. En filet, le pire cas est un
accent peu visible.

Le filet **ne porte aucune information à lui seul**. Il situe et il décore ; les
horaires, l'intitulé et les pastilles informent. Une carte lue par quelqu'un qui
ne distingue pas ces teintes ne perd donc rien.

### La même règle s'appliquait aux pastilles, et personne ne l'avait vue

Cette section n'a longtemps parlé que de la couleur venue du serveur. Or les
pastilles d'état des cartes — « en retard », « annulé », « à jour » —
faisaient exactement ce qu'elle interdit : du texte blanc sur un aplat de
couleur. Mesuré dans un thème aux valeurs par défaut :

| pastille | avant | après |
| --- | --- | --- |
| avertissement (ambre) | **1,96:1** | 4,59 en clair, 7,59 en sombre |
| problème (rouge) | 4,29:1 | 7,23 / 5,70 |
| succès (vert) | 3,30:1 | 6,25 / 6,46 |

La règle de contraste des textes demande **4,5:1**, et les trois étaient
dessous. Le pire n'était pas le rouge mais l'ambre, dont la luminance est
proche de celle du blanc : à 1,96 ce n'est plus une question d'accessibilité,
c'est difficile à lire pour tout le monde.

Les pastilles colorées sont donc devenues des **teintes** : un fond de la
couleur mélangée à celle de la carte, et un texte de la même couleur fondue
vers celle du thème. Elles gardent leur identité de couleur et perdent leur
aplat. Trois autres dosages ont été mesurés avant celui-là ; deux laissaient
l'ambre sous le seuil en thème clair.

Ce que ça change pour vous : une pastille est plus discrète qu'avant, et son
libellé se lit. Le libellé portait déjà toute l'information — la couleur ne
faisait que la répéter — donc rien ne disparaît. Un navigateur trop ancien
pour mélanger des couleurs affiche une pastille neutre : elle perd sa teinte,
jamais sa lisibilité.

**Ce qu'il faut retenir au-delà du correctif** : la règle était écrite, elle
était juste, et elle n'avait été appliquée qu'à la couleur pour laquelle on
l'avait écrite. Une règle rangée sous « couleurs de matière » ne se relit
pas quand on dessine une pastille d'état.

## Ce que l'option ne fait pas

**Il n'y a pas de réglage global.** La table est une option **par carte** : un
tableau de bord qui affiche l'emploi du temps, la journée, les devoirs et les
notes la répète quatre fois. Avec deux tableaux de bord, huit fois.

Et il n'y a pas d'astuce pour l'éviter : les **ancres YAML** ne survivent pas à
un tableau de bord en mode stockage, qui est enregistré en JSON. Elles ne
fonctionneraient que sur un tableau de bord en mode YAML, et se perdraient au
premier passage par l'éditeur.

**Cette page a affirmé que deux cartes affichaient une matière sans avoir
l'option** — le prochain cours et les évaluations. C'était faux : les six
cartes ont l'option et la traitent à l'identique. L'erreur avait le pire
effet possible, puisque ces deux-là sont précisément celles où la table reste
indispensable : elle décourageait le seul usage encore valable.

## Ce que cette page a promis, et qui ne s'est pas produit

Elle annonçait, sous le titre « le jour où l'intégration publiera la
couleur » : « le rang 1 prendra le dessus tout seul, il n'y aura rien à
défaire, rien à retirer, et rien à réécrire ».

Ce jour est arrivé, et la promesse était fausse. **Il y a quelque chose à
retirer** : une table écrite pour compenser l'absence du champ est devenue
inerte le jour où le champ est arrivé, silencieusement, en restant dans le
YAML. C'est le seul point de cette page qui vaille un avertissement, et il est
en tête de la section [Les trois rangs](#les-trois-rangs).

La promesse est conservée ici plutôt que supprimée, parce que l'effacer
laisserait croire que personne ne s'est trompé. Ce qui l'a rendue fausse est
identifiable : elle raisonnait sur le mécanisme — le rang 1 bat bien le rang 2
tout seul, c'est exact — et non sur ce qu'un utilisateur a dans son fichier.
Un mécanisme correct peut laisser derrière lui une configuration qui ne
correspond plus à rien.
