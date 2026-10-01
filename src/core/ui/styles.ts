import { css } from 'lit';

export const sharedStyles = css`
  :host {
    display: block;
  }
  ha-card {
    padding: 0;
    overflow: hidden;
  }
  .body {
    padding: 12px 16px 16px;
  }
  .title {
    font-size: var(--ha-card-header-font-size, 24px);
    font-weight: 400;
    padding: 12px 16px 8px;
    color: var(--ha-card-header-color, var(--primary-text-color));
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--divider-color);
  }
  .row:last-child {
    border-bottom: none;
  }
  .row .primary {
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .row .secondary {
    color: var(--secondary-text-color);
    font-size: 0.9em;
    /* Les énoncés de devoirs comptent plusieurs lignes : sans ceci, les
       retours posés par plainText() se replient en espaces et deux phrases
       se collent. */
    white-space: pre-line;
  }

  /* L'enonce repliable, quand la carte devoirs recoit max_lines.

     La coupe porte sur un span INTERIEUR, jamais sur l'element qui porte la
     classe enonce. Deux mesures du 10 septembre 2026 l'imposent, et elles
     disent la meme chose de deux endroits : Chrome ramene a flow-root le
     display d'un summary, et aussi celui d'un enfant direct de details
     ferme. La coupe se fait alors mais SANS points de suspension -- donc une
     troncature invisible, exactement le defaut qu'on veut eviter sur un
     enonce de devoir. Sur un span interieur, les points sont peints, capture
     a l'appui.

     Ce sont eux qui portent l'honnetete de ce dispositif. Ils n'apparaissent
     QUE si le texte deborde vraiment, la ou un chevron pose par nous aurait
     annonce du contenu cache sur des enonces courts qui n'en ont pas.

     Le texte entier reste dans le DOM meme replie : un lecteur d'ecran et
     une recherche dans la page le trouvent, seule la peinture est coupee.

     Le nombre de lignes arrive par une propriete personnalisee, posee en
     attribut style par la carte. C'est un entier tronque par elle, jamais
     une chaine de serveur. */
  .row .secondary .enonce:not(.deplie) > .enonce-corps {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--pronote-max-lines, 3);
    overflow: hidden;
  }
  /* La bascule. C'etait un summary de details, et le navigateur retenait
     l'etat pour nous -- mais tout l'enonce vivait alors DANS le summary,
     donc il devenait le nom accessible d'un bouton. Mesure du 10 septembre
     2026 : 269 caracteres de nom, et zero caractere hors du summary, donc
     un lecteur d'ecran entendait l'enonce entier comme un libelle de bouton
     puis se voyait proposer de deplier quelque chose de vide.

     Maintenant l'enonce est du texte et la bascule est un bouton court. Le
     texte n'est jamais coupe pour un lecteur d'ecran : la coupe est faite
     par overflow, qui n'ote rien de l'arbre d'accessibilite.

     Deux libelles rendus, un seul visible : ecrire le libelle a la main sur
     un clic serait ecrase au prochain rendu de Lit, alors qu'une classe
     posee sur un element a attributs statiques survit. */
  .row .secondary .enonce-bascule {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    margin-top: 2px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: var(--primary-color);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .row .secondary .enonce-bascule:hover,
  .row .secondary .enonce-bascule:focus-visible {
    text-decoration-thickness: 2px;
  }
  .row .secondary .enonce:not(.deplie) .enonce-replier,
  .row .secondary .enonce.deplie .enonce-deplier {
    display: none;
  }
  /* Les pieces jointes d'un devoir, sous l'enonce, en PASTILLES.

     Le proprietaire a explicitement laisse le choix de la forme : ne pas
     reprendre le gabarit du site web, faire ce qui va a Home Assistant.
     Trois raisons de prendre l'idiome du depot. La pastille est deja le
     vocabulaire de quatre cartes d'ici, donc rien n'est invente. Elle tire
     ses couleurs des variables du theme, donc elle suit un theme sombre. Et
     elle donne une cible de clic prenable au doigt, la ou un nom precede
     d'un tiret n'en etait pas une.

     Le libelle << Pieces jointes : >> a disparu avec : il coutait une ligne
     entiere et ne portait rien qu'un nom de fichier dans une pastille ne
     porte deja. Il survit en nom accessible du groupe, sur aria-label.

     Le flux enveloppe : deux pastilles tiennent cote a cote sur une carte
     large et passent a la ligne sur une carte etroite, sans qu'aucune
     largeur soit ecrite ici. */
  .row .secondary .devoirs-pieces {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    /* Pas de white-space: normal ici, et la raison vaut d'etre ecrite parce
       qu'elle ne se devine pas. La regle .row .secondary porte pre-line,
       pour que les retours a la ligne d'un enonce survivent, et il semblait
       que l'indentation du gabarit entre deux pastilles devienne alors un
       element flex anonyme -- la specification n'ecarte une suite de texte
       que si elle est entierement reductible.

       MESURE sur l'instance, avec le blanc impose en ligne pour qu'aucune
       specificite ne l'emporte : les deux groupes font 156,1 pixels, soit
       exactement les deux pastilles plus une gouttiere. Chrome ecarte donc
       ces suites meme sous pre-line. Une declaration posee pour un danger
       qui n'existe pas est une superstition, et la prochaine personne la
       reproduirait ailleurs. */
  }
  /* La taille de la pastille, remise a celle du texte qui l'entoure.
     MESURE sur l'instance, dans le theme du proprietaire : l'hote de la
     carte est a 14px, .secondary la ramene a 12.6, et .chip reprend 0.8em
     par-dessus. Un nom de fichier tombait donc a 10px, plus petit que
     l'enonce juste au-dessus de lui -- alors qu'un nom de document est du
     CONTENU, pas une etiquette d'etat.

     La pastille d'alerte, elle, garde ses 0.8em : posee dans la partie
     finale d'une ligne, elle part de 14px et rend a 11.2. Elle est donc
     plus PETITE que la pastille de piece jointe, et c'est voulu -- ce qui
     la distingue est sa couleur, blanc sur rouge, la ou une piece jointe
     est grise sur gris. La couleur porte l'alerte, la taille porte la
     lisibilite, et les deux familles ne se disputent pas le meme canal.

     La hauteur minimale vaut pour TOUTES les pastilles de pieces jointes et
     non pour les seules ouvrables : sinon un devoir portant une piece avec
     adresse et une piece sans en afficherait deux de hauteurs differentes,
     et la ligne changerait de hauteur le jour ou l'integration publierait
     une adresse. 24px est le minimum de la regle WCAG 2.5.8 sur la taille
     des cibles. */
  .row .secondary .devoirs-piece .chip {
    box-sizing: border-box;
    min-height: 24px;
    font-size: 1em;
  }
  /* La pastille qui ouvre un document : SOULIGNEE, et de la couleur du
     texte qui l'entoure.

     C'etait l'inverse au depart -- la couleur de lien du theme, et un
     soulignement au seul survol, pour qu'une pastille soulignee ne fasse pas
     de bruit sous un enonce. MESURE dans le theme du proprietaire, cette
     preference perd : la couleur de lien sur le fond de pastille donne
     2,59:1, quand la regle de contraste des textes demande 4,5:1. La couleur
     du texte de la pastille, elle, donne 5,15:1.

     Le soulignement n'est donc pas un repli, c'est le bon signal : il ne
     depend d'aucune couleur, ce que la regle sur l'usage de la couleur
     demande justement d'un lien pose au milieu d'un texte. Une preference de
     calme ne se paie pas en lisibilite.

     Les pastilles muettes -- un nom sans adresse, ce que l'integration
     publie aujourd'hui -- restent sans soulignement : c'est ce qui distingue
     ce qui s'ouvre de ce qui se lit, et rien n'invite a cliquer sur ce qui
     ne repond pas. */
  .row .secondary .chip-lien {
    display: inline-flex;
    align-items: center;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  /* Une piece de type fichier est un BOUTON et non une ancre : son adresse
     n'existe pas avant le clic, elle se demande au service. Il doit pourtant
     se lire comme les autres pastilles ouvrables, donc on lui retire ce que
     le navigateur ajoute a un bouton -- bordure, police, curseur par defaut. */
  .row .secondary .chip-demande {
    border: none;
    font: inherit;
    font-size: 1em;
    cursor: pointer;
  }
  .row .secondary .chip-demande:disabled {
    cursor: progress;
    opacity: 0.6;
  }
  .row .secondary .devoirs-piece-etat:empty {
    display: none;
  }
  .row .secondary .devoirs-piece-etat {
    flex-basis: 100%;
    color: var(--error-color);
  }
  .row .secondary .chip-lien:hover,
  .row .secondary .chip-lien:focus-visible {
    text-decoration-thickness: 2px;
  }
  .row .trailing {
    margin-left: auto;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
  }
  /* L'en-tete d'un groupe de lignes : la moyenne d'une matiere au-dessus du
     detail de ses notes, sur la carte notes filtree. Plus d'air au-dessus,
     pour que le groupe se detache du precedent. */
  .row.entete {
    padding-top: 12px;
  }
  .row.entete .primary,
  .row.entete .trailing {
    font-size: 1.15em;
    font-weight: 600;
    color: var(--primary-text-color);
  }
  /* Une date en petite page de calendrier : bandeau du mois, jour dessous.
     Largeur fixe et etroite, pour que toutes les pages d'une liste
     s'alignent et laissent la place au contenu. Le bandeau prend la couleur
     primaire du theme, jamais la couleur de matiere : celle-ci reste un
     accent de bordure. */
  .page-calendrier {
    display: inline-flex;
    flex-direction: column;
    width: 2.6em;
    flex: none;
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    overflow: hidden;
    text-align: center;
    line-height: 1.15;
    font-weight: 400;
    vertical-align: middle;
  }
  .page-calendrier-mois {
    background: var(--primary-color);
    color: var(--text-primary-color);
    font-size: 0.7em;
    padding: 1px 0;
    white-space: nowrap;
  }
  .page-calendrier-jour {
    color: var(--primary-text-color);
    font-size: 1.05em;
    font-weight: 600;
    padding: 1px 0 2px;
  }
  .row:has(.page-calendrier) {
    align-items: center;
  }
  .notice {
    color: var(--secondary-text-color);
    font-style: italic;
    padding: 8px 0;
  }
  .notice.problem {
    color: var(--error-color);
    font-style: normal;
  }
  .notice code {
    font-style: normal;
    background: var(--secondary-background-color);
    border-radius: 4px;
    padding: 0 4px;
  }
  .chip {
    display: inline-block;
    border-radius: 12px;
    padding: 2px 10px;
    font-size: 0.8em;
    background: var(--secondary-background-color);
    color: var(--secondary-text-color);
  }
  /* Les trois tons : un fond TEINTE et un texte du ton fondu vers la couleur
     de texte du theme -- plus un aplat sature portant du blanc.

     Ce que l'aplat coutait, mesure dans le theme du proprietaire, qui garde
     les valeurs par defaut de Home Assistant sur ces trois variables :

       ton        aplat + blanc        teinte + texte fondu
       warn       1,96:1               4,59 clair / 7,59 sombre
       problem    4,29:1               7,23 clair / 5,70 sombre
       ok         3,30:1               6,25 clair / 6,46 sombre

     La regle de contraste des textes demande 4,5:1, et les trois etaient
     dessous. Le pire n'etait pas le rouge mais l'ambre : du blanc sur
     #ffa600 donne 1,96, parce que la luminance de l'ambre est proche de
     celle du blanc. A ce niveau ce n'est plus une question d'accessibilite,
     c'est illisible pour tout le monde. Ces trois tons sont appeles 71 fois
     depuis dix des onze cartes -- seule la carte evaluations n'en emploie
     aucun -- donc le defaut etait celui du vocabulaire visuel du depot.

     Les dosages ne sont pas choisis au jugement : trois autres ont ete
     mesures, et 18/65 comme 22/75 laissent warn sous le seuil en theme
     clair. 15/55 est le seul qui passe dans les deux sens.

     Deux consequences a assumer. La pastille perd son aplat, donc un peu de
     saillance : ce qui la fait voir devient la teinte et le texte colore, et
     non plus un pave de couleur. Et si un navigateur ne connait pas
     color-mix, les deux declarations tombent et la pastille reste neutre --
     elle perd sa couleur, jamais sa lisibilite, ce qui est le bon sens de
     degradation.

     C'est aussi la doctrine que le depot applique deja a la couleur de
     matiere, pour la meme raison ecrite dans CLAUDE.md : une couleur choisie
     pour un fond blanc casse le contraste des qu'on la met en aplat. Elle
     valait pour la seule couleur venue du serveur ; elle vaut autant pour
     celles du theme. */
  .chip.warn {
    background: color-mix(in srgb, var(--warning-color) 15%, var(--card-background-color));
    color: color-mix(in srgb, var(--warning-color) 55%, var(--primary-text-color));
  }
  .chip.problem {
    background: color-mix(in srgb, var(--error-color) 15%, var(--card-background-color));
    color: color-mix(in srgb, var(--error-color) 55%, var(--primary-text-color));
  }
  .chip.ok {
    background: color-mix(
      in srgb,
      var(--success-color, var(--state-icon-active-color)) 15%,
      var(--card-background-color)
    );
    color: color-mix(
      in srgb,
      var(--success-color, var(--state-icon-active-color)) 55%,
      var(--primary-text-color)
    );
  }
  .canceled {
    text-decoration: line-through;
    opacity: 0.6;
  }

  /* Le code couleur des matières, tel que l'établissement l'a choisi.
     Posé en variable par la ligne elle-même (voir RowOptions.accent), et
     seulement sur les listes qui portent une matière : les autres cartes ne
     réservent pas la gouttière et gardent leur alignement d'origine.

     Un ACCENT, jamais un fond ni une couleur de texte. Les couleurs PRONOTE
     sont choisies pour le fond blanc de l'interface officielle : en aplat
     derrière du texte, elles cassent le contraste dès qu'un thème sombre est
     actif, et le thème de l'utilisateur ne peut plus rien y faire. En bordure,
     le pire cas est un accent peu visible — on perd un rappel, jamais la
     lisibilité de la ligne.

     Le repli transparent fait le travail des lignes sans couleur : la
     gouttière est réservée, donc rien ne se décale.

     (Aucun guillemet oblique dans ce fichier, y compris en commentaire : tout
     est à l'intérieur d'un gabarit de patron, qu'un guillemet oblique
     fermerait au milieu de la feuille de styles. La compilation échoue alors
     sur une erreur de syntaxe JavaScript à des dizaines de lignes de là.) */
  .row.accented {
    border-left: 3px solid var(--pronote-subject-color, transparent);
    padding-left: 6px;
  }
  /* Une ligne codée par couleur mais sans couleur exploitable. La propriété
     --pronote-subject-color est HERITEE : sans cette règle, un thème qui la
     pose plus haut colorait toutes ces lignes, sans erreur visible. Deux
     classes, comme pour le filet neutre de la journée, pour ne pas dépendre
     de l'ordre des règles. */
  .row.accented.accent-neutre {
    border-left-color: transparent;
  }

  /* La ligne en BLOC de deux niveaux : le titre en haut, le contenu dessous
     sur toute la largeur. Voir RowOptions.stacked. C'est le rendu des
     devoirs.

     Ce bloc REMPLACE deux dispositifs qui ont vécu ici et qu'il ne faut pas
     restaurer en croyant réparer une régression :

     - un filet de matière pleine hauteur, posé entre l'intitulé et le
       contenu, qui coupait la ligne en deux ;
     - une sous-grille par jour, qui donnait la même largeur à la colonne de
       matière sur toutes les lignes d'un même jour.

     Les deux étaient demandés, les deux marchaient, et les deux ont été
     annulés par la même décision : la couleur de matière est une gouttière à
     gauche PARTOUT, et l'énoncé du devoir prend toute la largeur. Ce qui a
     changé n'est pas l'argument de l'alignement, c'est l'arbitrage. Mesure à
     l'appui : sur une carte de 420 pixels, la colonne bornée laissait 132
     pixels à l'énoncé, qui est le contenu même de la carte. En bloc il en a
     la largeur entière.

     Le align-items en valeur stretch surcharge le baseline de la ligne :
     sans lui, les deux niveaux du bloc se caleraient sur une ligne de base
     commune au lieu de prendre la largeur disponible. */
  .row.empile {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
  }
  .row.empile > .empile-tete {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  /* La photo de l'élève. La carte qui l'affiche la laisse désactivée par
     défaut : une photo d'enfant sur un tableau de bord se retrouve dans une
     capture d'écran ou un partage de vue. */
  .photo {
    width: 64px;
    height: 64px;
    flex: 0 0 auto;
    border-radius: 50%;
    object-fit: cover;
  }

  /* Le seul bouton du projet — celui qui demande un relèvement de priorité au
     limiteur. Sans ces règles il s'affichait avec le chrome natif du
     navigateur : gris clair sur un thème sombre, et aucun état de focus
     visible au clavier. */
  button {
    font: inherit;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: var(--primary-color);
    color: var(--text-primary-color);
    cursor: pointer;
  }
  button:disabled {
    background: var(--disabled-text-color);
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--accent-color, var(--primary-color));
    outline-offset: 2px;
  }

  /* ---- La vue journée -------------------------------------------------
     Une grille à trois colonnes : le filet de couleur, les horaires, le
     corps. La colonne d'horaires est de largeur fixe pour que tous les
     horaires s'alignent verticalement, ce qui est ce qui fait lire la journée
     comme une journée et non comme une liste.

     Le filet est en PREMIERE colonne, comme la gouttière des cinq autres
     cartes. Il était auparavant posé après les horaires, ce qui se défendait
     — il y touchait le corps qu'il colore. La décision est de placer la
     couleur de matière à gauche partout : le placement uniforme vaut plus que
     l'argument local, parce que six cartes qui codent la couleur au même
     endroit se lisent sans avoir à réapprendre chacune. */
  .jour {
    display: flex;
    flex-direction: column;
  }
  /* L'en-tete : la date a gauche, les bornes de la journee a droite. Les
     bornes sont en chiffres tabulaires pour qu'elles ne dansent pas quand
     l'heure change. */
  .jour-entete {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--divider-color);
  }
  /* Les fleches de navigation. Volontairement discretes : ce ne sont pas des
     actions, ce sont des deplacements du regard, et elles ne coutent aucune
     requete -- toute la semaine est deja dans un attribut. Le seul bouton
     plein du projet est celui du limiteur, qui touche lui au budget de
     collecte : la difference d'apparence porte cette difference de nature.

     Des boutons et non des liens : au bord de la fenetre collectee, une
     fleche n'a plus de destination, et seul un bouton sait le dire -- a la
     souris comme au lecteur d'ecran. */
  .jour-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .jour-fleche {
    background: none;
    color: var(--secondary-text-color);
    padding: 0 6px;
    font-size: 1.4em;
    line-height: 1;
    border-radius: 4px;
  }
  .jour-fleche:hover:not(:disabled) {
    background: var(--secondary-background-color);
    color: var(--primary-text-color);
  }
  /* Prime sur button:disabled, qui peint un fond gris : une fleche eteinte
     doit s'effacer, pas s'afficher en pave. */
  .jour-fleche:disabled {
    background: none;
    color: var(--disabled-text-color);
  }
  .jour-retour {
    background: none;
    color: var(--primary-color);
    padding: 2px 6px;
    font-size: 0.85em;
    border-radius: 4px;
  }
  .jour-retour:hover {
    background: var(--secondary-background-color);
  }
  .jour-date {
    font-weight: 500;
    color: var(--primary-text-color);
    text-transform: capitalize;
  }
  .jour-bornes {
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
  }
  /* La matiere et ses pastilles sur une ligne, le detail dessous. Un nom de
     professeur fait facilement trente caracteres : sur la largeur d'une
     colonne de section, mis a la suite de la matiere, il repoussait les
     pastilles hors du champ visible. */
  .jour-tete {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
  }
  .jour-detail {
    color: var(--secondary-text-color);
    font-size: 0.9em;
    width: 100%;
  }
  .jour-ligne {
    display: grid;
    /* Les horaires, puis le filet, puis le corps. Deux chiffres, deux points,
       deux chiffres : 4,5em tient « 08:00 » sans que la police du thème
       puisse le tronquer. La valeur réservait aussi la place d'un marqueur de
       fin déduite, retiré depuis ; elle est donc large d'un caractère, et
       c'est volontaire tant que rien ne demande de resserrer la colonne.

       Le filet est ici un SEPARATEUR entre l'heure et la matière, et c'est la
       seule carte des six où il ne borde pas la ligne. Le propriétaire a
       demandé les deux placements l'un après l'autre et a tranché pour
       celui-ci : sur cette carte la colonne d'horaires est un repère qu'on
       lit seul — « il est où, là ? » — et un filet posé à sa gauche colorait
       l'heure autant que la matière, alors que la couleur ne qualifie que la
       seconde. Placé entre les deux, il dit à quoi la couleur appartient.

       L'uniformité des six cartes n'est donc pas totale, et c'est assumé : la
       gouttière qualifie une ligne de liste, ce filet-ci sépare deux colonnes
       dont une seule est colorée. Ne le ramenez pas à gauche pour aligner les
       cartes entre elles — ça a été fait, puis défait. */
    grid-template-columns: 4.5em 4px 1fr;
    gap: 10px;
    align-items: stretch;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider-color);
  }
  .jour-ligne:last-child {
    border-bottom: none;
  }
  .jour-heures {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: var(--secondary-text-color);
    font-size: 0.9em;
    font-variant-numeric: tabular-nums;
    line-height: 1.35;
  }
  /* Le filet. Sa couleur vient du serveur ou de la table de l'utilisateur, et
     elle arrive par la propriété personnalisée --pronote-subject-color, comme
     sur les cinq autres cartes. La carte écrivait auparavant un fond en style
     en ligne : même rendu, mais un second mécanisme pour la même chose, donc
     un endroit de plus où le filtrage de la valeur pouvait divorcer.

     Le repli est une variable de thème, jamais une couleur écrite ici. Un
     ACCENT et non un aplat : il situe et décore, il ne porte aucune
     information à lui seul — les horaires, l'intitulé et les pastilles
     informent. */
  .jour-filet {
    border-radius: 2px;
    background: var(--pronote-subject-color, var(--divider-color));
  }
  /* La variante neutre reste une CLASSE et non le seul repli de la variable.
     Elle dit explicitement « cette ligne n'a pas de couleur de matière », ce
     qu'une propriété simplement absente ne dit à personne — ni au test qui
     distingue les deux cas, ni à celui qui inspecte le DOM en cherchant
     pourquoi une matière est grise.

     Le sélecteur porte les DEUX classes, et ce n'est pas de la cosmétique.
     Écrit sur la seule classe neutre, il avait la même spécificité que la
     règle du filet et ne gagnait que par son rang dans le fichier. Or
     --pronote-subject-color est une propriété HERITEE : un thème qui la pose
     plus haut dans l'arbre, plus un déplacement de bloc, et toutes les
     matières sans couleur se coloreraient — silencieusement, le pire genre.
     Deux classes suffisent à ne plus dépendre de l'ordre. */
  .jour-filet.jour-filet-neutre {
    background: var(--divider-color);
  }
  .jour-corps {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    min-width: 0;
  }
  .jour-matiere {
    font-weight: 500;
    color: var(--primary-text-color);
  }
  .jour-pastilles {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-left: auto;
  }
  /* Le cours en cours. Le fond secondaire du thème, pas une couleur écrite
     ici : la mise en avant doit survivre à un thème sombre comme à un thème
     clair.

     Un commentaire antérieur parlait d'un fond « dérivé de la couleur
     d'accent du thème ». C'était faux — la variable employée est le fond
     secondaire, qui n'a rien à voir avec l'accent — et la phrase valait
     surtout parce qu'elle laissait croire à un contraste garanti.

     Ce que cette mise en avant ne fait PAS, et qu'il faut savoir avant de s'y
     fier : sur un thème sombre l'écart entre ce fond et celui de la carte est
     de l'ordre de 1,05:1, donc elle est pratiquement invisible. Et c'est le
     SEUL marqueur du créneau en cours : ni texte, ni pastille, ni ARIA. Un
     lecteur d'écran n'en apprend rien du tout. */
  .jour-courant {
    background: var(--secondary-background-color);
    border-radius: 6px;
  }
  /* La zone repas. Volontairement discrète et en italique : ce n'est pas un
     cours, et le libellé est une convention de l'utilisateur — pas une
     affirmation du module sur ce que fait l'élève à cette heure-là. */
  .jour-repas .jour-matiere {
    font-weight: 400;
    font-style: italic;
    color: var(--secondary-text-color);
  }
  .jour-repas .jour-filet {
    background: repeating-linear-gradient(
      to bottom,
      var(--divider-color) 0 4px,
      transparent 4px 8px
    );
  }

  /* Photo et lignes d'identité côte à côte. Un flux flex plutôt qu'un
     flottement, qui se comporte mal dès qu'une ligne est plus haute que la
     photo. */
  .ident {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .ident-body {
    flex: 1 1 auto;
    min-width: 0;
  }
`;
