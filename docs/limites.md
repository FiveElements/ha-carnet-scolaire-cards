# Ce que ces cartes ne feront jamais

## L'URL iCal, l'identité et le PDF d'emploi du temps

L'intégration expose ces trois données par des services à réponse, et
non par des entités. Ce n'est pas un oubli : c'est la raison d'être de
ce choix.

L'URL iCal donne accès à l'emploi du temps complet d'un élève **sans
aucun identifiant**. Quiconque l'obtient l'a pour de bon. Elle se traite
comme un mot de passe.

Une carte est une surface partageable par construction : une capture
d'écran, un partage d'écran en visioconférence, un tableau de bord
ouvert sur une tablette de cuisine, une photo envoyée pour demander de
l'aide. Aucune de ces trois données n'y a sa place.

Le type qui décrit ce qu'une carte peut faire n'autorise que quatre
appels de service, en deux listes fermées — tenter d'en passer un autre
ne compile pas. Trois agissent sans rien rendre :

- `carnet_scolaire.refresh`, qui ne place aucune requête PRONOTE : il
  relève une priorité auprès de l'ordonnanceur (détail plus bas) ;
- `todo.update_item`, qui coche un devoir sur une entité `todo` de
  Home Assistant — sans rapport avec le limiteur ni avec les données
  ci-dessus ;
- `select.select_option`, la bascule du mode de collecte. Son domaine
  n'est pas celui de l'intégration : c'est le seul des quatre qui puisse
  écrire hors du périmètre de PRONOTE, et le type ne l'empêche plus à
  lui seul — la cible vient de la résolution des entités.

Un seul rend une réponse, et il a son propre type pour qu'aucun des
trois autres ne puisse en demander une :

- `carnet_scolaire.get_attachment_url`, qui rend l'adresse d'une pièce jointe
  de type fichier **au moment du clic**. Il existe pour une raison de
  sécurité : cette adresse ouvre le document sans identifiant, et tant
  qu'elle était publiée dans un attribut d'entité, elle finissait dans
  l'historique et dans chaque abonnement, valable douze heures. Demandée
  au clic, elle n'existe que le temps d'ouvrir l'onglet et expire en
  cinq minutes. Il ne place aucune requête PRONOTE — il signe un chemin
  à partir de ce qui est déjà en mémoire — et aucune carte ne l'appelle
  en s'affichant.

Cette page a dit « deux » pendant deux semaines après l'arrivée du
troisième. C'est précisément le genre d'écart qu'elle ne peut pas se
permettre : elle est la réponse qu'on donne à qui demande ce qu'une
carte peut faire.

Les six services à réponse qui exposent l'URL iCal, l'identité et le PDF
restent hors d'atteinte par le type : une carte ne peut ni les appeler
directement, ni s'en approcher en passant un couple domaine/service
arbitraire à la place des quatre ci-dessus.

À côté de cette garantie de type, un test de garde relève **tous les
sites d'appel de service présents dans le code** et exige que chacun
tire son couple domaine/service de la liste ci-dessus ; il vérifie en
outre que le point d'entrée non restreint de Home Assistant ne
s'atteint que depuis l'unique pont du socle. C'est une vérification de
texte, complémentaire à celle du type et non un substitut : elle porte
sur les sites d'appel, pas sur toute mention possible d'un nom de
service ailleurs dans un fichier. Un second test échoue si le nom de
l'un des six services réapparaît dans le code ou la documentation
publiée, pages de la racine comprises.

**Cette page est la réponse aux demandes de carte « emploi du temps
PDF » ou « fiche élève complète ». La réponse est non, et elle ne
dépend pas de qui demande.**

## Le journaliseur pronotepy

Ne l'activez jamais. Au niveau `DEBUG`, il écrit l'hexadécimal de chaque
requête, identifiants compris. Pour déboguer, activez uniquement :

```yaml
logger:
  logs:
    custom_components.carnet_scolaire: debug
```

## Le déclenchement de collectes

Aucune carte ne provoque de collecte en s'affichant. Le serveur PRONOTE
sanctionne l'adresse IP, et tout le budget de requêtes est géré par un
limiteur côté intégration.

La carte « limiteur » propose un bouton qui appelle `carnet_scolaire.refresh`.
Ce service ne place aucun appel : il relève une priorité auprès de
l'ordonnanceur. Un boost est plafonné à un par palier et par intervalle,
et le bouton se grise en conséquence — cliquer plus n'obtient pas plus.

## Le choix de la période (trimestre, semestre)

Aucune carte ne propose de sélecteur de période : les notes et la vie
scolaire affichées sont toujours celles de la période en cours. Il n'y
a aucun moyen d'afficher, depuis une carte, une période close — le
trimestre 1 une fois le trimestre 2 commencé, par exemple.

Ce n'est pas un oubli : c'est un trou structurel. Pour chaque période
close qu'elle suit, l'intégration crée un jeu d'entités suffixées par
un index. Mais toutes ces entités, sur un même appareil, partagent le
même `translation_key` — c'est exactement la clé que les cartes
utilisent pour retrouver une entité. La résolution ne peut donc pas
distinguer un trimestre 1 d'un trimestre 2 : elle rendrait l'une des
deux entités au hasard de l'ordre dans lequel le registre de Home
Assistant les liste.

Il reste une échappatoire, et il faut la décrire honnêtement : l'option
`entities` d'une carte permet de **désigner un identifiant d'entité
précis** pour une clé donnée, en contournant entièrement la résolution.
Écrite à la main dans le YAML de la carte, elle épingle donc une
période close :

```yaml
type: custom:carnet-scolaire-notes
device_id: <appareil de l'enfant>
entities:
  sensor:grades: sensor.<enfant>_notes_2
```

Ce n'est pas recommandé, et aucune interface ne le propose, pour une
raison qui vaut d'être dite plutôt que cachée : cet identifiant dérive
du nom affiché de l'enfant dans Home Assistant (voir
[Installation](installation.md)). Renommer l'appareil, ou installer la
carte sur une autre instance, casse la configuration en silence — la
carte affichera « entité introuvable ». C'est le seul endroit du projet
où un identifiant d'entité est écrit en dur, et c'est vous qui en
portez la conséquence.

La surcharge subit la même vérification de domaine que le chemin
normal : une clé `sensor:...` ne peut se résoudre qu'à un `sensor.`.
Un identifiant d'un autre domaine est ignoré, pas accepté sans un mot.
Et un identifiant qui ne désigne **rien** — ni au registre, ni parmi les
états, typiquement après un renommage — tombe en « entité introuvable »,
dans la carte comme dans son éditeur. Jusqu'à la version qui a corrigé ce
point, il tombait en « pas encore collectée », qui se lit comme une panne
passagère et ne se résorbait jamais : la phrase ci-dessus était donc vraie
de l'intention, pas du code.

Si vous n'avez pas besoin de l'épingler dans un tableau de bord,
consultez la période close directement dans PRONOTE ou dans
l'historique de l'intégration.

## Traduire ce que l'établissement a écrit

Plusieurs textes viennent du serveur, tels que l'établissement les a
saisis : les libellés de maîtrise d'une évaluation (« Très bonne
maîtrise »), les motifs d'absence, la durée d'une absence (« 2h00 »),
les appréciations du bulletin, les énoncés de devoirs.

Aucun n'est traduit, ni reformulé, ni normalisé. Traduire une échelle de
maîtrise inventerait une échelle qui n'est pas celle de l'établissement ;
recomposer une durée écrite à la main lui ferait dire autre chose. Les
quatre catalogues de langue ne portent que les mots de l'interface.

**Et aucune contradiction apparente n'est réconciliée.** Le cas relevé
sur une installation réelle :

```yaml
justified: true
hours:     "2h00"
reasons:   ["MALADIE SANS CERTIFICAT"]
```

La carte affiche les trois côte à côte : `2h00 · MALADIE SANS
CERTIFICAT`, avec la pastille « justifiée ». Ça se lit comme une
incohérence et ça n'en est pas une. Le motif est ce que la famille a
fourni, le drapeau est ce que l'établissement a accepté : la vie scolaire
a justifié l'absence **malgré** l'absence de certificat. Les deux sont
vrais et ils ne parlent pas de la même chose. Masquer l'un au nom de
l'autre effacerait l'information la plus intéressante des deux.

Corollaire pour une automatisation : la justification se lit dans
`justified`, jamais en cherchant un mot dans `reasons`. Une condition qui
cherchait « sans certificat » conclurait ici l'exact contraire de la
vérité.

## Injecter le HTML du serveur

PRONOTE écrit les énoncés de devoirs en HTML. Aucune carte ne les
insère dans la page comme du balisage — ni pour l'afficher, ni pour
s'en débarrasser. Le texte lisible est obtenu par un retrait purement
textuel, ou mieux, lu depuis la variante en texte simple que
l'intégration publie.
