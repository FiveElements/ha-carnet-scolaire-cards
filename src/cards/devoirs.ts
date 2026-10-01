import { html, type TemplateResult } from 'lit';
import type {
  CardSpec,
  EntityKey,
  CarnetCardConfig,
  RenderCtx,
  Translate,
} from '../core/types';
import { chip, emptyState, listRow } from '../core/ui/parts';
import { listAttr, sortedBy } from '../core/list';
import { DATE_SEULE, formatDayLabel, parseTimestamp, plainText } from '../core/format';
import { subjectAccent } from '../core/subject-color';
import { dateTimeFormat } from '../core/intl';
import { CLE_PIECE, champ, instanceOrigin, openAttachment, openableUrl } from '../core/attachments';

/** Ce qu'on montre selon l'état du devoir. */
type Statut = 'todo' | 'all';
/**
 * Ce qu'on montre selon l'échéance. « Aujourd'hui et après », « demain et
 * après » et « 7 prochains jours » écartent les devoirs en retard — le
 * bandeau de retard, lui, reste, puisqu'il compte à part.
 */
type Periode = 'all' | 'from_today' | 'tomorrow' | 'from_tomorrow' | 'week';

interface Config extends CarnetCardConfig {
  /**
   * L'ancien filtre unique, qui mêlait deux questions : l'état du devoir
   * (« à faire ») et son échéance (« pour demain »). On ne pouvait donc pas
   * demander « à faire, pour demain ». Remplacé par `status` et `period`,
   * indépendants, et toujours lu pour qu'aucun tableau de bord existant ne
   * change d'aspect : voir `statutOf` et `periodeOf`.
   */
  filter?: 'todo' | 'tomorrow' | 'all';
  status?: Statut;
  period?: Periode;
  group_by?: 'date' | 'subject';
  limit?: number;
  /**
   * Table matière → couleur, renseignée par l'utilisateur.
   *
   * C'est le **deuxième** rang de couleur, et un secours : `subjectAccent`
   * préfère la couleur du serveur, que l'intégration publie désormais sur
   * chaque devoir (`background_color`). Cette table ne sert donc plus qu'à
   * colorer une matière que l'établissement laisse vide, ou à remplacer une
   * teinte illisible dans un thème.
   *
   * Le commentaire précédent affirmait l'inverse : que l'intégration « ne la
   * publie pas encore » et que cette table était le seul rang qui produise
   * quelque chose. C'était vrai à l'écriture et faux depuis, ce qui est le
   * pire état pour un commentaire : il conseillait de remplir la table alors
   * que le premier rang gagne partout. Mesuré le 10 septembre 2026 sur une
   * instance — les vingt devoirs portent `background_color`, en hexadécimal
   * strict, six teintes distinctes. La page de documentation, elle, était à
   * jour : elle datait la bascule de la version 0.0.13 de l'intégration.
   *
   * Absente du formulaire d'éditeur, et pour une raison : aucun sélecteur
   * `ha-form` ne rend correctement un dictionnaire ouvert dont les clés sont
   * les matières de l'établissement. En YAML, l'utilisateur a au moins la
   * coloration syntaxique de Home Assistant.
   */
  subject_colors?: Record<string, string>;
  /**
   * Nombre de lignes d'énoncé avant repli. Absente ou zéro : aucun repli.
   *
   * L'énoncé est le **contenu** de cette carte, pas sa décoration : le
   * tronquer par défaut cacherait la moitié d'un devoir à quelqu'un qui ne
   * sait pas qu'il y a une moitié cachée. D'où une option, et non un
   * comportement.
   *
   * Ce qui la rend acceptable est que le repli **se signale tout seul** :
   * `-webkit-line-clamp` peint des points de suspension, et seulement quand
   * le texte déborde réellement. Le bloc est un `details` : le lecteur le
   * déplie d'un clic ou d'une touche, et le texte entier reste dans le DOM
   * pendant qu'il est replié.
   *
   * Mesuré le 10 septembre 2026 sur une instance : les énoncés vont jusqu'à
   * 313 caractères, un seul d'entre eux occupait 161 pixels, et la carte
   * atteignait 1 376 pixels pour quinze devoirs. C'est ce qui a motivé
   * l'option, et c'est aussi ce que `size` doit avouer.
   */
  max_lines?: number;
  /**
   * Afficher les pièces jointes d'un devoir. Vrai par défaut.
   *
   * L'intégration publie `attachments` sur chaque devoir, et la carte l'a
   * ignoré pendant onze versions. Mesuré le 10 septembre 2026 : douze pièces
   * réparties sur neuf devoirs des vingt, deux au plus par devoir, des
   * chaînes de treize à trente-neuf caractères dont huit portent une
   * extension de fichier. Un devoir qui demande d'ouvrir un document ne le
   * disait donc pas.
   *
   * **Aujourd'hui ce sont des noms seuls, et cette limite n'est pas la
   * nôtre.** Aucune des douze pièces mesurées ne contient de schéma, ni
   * `://`, ni même une barre oblique, et une recherche d'adresse sur les
   * soixante-sept entités de l'intégration n'en trouve aucune. PRONOTE, lui,
   * a l'adresse : son interface web sert chaque pièce par un lien dont le
   * libellé porte le titre du document — l'adresse et le nom y sont deux
   * champs distincts, et l'intégration ne transmet que le second.
   *
   * **Et il y a deux sortes de pièces, ce qui décide tout.** Établi le
   * 10 septembre 2026 par la session de l'intégration, dans la source de la
   * bibliothèque, pas par lecture d'une adresse :
   *
   * - une pièce de type **lien** porte son adresse telle quelle, stable et
   *   sans secret : publiable, et un lien vers elle vivra ;
   * - une pièce de type **fichier** n'a pas d'adresse stable du tout. Le
   *   long jeton de son chemin n'identifie pas le document : c'est son
   *   numéro chiffré avec la clé **et** le vecteur de la session en cours,
   *   suivi d'un paramètre de session. Deux liens vers le même document
   *   depuis deux sessions n'ont aucun octet commun. Une telle adresse est
   *   morte à la connexion suivante, et l'intégration abandonne une session
   *   inactive au bout d'une heure — donc l'horizon est l'heure.
   *
   * Ce que ça change ici : « un lien qui échouerait silencieusement »
   * n'était pas un risque à pondérer pour un fichier, c'était le résultat
   * garanti. La carte ne peut pas distinguer les deux — elle reçoit une
   * adresse ou rien — et n'a pas à le faire : ce qui arrive dans
   * `attachments` est la décision de l'intégration, et elle a déjà choisi de
   * ne rien publier plutôt que de publier ce qui périme.
   *
   * La carte est donc prête et attend la donnée : `attachmentsOf` accepte la
   * forme `{ name, url }`, et un nom devient un lien dès qu'une adresse
   * arrive, sans qu'une ligne d'ici change.
   *
   * **Depuis le 10 septembre 2026 au soir, les liens existent.** Mesuré sur
   * l'instance : quatre pièces ouvrables sur douze, adressées par
   * `attachment_links` sur chaque devoir, vers des hôtes publics collés par
   * des professeurs. La carte les rend, et une pastille dont le nom figure
   * dans cette liste est une ancre.
   *
   * Cette clé avait d'abord été posée comme un palier de mesure, et j'avais
   * écrit ici que la carte ne la lirait pas : l'intégration comptait déplacer
   * les adresses dans `attachments` si la clé se remplissait. La mesure a
   * inversé l'arbitrage plutôt que de le confirmer, et pour une raison qui
   * vaut d'être retenue : tant que « zéro lien » restait plausible, déplacer
   * coûtait une rupture de forme pour rien. Les liens existant, le choix
   * devient une ligne ici contre une rupture pour tous les lecteurs de
   * `attachments`, qui porte des chaînes depuis l'origine. Une ligne ici
   * coûte moins cher, et c'est ce que la carte fait.
   *
   * Un précédent commentaire affirmait à cet endroit qu'ouvrir une pièce
   * « demanderait un appel de service, interdit au rendu ». C'était faux, et
   * doublement : un `href` n'appelle aucun service, et le projet n'interdit
   * pas de suivre un lien. Ce qui manque n'est pas une permission, c'est la
   * donnée. Une limite écrite parce qu'elle arrange n'est pas une limite.
   *
   * Ce que la prudence impose en revanche, et qui est réel : le schéma est
   * filtré par `openableUrl`, parce que cette valeur vient du serveur et
   * atterrit dans un attribut `href`. Et une adresse de pièce jointe ouvre le
   * document **sans demander d'identifiant** — elle se traite donc comme
   * l'URL iCal : sa place n'est ni dans le dépôt, ni dans la documentation,
   * ni dans une capture d'écran.
   *
   * Deux formes d'adresse arrivent, et elles n'ont pas le même propriétaire.
   * Une pièce de type **lien** porte une adresse absolue chez un tiers, que
   * la carte ouvre directement. Une pièce de type **fichier** n'a pas
   * d'adresse stable côté PRONOTE ; l'intégration en publie une **chez elle**,
   * un chemin enraciné et signé qu'elle relaie. `openableUrl` admet donc
   * l'enraciné, et seulement s'il reste sur l'origine du tableau de bord.
   *
   * Ce qui reste refusé est l'adresse sans schéma ni barre oblique initiale.
   * Le refus vaut comme **garde**, pas comme cas attendu : l'intégration n'en
   * publie pas, et le présenter comme la forme normale inviterait à « réparer »
   * la carte en résolvant contre un hôte deviné.
   */
  show_attachments?: boolean;
}

interface Homework {
  id?: string;
  subject?: string;
  /** L'énoncé tel que PRONOTE l'envoie : du HTML, balises et entités comprises. */
  description?: string;
  /**
   * Le même énoncé en texte simple, publié par l'intégration.
   *
   * C'est la bonne source : la conversion appartient au module qui SAIT que
   * le champ est du HTML, sinon trois cartes donnent trois réponses
   * différentes au même `&amp;amp;`. `plainText` reste le repli, pour les
   * installations dont l'intégration est antérieure à ce champ.
   */
  description_text?: string;
  due?: string;
  done?: boolean;
  /**
   * La couleur de la matière (`CouleurFond`), le même code visuel que sur
   * l'emploi du temps. `unknown` : chaîne de serveur, filtrée par
   * `subjectColor` avant d'atteindre un attribut `style`.
   */
  background_color?: unknown;
  /**
   * Les pièces jointes du devoir, telles que l'intégration les publie.
   *
   * `unknown` et non `string[]` : mesurées comme des chaînes le 10 septembre
   * 2026 — douze pièces, aucune vide, aucune adresse — mais rien ne l'impose
   * à l'exécution, et `FORMES.md` retient la leçon inverse : trois des
   * défauts les plus coûteux de ce dépôt viennent d'une forme supposée.
   * `attachmentsOf` filtre, plutôt que le type promettre.
   */
  attachments?: unknown;
  /**
   * Les pièces **ouvrables** du devoir, `[{ name, url }]`.
   *
   * Une seconde liste, et non une adresse ajoutée dans `attachments` : celle-ci
   * porte des chaînes depuis l'origine, et y mettre des objets casserait tout
   * gabarit qui la joint par des virgules — ce qui est la façon normale
   * d'écrire une notification. L'intégration a pesé ce coût contre une ligne
   * ici, et une ligne ici coûte moins cher.
   *
   * Le rapprochement se fait par le **nom**, la même chaîne dans les deux
   * listes. Une pièce dont le nom y figure devient un lien ; les autres
   * restent du texte, et c'est le cas courant — mesuré le 10 septembre 2026 :
   * quatre pièces ouvrables sur douze, sur quatre devoirs de vingt. Les huit
   * autres sont des fichiers, dont l'adresse est un artefact de session que
   * l'intégration ne publie donc pas.
   *
   * Ce compte est une propriété des devoirs de la quinzaine, pas de
   * l'établissement : une semaine sans lien rend cette liste vide, ce qui
   * n'est pas une panne.
   */
  attachment_links?: unknown;
  /**
   * `[{ name, kind: "external", url } | { name, kind: "local", key }]`, la
   * forme qui remplace `attachment_links`. Voir `refsOf`.
   */
  attachment_refs?: unknown;
}

const TODO: EntityKey = 'sensor:homework_todo';
const TOMORROW: EntityKey = 'sensor:homework_tomorrow';
const ALL: EntityKey = 'sensor:homework';
const OVERDUE: EntityKey = 'binary_sensor:homework_overdue';
const TODO_LIST: EntityKey = 'todo:homework';
/**
 * Le calendrier des devoirs. Trois entités distinctes portent le même
 * `translation_key` sur des domaines différents — `sensor:homework`,
 * `calendar:homework` et `todo:homework` — d'où la qualification par domaine
 * de toutes les clés du projet.
 *
 * Ce que cette entité apporte et que la liste ne peut pas montrer : la
 * prochaine échéance QUEL QUE SOIT le filtre. En mode « demain », tout ce qui
 * tombe plus tard est invisible ; le calendrier, lui, la nomme.
 */
const CALENDAR: EntityKey = 'calendar:homework';

/**
 * Bit UPDATE_TODO_ITEM de `TodoListEntityFeature`, côté Home Assistant.
 * `2` est `DELETE_TODO_ITEM` (un bit différent) : `UPDATE_TODO_ITEM` vaut `4`.
 */
const UPDATE_ITEM = 4;

const PERIODES: readonly Periode[] = ['all', 'from_today', 'tomorrow', 'from_tomorrow', 'week'];

/**
 * L'état demandé. `status` s'il est valide, sinon ce que l'ancien `filter`
 * voulait dire : « pour demain » et « tous » montraient les devoirs faits,
 * « à faire » — et l'absence de filtre, qui valait « à faire » — non.
 */
const statutOf = (c: Config): Statut =>
  c.status === 'todo' || c.status === 'all'
    ? c.status
    : c.filter === 'tomorrow' || c.filter === 'all'
      ? 'all'
      : 'todo';

/** La période demandée. `period` si elle est valide, sinon celle de l'ancien `filter`. */
const periodeOf = (c: Config): Periode => {
  // Cherchée dans la liste plutôt que convertie : `period` vient du YAML, et
  // une valeur inconnue doit retomber sur l'ancien filtre, pas passer.
  const valide = PERIODES.find((p) => p === c.period);
  if (valide !== undefined) return valide;
  return c.filter === 'tomorrow' ? 'tomorrow' : 'all';
};

/**
 * Le capteur lu : le plus étroit qui contienne à coup sûr tout ce qu'on va
 * montrer. Le tri fin se fait ensuite ici, par `retenu`.
 *
 * Ce n'est pas une optimisation, c'est ce qui garde l'ancien comportement à
 * l'identique : les trois réglages de `filter` retombent exactement sur les
 * trois capteurs qu'ils lisaient. Et le capteur « à faire » est déjà filtré
 * par l'intégration, qui sait mieux que la carte ce qu'est un devoir fait.
 * Les trois contiennent tous l'horizon d'affichage, donc demain y est.
 */
const keyFor = (c: Config): EntityKey =>
  periodeOf(c) === 'tomorrow' ? TOMORROW : statutOf(c) === 'todo' ? TODO : ALL;

const emptyFor = (c: Config): string => {
  const periode = periodeOf(c);
  if (periode === 'tomorrow') return 'devoirs.empty_tomorrow';
  if (periode !== 'all') return 'devoirs.empty_period';
  return statutOf(c) === 'todo' ? 'devoirs.empty_todo' : 'devoirs.empty_all';
};

/** Clé de jour calendaire (AAAA-MM-JJ) dans le fuseau donné : compare des jours, pas des instants. */
/**
 * Une échéance PRONOTE est un **jour**, pas un instant, et la distinction a
 * coûté un défaut mesuré.
 *
 * `new Date('2026-09-10')` rend minuit **UTC**. Reprojeté dans un fuseau à
 * décalage négatif, ce minuit recule d'un jour : mesuré, la même échéance
 * s'affichait `10/09` à Paris et à la Réunion, et `09/09` à la Martinique, à
 * Cayenne et à Tahiti — donc **tout devoir dû aujourd'hui y était déclaré en
 * retard**. Trois départements et régions français où PRONOTE tourne, et deux
 * des quatre catalogues du dépôt visent des régions concernées.
 *
 * La correction ne consiste pas à décaler l'instant — midi UTC, la ruse
 * habituelle, casse encore à UTC+14 — mais à ne pas fabriquer d'instant du
 * tout quand la valeur est déjà un jour. `dayKey` produit du `AAAA-MM-JJ`,
 * exactement la forme de `due`, donc les deux se comparent en chaînes.
 * `DATE_SEULE` vit dans le socle (`format.ts`), qui applique la même règle à
 * `formatDayLabel` pour toutes les cartes.
 */

/** Le jour d'une échéance, sans passer par un instant si c'est déjà un jour. */
const dueDayKey = (value: string | undefined, timeZone: string): string | undefined => {
  const brut = value?.trim();
  if (brut === undefined || brut === '') return undefined;
  if (DATE_SEULE.test(brut)) return brut;
  const d = parseTimestamp(brut);
  return d === undefined ? undefined : dayKey(d, timeZone);
};

/**
 * Le libellé d'une échéance, mis en forme dans le bon fuseau : une date seule
 * est lue comme un jour par `formatDayLabel` lui-même.
 */
const dueLabelOf = formatDayLabel;

/**
 * Le jour d'un évènement de calendrier, lu dans ses attributs d'état.
 *
 * Home Assistant y publie `start_time` en **heure locale de l'instance, sans
 * décalage** (`AAAA-MM-JJ HH:MM:SS`). `new Date()` interprétait cette valeur
 * dans le fuseau du navigateur, puis la carte la reprojetait dans celui de
 * l'affichage : minuit du 15 devenait le 14 dès que les deux différaient.
 * Seul le jour sert ici, et il est écrit en tête de la valeur : on le prend
 * tel quel, comme une date seule. Une valeur avec décalage reste un instant.
 */
const HEURE_LOCALE_SANS_DECALAGE = /^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}(?::\d{2})?$/;

const calendarDayLabel = (
  value: string | undefined,
  language: string,
  timeZone: string
): string => {
  const brut = value?.trim();
  if (!brut) return '';
  const jour = HEURE_LOCALE_SANS_DECALAGE.exec(brut)?.[1];
  return formatDayLabel(jour ?? brut, language, timeZone);
};

const dayKey = (d: Date, timeZone: string): string =>
  dateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

/**
 * Un devoir est en retard si son échéance (jour calendaire) est strictement
 * avant aujourd'hui **et qu'il n'est pas fait**.
 *
 * `done` fait partie de la définition, ce n'est pas un raffinement. Un devoir
 * coché dont l'échéance est passée est le cas NORMAL — on coche après avoir
 * fait, et l'échéance passe ensuite — donc l'oublier ne produit pas un défaut
 * rare : ça produit une carte qui crie au retard sur son propre historique,
 * et d'autant plus fort que l'élève a travaillé.
 *
 * Mesuré le 10 septembre 2026 sur une instance, avec `filter: all` : neuf
 * lignes portaient la pastille pour quatre devoirs réellement en retard, et
 * les cinq de trop étaient exactement les cinq devoirs cochés. L'intégration
 * comptait quatre, elle, sur `count` de `binary_sensor:homework_overdue` —
 * donc la carte et l'intégration se contredisaient sur la même page, et
 * c'est la carte qui avait tort.
 */
/**
 * L'échéance d'un devoir en rang de tri ; sans échéance, en dernier.
 *
 * `Infinity` et non zéro : un devoir sans échéance n'est pas un devoir dû au
 * premier janvier 1970. Il passe donc après tous les autres, dans son groupe
 * comme dans la liste entière.
 */
const dueOrder = (h: Homework): number => parseTimestamp(h.due)?.getTime() ?? Infinity;

/**
 * Déplie ou replie l'énoncé du devoir dont on a cliqué la bascule.
 *
 * Une classe posée à la main sur un élément à attributs statiques, et non un
 * état de la carte. `RenderCtx` n'offre qu'un entier de curseur, et une
 * position de consultation écrite dans la configuration resterait dans le
 * YAML du tableau de bord. Lit ne réécrit pas les attributs sans liaison, donc
 * la classe survit aux rendus suivants — c'est ce que le navigateur faisait
 * pour nous avec `details`, avant qu'on découvre le coût de ce dispositif
 * pour un lecteur d'écran.
 *
 * `aria-expanded` est mis à jour ici pour la même raison : posé en attribut
 * statique dans le gabarit, il n'est plus touché par les rendus.
 */
const basculeEnonce = (event: Event): void => {
  const bouton = event.currentTarget;
  if (!(bouton instanceof HTMLElement)) return;
  const bloc = bouton.closest('.enonce');
  if (!(bloc instanceof HTMLElement)) return;
  bouton.setAttribute('aria-expanded', String(bloc.classList.toggle('deplie')));
};

/**
 * L'horloge, pour les tests seulement — même sillon que les cartes journée et
 * emploi du temps.
 *
 * Sans lui, « en retard » se compare à l'heure réelle et ne se teste pas : le
 * décalage de fuseau qui déclarait en retard tout devoir dû aujourd'hui était
 * donc **hors de portée de la suite**, et c'est ce qui l'a laissé passer.
 */
export const testClock: { now?: string } = {};

const maintenant = (): Date => parseTimestamp(testClock.now) ?? new Date();

const isOverdue = (h: Homework, timeZone: string): boolean => {
  if (h.done === true) return false;
  const jour = dueDayKey(h.due, timeZone);
  return jour !== undefined && jour < dayKey(maintenant(), timeZone);
};

/**
 * Le jour `n` jours après `cle`, en `AAAA-MM-JJ`.
 *
 * Calculé en UTC sur la date seule, jamais en ajoutant 24 heures à un
 * instant : un passage à l'heure d'été ferait sauter ou doubler un jour.
 */
const decalerJour = (cle: string, n: number): string => {
  const d = new Date(`${cle}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Le devoir passe-t-il les deux filtres ?
 *
 * Tout se compare en jours calendaires du fuseau de la carte, comme le
 * retard. Un devoir sans échéance lisible ne tombe dans aucune période
 * datée : on ne peut pas dire qu'il est pour demain.
 */
const retenu = (h: Homework, statut: Statut, periode: Periode, timeZone: string): boolean => {
  if (statut === 'todo' && h.done === true) return false;
  if (periode === 'all') return true;
  const jour = dueDayKey(h.due, timeZone);
  if (jour === undefined) return false;
  const aujourdhui = dayKey(maintenant(), timeZone);
  const demain = decalerJour(aujourdhui, 1);
  switch (periode) {
    case 'from_today':
      return jour >= aujourdhui;
    case 'tomorrow':
      return jour === demain;
    case 'from_tomorrow':
      return jour >= demain;
    default:
      // 'week' : aujourd'hui et les six jours suivants.
      return jour >= aujourdhui && jour <= decalerJour(aujourdhui, 6);
  }
};

/**
 * `limit` absent ou négatif = tout ; `limit: 0` = rien.
 *
 * Et « rien » a besoin d'être DIT, avec ses propres mots : voir la garde
 * `devoirs.limit_zero` dans `render`. Zéro devoir affiché parce que la limite
 * vaut zéro n'est pas zéro devoir à faire.
 */
const truncate = <T>(items: T[], limit: number | undefined): T[] =>
  limit === undefined || limit < 0 ? items : items.slice(0, limit);

/**
 * Largeur supposée d'une ligne d'énoncé, en caractères.
 *
 * **Cette constante est un compromis, pas une garantie**, et le commentaire
 * qu'elle portait affirmait le contraire. Il disait que l'erreur allait
 * toujours dans le sens sûr — sous-estimer le nombre de lignes, donc replier
 * moins souvent qu'il ne faudrait. C'est vrai sur une carte étroite et faux
 * sur une carte large, parce que le nombre de caractères par ligne dépend de
 * la largeur, que la carte ne connaît pas au moment où elle décide.
 *
 * Mesuré le 10 septembre 2026 sur une instance, avec `max_lines: 3` et les
 * mêmes vingt devoirs à trois largeurs :
 *
 * | largeur | caractères par ligne | replis | débordent | replis inutiles |
 * |---|---|---|---|---|
 * | 380 px | 54 | 6 | 6 | 0 |
 * | 700 px | 104 | 6 | 4 | 2 |
 * | 1100 px | 168 | 6 | 3 | 3 |
 *
 * Le seuil de 80 place donc le point de bascule vers 550 pixels. En dessous,
 * l'erreur est bien du bon côté : la carte est plus haute qu'elle n'aurait
 * besoin, ça se voit et ça ne trompe personne. Au-dessus, elle replie des
 * énoncés qui tenaient déjà, et pose un bloc dépliable qui ne cache rien.
 *
 * Ce que ce défaut résiduel coûte, pour qu'on puisse en juger plutôt que le
 * craindre : le canal visuel reste **exact** quelle que soit la largeur, les
 * points de suspension étant peints par le navigateur et seulement en cas de
 * débordement réel. Un énoncé replié pour rien s'affiche donc en entier,
 * sans marque. Seule la sémantique se trompe : un lecteur d'écran annonce un
 * bloc dépliable, et l'ouvrir ne révèle rien de plus.
 *
 * Aucune constante ne peut supprimer ça, et c'est le point : à 380 pixels un
 * énoncé de 288 caractères occupe cinq lignes et doit se replier, à 1100 il
 * en occupe deux et ne doit pas. **La décision dépend vraiment de la
 * largeur.** La corriger demande de la mesurer, donc de la faire remonter
 * jusqu'à `RenderCtx` — un changement de socle, pas un réglage de carte.
 *
 * Aucune mesure du DOM ici, et c'est délibéré : la largeur réelle n'existe
 * qu'après rendu, et la lire déclencherait un calcul de mise en page à chaque
 * évènement de la maison, multiplié par le nombre de devoirs.
 */
const CHARS_PAR_LIGNE = 80;

/**
 * Le nombre de lignes qu'un énoncé occupera, au plus bas.
 *
 * Les retours à la ligne comptent : `plainText` en pose de vrais, et
 * `white-space: pre-line` les rend. Un énoncé de cent caractères sur six
 * lignes occupe six lignes, pas deux — un simple compte de caractères
 * l'aurait manqué, et c'est la forme la plus courante d'un énoncé en liste.
 */
const lignesEstimees = (texte: string): number =>
  texte
    .split('\n')
    .reduce((total, ligne) => total + Math.max(1, Math.ceil(ligne.length / CHARS_PAR_LIGNE)), 0);

/**
 * Une pièce jointe : son nom, son adresse, au moins l'un des deux.
 *
 * `name` est optionnel, et le cas est réel. Une pièce jointe PRONOTE
 * s'atteint par un chemin qui se termine par « link » suivi d'un paramètre
 * de session ; son titre vit ailleurs, dans le libellé du lien. Le chemin ne
 * porte donc **aucun** nom de document, et une carte qui afficherait son
 * dernier segment écrirait « link » sous chaque devoir.
 */
interface Attachment {
  name?: string;
  url?: string;
  /**
   * L'empreinte d'une pièce de type fichier, publiée à la place de son
   * adresse. Elle n'ouvre rien seule : c'est ce que la carte présente au
   * service `get_attachment_url` au moment du clic, pour obtenir une adresse
   * signée qui n'a jamais figuré dans un attribut.
   */
  key?: string;
}

/**
 * Les pièces du devoir selon `attachment_refs`, la forme qui remplace
 * `attachment_links` depuis que l'intégration ne publie plus d'adresse
 * signée dans un attribut.
 *
 * Deux genres, et ils n'ont pas le même propriétaire :
 *
 * - `external` : un lien collé par un professeur, vers un tiers. L'adresse
 *   reste dans l'attribut, et c'est un choix de l'intégration que j'ai
 *   contesté puis mesuré : sur l'instance, aucune des adresses de ce genre ne
 *   pointait vers l'établissement ni ne portait de paramètre de session. Ce
 *   n'est pas un secret que nous frappons, et la carte peut ainsi l'ouvrir
 *   sans aller-retour. Elle doit être **absolue** : un chemin enraciné est
 *   le relais de l'intégration, qui ne passe plus par ici.
 * - `local` : un fichier. Seule l'empreinte est publiée ; l'adresse se
 *   demande au clic.
 *
 * Un genre inconnu se rend comme un nom muet. Une intégration plus récente
 * pourrait en publier un que cette carte ne sait pas ouvrir : se taire est
 * correct, deviner ne l'est pas.
 *
 * `undefined` quand l'attribut est absent, pour que l'appelant retombe sur
 * l'ancienne forme pendant le décalage de versions. Une liste vide, elle,
 * est une réponse : l'intégration dit qu'il n'y a pas de pièce.
 */
const refsOf = (value: unknown, origine: string | undefined): Attachment[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const out: Attachment[] = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue;
    const brut = champ(item, 'name');
    const name = typeof brut === 'string' && brut.trim() !== '' ? brut.trim() : undefined;
    const kind = champ(item, 'kind');
    let piece: Attachment | undefined;
    if (kind === 'external') {
      const adresse = champ(item, 'url');
      const enracinee = typeof adresse === 'string' && adresse.trim().startsWith('/');
      const url = enracinee ? undefined : openableUrl(adresse, origine);
      if (url !== undefined) piece = { ...(name === undefined ? {} : { name }), url };
    } else if (kind === 'local') {
      const key = champ(item, 'key');
      if (typeof key === 'string' && CLE_PIECE.test(key)) {
        piece = { ...(name === undefined ? {} : { name }), key };
      }
    }
    if (piece !== undefined) out.push(piece);
    else if (name !== undefined) out.push({ name });
  }
  return out;
};


/**
 * Le nom à montrer pour une adresse, **ou rien**.
 *
 * Le dernier segment de chemin, décodé, et seulement s'il ressemble à un nom
 * de fichier — c'est-à-dire s'il porte une extension. Sinon rien, et
 * l'appelant met un libellé générique.
 *
 * La condition d'extension n'est pas un raffinement, elle vient d'une adresse
 * réelle : le chemin d'une pièce jointe PRONOTE finit par « link ». Sans
 * elle, la carte affichait « link » comme nom de document, ce qui est pire
 * que muet.
 */
const nameFromUrl = (href: string): string | undefined => {
  try {
    const segments = new URL(href).pathname.split('/').filter((part) => part !== '');
    const last = segments[segments.length - 1];
    if (last === undefined) return undefined;
    const decoded = decodeURIComponent(last);
    return /\.[A-Za-z0-9]{1,8}$/.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Les pièces jointes utilisables d'un devoir, débarrassées du reste.
 *
 * **Deux formes sont acceptées, et une seule existe aujourd'hui.** Mesuré le
 * 10 septembre 2026 sur une instance : les douze pièces sont des chaînes
 * portant un **nom seul** — aucune ne contient de schéma, ni `://`, ni même
 * une barre oblique, et une recherche d'adresse sur les soixante-sept
 * entités de l'intégration n'en a trouvé aucune. La carte ne peut donc pas
 * ouvrir une pièce : l'adresse ne lui parvient pas.
 *
 * La forme objet est acceptée d'avance parce que c'est celle qui résoudrait
 * le problème : le jour où l'intégration publiera `{ name, url }`, les noms
 * deviennent des liens sans qu'une ligne de cette carte change. Les
 * variantes de nom de champ couvrent ce qu'une intégration écrit
 * naturellement, sans qu'on ait à deviner juste du premier coup.
 *
 * Tout ce qui ne donne pas un nom est écarté, et une liste qui n'en contient
 * aucun n'affiche rien — pas de ligne vide annonçant des pièces absentes.
 */

/**
 * Les pièces d'un devoir, chaque nom porté par son adresse quand elle existe.
 *
 * L'intégration publie deux listes : les noms de toutes les pièces, et les
 * seules pièces ouvrables sous la forme `{ name, url }`. Le rapprochement se
 * fait par le nom, qui est la même chaîne des deux côtés.
 *
 * L'ordre est celui de `attachments`, parce que c'est celui que PRONOTE
 * envoie ; un tri par ouvrabilité ferait bouger les pastilles d'un devoir
 * à l'autre sans qu'aucun lecteur puisse le prévoir.
 *
 * Un lien dont le nom ne figure dans aucun nom est ajouté à la fin plutôt que
 * jeté. Le contrat dit que ça n'arrive pas ; s'il se rompt un jour, perdre
 * une pièce qui s'ouvre serait le pire des deux résultats possibles.
 *
 * **La faiblesse connue du rapprochement par le nom**, signalée par
 * l'intégration plutôt que découverte ici : si un même devoir porte deux
 * pièces de même nom dont une seule est ouvrable, le nom ne les distingue
 * plus et les deux pastilles deviennent des ancres vers la même adresse.
 * C'est le prix assumé de ne pas rompre la forme de `attachments`, et il se
 * paie ici, à l'affichage. Ne pas « corriger ça » en n'ouvrant que la
 * première : rien ne dit que c'est elle. Le doublon est un cas dégénéré,
 * pas une liste ordonnée.
 */
const piecesOf = (h: Homework, origine: string | undefined): Attachment[] => {
  // La forme nouvelle prime dès qu'elle est là, et `attachment_links` n'est
  // alors plus lu du tout, même s'il est encore publié pendant sa version de
  // dépréciation : c'est la forme qui porte le jeton qu'on cherche à retirer.
  const refs = refsOf(h.attachment_refs, origine);
  const noms = attachmentsOf(h.attachments, origine);
  if (refs !== undefined) {
    // L'intégration retire des refs une pièce qu'elle ne sait pas ouvrir
    // (OPAQUE), et ne la nomme plus que dans `attachments`. Lire les refs
    // seules faisait oublier au devoir qu'il portait un document : les noms
    // absents des refs reviennent en pastilles muettes. On décompte par nom,
    // pour qu'une pièce nommée des deux côtés ne s'affiche pas deux fois.
    const restants = new Map<string, number>();
    for (const piece of refs) {
      if (piece.name !== undefined) restants.set(piece.name, (restants.get(piece.name) ?? 0) + 1);
    }
    const absentes: Attachment[] = [];
    for (const piece of noms) {
      if (piece.name === undefined) continue;
      const reste = restants.get(piece.name) ?? 0;
      if (reste > 0) restants.set(piece.name, reste - 1);
      else absentes.push({ name: piece.name });
    }
    return [...refs, ...absentes];
  }
  const liens = attachmentsOf(h.attachment_links, origine);
  if (liens.length === 0) return noms;
  const adresseDe = new Map<string, string>();
  for (const lien of liens) {
    if (lien.name !== undefined && lien.url !== undefined) adresseDe.set(lien.name, lien.url);
  }
  // Seuls les noms DEFINIS entrent dans l'ensemble. Le construire sur le
  // champ optionnel y faisait entrer `undefined` des qu'une piece n'avait pas
  // de nom, et la boucle de rattrapage ecartait alors TOUT lien sans nom --
  // c'est-a-dire exactement le cas que le commentaire ci-dessus declare
  // eviter. Le trou etait inatteignable avec les donnees mesurees, ou les
  // deux listes portent toujours le nom des deux cotes ; il n'en etait pas
  // moins une contradiction entre le code et sa propre promesse.
  const nommees = new Set(
    noms.map((piece) => piece.name).filter((nom): nom is string => nom !== undefined)
  );
  const out = noms.map((piece) => {
    const url = piece.name === undefined ? undefined : adresseDe.get(piece.name);
    return url === undefined || piece.name === undefined ? piece : { name: piece.name, url };
  });
  for (const lien of liens) {
    if (lien.name !== undefined && nommees.has(lien.name)) continue;
    // Un lien anonyme ne peut jamais avoir ete rapproche : la table est
    // indexee par nom. On le garde, sans le doubler s'il pointe la ou une
    // piece pointe deja.
    if (lien.name === undefined && out.some((piece) => piece.url === lien.url)) continue;
    out.push(lien);
  }
  return out;
};

const attachmentsOf = (value: unknown, origine: string | undefined): Attachment[] => {
  if (!Array.isArray(value)) return [];
  const out: Attachment[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed === '') continue;
      const url = openableUrl(trimmed, origine);
      if (url === undefined) {
        out.push({ name: trimmed });
        continue;
      }
      const derive = nameFromUrl(url);
      out.push(derive === undefined ? { url } : { name: derive, url });
      continue;
    }
    if (item === null || typeof item !== 'object') continue;
    const url = openableUrl(champ(item, 'url', 'href', 'link'), origine);
    const brut = champ(item, 'name', 'filename', 'title', 'label');
    const name =
      typeof brut === 'string' && brut.trim() !== ''
        ? brut.trim()
        : url === undefined
          ? undefined
          : nameFromUrl(url);
    // Au moins l'un des deux, sinon il n'y a rien à montrer ni à ouvrir.
    if (name === undefined && url === undefined) continue;
    if (name === undefined) out.push({ url });
    else if (url === undefined) out.push({ name });
    else out.push({ name, url });
  }
  return out;
};


/** `max_lines`, en entier positif, ou zéro pour « pas de repli ». */
const maxLinesOf = (value: unknown): number => {
  const lines = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof lines !== 'number' || !Number.isFinite(lines)) return 0;
  return Math.max(0, Math.trunc(lines));
};

interface Group {
  label: string;
  items: Homework[];
}

/**
 * Regroupe une liste déjà triée par le même critère : les éléments qui
 * partagent la même clé de regroupement se suivent donc dans le tableau, et
 * l'ordre d'apparition des groupes suit l'ordre du tri.
 */
const groupOf = (
  items: Homework[],
  by: 'date' | 'subject',
  timeZone: string,
  language: string
): Group[] => {
  const groups: Group[] = [];
  const index = new Map<string, Group>();
  for (const h of items) {
    const label =
      by === 'subject'
        ? (h.subject ?? '—')
        : h.due
          ? dueLabelOf(h.due, language, timeZone) || '—'
          : '—';
    let g = index.get(label);
    if (!g) {
      g = { label, items: [] };
      index.set(label, g);
      groups.push(g);
    }
    g.items.push(h);
  }
  return groups;
};

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-devoirs',
  name: 'Carnet scolaire — Devoirs',
  description: 'Les devoirs à faire, avec échéance et matière.',
  key: 'devoirs',
  scope: 'child',
  // « En retard » et les périodes (demain, 7 prochains jours…) se comptent en
  // jours depuis Date.now(). La nuit, aucune collecte n'a lieu, donc aucun
  // état d'entité ne change : sans repeint périodique, un tableau de bord
  // laissé ouvert affichait encore au réveil le « demain » de la veille. Une
  // minute suffit, le socle pose et retire lui-même la minuterie.
  tickMs: 60_000,
  /**
   * La hauteur annoncée à Home Assistant, qui s'en sert pour équilibrer les
   * colonnes d'une vue en maconnerie.
   *
   * Elle valait **5** — soit environ 250 pixels — pour une carte mesurée le
   * 10 septembre 2026 à **1 376 pixels** avec le filtre « à faire » et
   * **1 647** avec « tous ». Un facteur cinq, et le plus large écart du
   * dépôt : c'est la carte la plus haute des onze, et elle s'annonçait
   * comme l'une des plus courtes.
   *
   * Ce que cette fonction ne peut pas faire, et qu'il faut savoir avant de
   * chercher à l'affiner : la hauteur dépend surtout de la LONGUEUR des
   * énoncés, qui est une donnée et non une configuration. `size` ne reçoit
   * que la configuration. Les nombres par filtre ci-dessous sont donc des
   * ordres de grandeur relevés sur une instance, pas des vérités : six
   * devoirs pour « demain », quinze à faire, vingt en tout. Un `limit`
   * explicite, lui, est exact et le remplace.
   *
   * Rester approximatif et honnête vaut mieux que précis et faux : Home
   * Assistant n'a besoin que d'un classement entre cartes.
   */
  size: (c: Config) => {
    const periode = periodeOf(c);
    const devoirs =
      c.limit !== undefined && c.limit >= 0
        ? c.limit
        : periode === 'tomorrow'
          ? 6
          : periode === 'week'
            ? 10
            : statutOf(c) === 'all'
              ? 20
              : 15;
    /**
     * Le coût d'un devoir, en **centièmes** d'unité.
     *
     * Déplié : près de deux unités, soit environ 32 pixels de cadre et de
     * titre plus dix-sept par ligne d'énoncé, pour une moyenne mesurée à
     * deux lignes et huit. Replié : ce que ses lignes coûtent, et jamais
     * plus que déplié — replier ne peut que raccourcir.
     *
     * En entiers, et pas en décimaux, parce que la première version l'était
     * et que ça se voyait : `0.65 + 3 * 0.35` vaut 1.6999999999999997,
     * donc quinze devoirs donnaient 27.499999999999996 et `Math.round`
     * rendait **27** là où l'arithmétique exacte dit 27,5 et donc 28. Un
     * écart d'une unité sans importance en soi, mais qui rendait le résultat
     * dépendant de l'erreur de représentation : impossible à prédire de
     * tête, donc impossible à documenter juste. Une session voisine l'a
     * d'ailleurs calculé à 28 pour sa page, de bonne foi.
     */
    const maxLines = maxLinesOf(c.max_lines);
    const parDevoir = maxLines > 0 ? Math.min(190, 65 + maxLines * 35) : 190;
    // Le plancher de trois couvre `limit: 0`, qui ne rend qu'une phrase.
    return Math.max(3, Math.round((200 + devoirs * parDevoir) / 100));
  },
  stub: { status: 'todo', period: 'all', group_by: 'date' },
  requires: (c) => [keyFor(c)],
  optional: () => [OVERDUE, TODO_LIST, CALENDAR],
  schema: (_config: Config, t?: Translate) => [
    // Deux listes indépendantes, là où `filter` en mêlait deux. L'ancien
    // champ n'est plus proposé, mais reste lu : un YAML qui le porte garde
    // son aspect, et le formulaire le remplace dès qu'on touche l'un des deux.
    {
      name: 'status',
      selector: {
        select: {
          mode: 'dropdown',
          options: [
            { value: 'todo', label: t ? t('devoirs.status_todo') : 'À faire' },
            { value: 'all', label: t ? t('devoirs.status_all') : 'Tous' },
          ],
        },
      },
    },
    {
      name: 'period',
      selector: {
        select: {
          mode: 'dropdown',
          options: PERIODES.map((value) => ({
            value,
            label: t ? t(`devoirs.period_${value}`) : value,
          })),
        },
      },
    },
    {
      name: 'group_by',
      selector: {
        select: {
          mode: 'dropdown',
          options: [
            { value: 'date', label: t ? t('devoirs.group_date') : 'Échéance' },
            { value: 'subject', label: t ? t('devoirs.group_subject') : 'Matière' },
          ],
        },
      },
    },
    { name: 'limit', selector: { number: { min: 1, max: 50, mode: 'box' } } },
    // Une borne basse à 2 : replier à une seule ligne ne laisse pas assez
    // d'énoncé pour reconnaître le devoir. Le zéro du YAML reste accepté par
    // `maxLinesOf` et vaut « pas de repli », mais le formulaire ne le
    // propose pas : il a un interrupteur pour ça, l'option vide.
    { name: 'max_lines', selector: { number: { min: 2, max: 20, step: 1, mode: 'box' } } },
    { name: 'show_attachments', selector: { boolean: {} } },
  ],
  render(ctx: RenderCtx<Config>) {
    const key = keyFor(ctx.config);
    const statut = statutOf(ctx.config);
    const periode = periodeOf(ctx.config);
    // Le capteur « à faire » a déjà trié l'état, et c'est l'intégration qui
    // fait foi : un devoir qu'elle y laisse s'affiche, comme avant l'arrivée
    // des deux filtres. La carte ne retrie l'état que sur les capteurs qui ne
    // l'ont pas fait — « pour demain » et « tous ».
    const statutATrier: Statut = key === TODO ? 'all' : statut;
    const raw = listAttr<Homework>(ctx.attr(key, 'items')).filter((h) =>
      retenu(h, statutATrier, periode, ctx.timeZone)
    );

    /**
     * La prochaine échéance vue par le calendrier.
     *
     * Seuls les ATTRIBUTS de l'entité sont lus. Obtenir la liste complète de
     * ses évènements demanderait un appel de service — donc une collecte au
     * rendu, que le projet interdit, et que le type `AllowedCall` refuse de
     * toute façon à la compilation.
     *
     * Affichée seulement quand elle ajoute quelque chose : avec le filtre
     * « tous », la liste montre déjà tout, et la ligne ne ferait que répéter
     * sa première entrée.
     */
    const nextDue = ((): TemplateResult | '' => {
      if ((statut === 'all' && periode === 'all') || ctx.status(CALENDAR) !== 'ok') return '';
      const message = ctx.attr<string>(CALENDAR, 'message');
      // Le calendrier garde les devoirs faits, préfixés de « ✅ », et ses
      // attributs ne décrivent que son PREMIER évènement. En mode « à faire »,
      // un premier évènement fait n'est pas la prochaine échéance, et les
      // attributs ne disent pas laquelle l'est : la ligne se tait plutôt que
      // de nommer un devoir déjà rendu.
      if (statut === 'todo' && message?.startsWith('✅')) return '';
      const when = calendarDayLabel(
        ctx.attr<string>(CALENDAR, 'start_time'),
        ctx.language,
        ctx.timeZone
      );
      // Un calendrier sans évènement à venir ne porte ni intitulé ni date :
      // il se tait, plutôt que d'afficher une ligne creuse.
      if (!message && !when) return '';
      return listRow({
        primary: ctx.t('devoirs.next_due'),
        secondary: message,
        trailing: when || undefined,
        // La gouttière est réservée sans être colorée : cette ligne n'est pas
        // une matière, mais la liste est désormais codée par couleur et une
        // ligne sans gouttière se décalerait de neuf pixels vers la gauche.
        // Voir `RowOptions.accent`, troisième valeur.
        accent: null,
      });
    })();

    const maxLines = maxLinesOf(ctx.config.max_lines);
    const by = ctx.config.group_by ?? 'date';
    /**
     * Groupé par matière, l'échéance départage à matière égale.
     *
     * Le comparateur ne portait que sur la matière, donc à matière égale
     * l'ordre restait celui du serveur. Mesuré le 10 septembre 2026 sur une
     * instance, `group_by: subject` : dans un groupe de six lignes, les
     * échéances sortaient 4, 7, 8, **21**, 11, 11 septembre — le devoir du 21
     * au-dessus de celui du 11. Dans un autre de cinq lignes, 7, 11, 7, 7, 11.
     *
     * Or c'est le seul mode où la ligne porte sa date, donc le seul où
     * l'ordre chronologique dit quelque chose : on ouvre un groupe de matière
     * pour savoir ce qui tombe d'abord. Un parent devait lire les six dates
     * et les comparer de tête.
     *
     * La langue passe à `localeCompare`, et ce n'est pas décoratif. Sans
     * argument, la méthode prend la langue du **moteur** — c'est-à-dire du
     * navigateur, mesuré à `fr-FR` sur l'instance — et non celle de Home
     * Assistant. L'ordre dépendait donc du réglage de chaque visiteur :
     * mesuré, `['Åke', 'Zoologie', 'Örjan', 'Anglais']` se range
     * Åke/Anglais/Örjan/Zoologie en français et Anglais/Zoologie/Åke/Örjan en
     * suédois. Deux habitants de la maison voyaient deux ordres. Avec la
     * langue de l'instance, l'ordre est une propriété de la maison.
     *
     * Rien à craindre pour `Intl` ici : cette même valeur alimente déjà
     * `formatDayLabel`, donc une langue qu'`Intl` refuserait ferait tomber la
     * carte bien avant ce tri. La valeur piégeuse du socle est
     * `hass.locale.time_zone`, pas `hass.language`.
     */
    const sorted = sortedBy(raw, (a, b) => {
      if (by !== 'subject') return dueOrder(a) - dueOrder(b);
      const matiere = (a.subject ?? '').localeCompare(b.subject ?? '', ctx.language);
      return matiere !== 0 ? matiere : dueOrder(a) - dueOrder(b);
    });

    const limited = truncate(sorted, ctx.config.limit);
    // Calculée une fois : c'est la base contre laquelle un chemin enraciné se
    // résout, et elle vaut pour toute la carte.
    const origineInstance = instanceOrigin(ctx.hass);
    const appareil = typeof ctx.config.device_id === 'string' ? ctx.config.device_id : '';
    /** Une pièce s'ouvre si elle a une adresse, ou une empreinte ET un appareil à qui la présenter. */
    const ouvrable = (piece: Attachment): boolean =>
      piece.url !== undefined || (piece.key !== undefined && appareil !== '');

    /**
     * Ouvre une pièce de type fichier : demande son adresse au service, au
     * clic, et jamais avant.
     *
     * **L'onglet s'ouvre AVANT l'appel**, vide, puis reçoit l'adresse. Dans
     * l'ordre inverse, `window.open` arrive après un `await` et n'est plus
     * rattaché au geste de l'utilisateur : Safari le bloque sans un mot, et
     * Chrome ne le tolère que quelques secondes. Ouvrir d'abord, c'est le seul
     * ordre qui marche partout.
     *
     * `noopener` ne peut pas se passer à l'ouverture — `window.open` rendrait
     * alors `null`, et on n'aurait plus d'onglet à diriger. On coupe donc le
     * lien à la main, avant d'y écrire quoi que ce soit.
     *
     * L'adresse rendue repasse par `openableUrl`, exactement comme celle d'un
     * attribut : elle vient du serveur, et elle va dans une barre d'adresse.
     * Elle n'est retenue nulle part — ni en mémoire, ni dans le rendu — et
     * c'est voulu : elle expire en cinq minutes, et un second clic en frappe
     * une autre.
     *
     * Un échec se dit dans la ligne, sous les pastilles, dans une région
     * `role="status"` que le gabarit rend vide et que Lit ne réécrit pas.
     */
    const ouvrirPiece = async (cle: string, bouton: HTMLButtonElement): Promise<void> => {
      const etat = bouton.closest('.devoirs-pieces')?.querySelector('.devoirs-piece-etat');
      if (etat) etat.textContent = '';
      bouton.disabled = true;
      let message: string | undefined;
      try {
        message = await openAttachment(
          ctx,
          appareil,
          cle,
          origineInstance,
          {
            notCollected: ctx.t('devoirs.attachment_not_collected'),
            unknown: ctx.t('devoirs.attachment_unknown'),
            failed: ctx.t('devoirs.attachment_failed'),
            blocked: ctx.t('devoirs.attachment_blocked'),
          }
        );
      } finally {
        bouton.disabled = false;
      }
      if (etat && message !== undefined) etat.textContent = message;
    };

    const overdueOn = ctx.entity(OVERDUE)?.state === 'on';
    /**
     * Le nombre de devoirs en retard, que l'intégration publie et que cette
     * carte jetait.
     *
     * « en retard » tout court laissait le lecteur sans le seul chiffre qui
     * dise s'il faut s'en occuper ce soir. Il compte d'autant plus avec le
     * filtre « pour demain » : le bandeau est alors le seul endroit d'où
     * l'information arrive, aucune ligne visible ne portant de retard.
     *
     * Le repli sur le libellé nu couvre une intégration antérieure à
     * l'attribut. La condition porte sur « strictement positif » et non sur
     * « présent » : un zéro publié pendant que l'état vaut `on` est une
     * contradiction de l'intégration, et « 0 en retard » sur un bandeau
     * rouge serait la façon la plus sûre de la rendre illisible.
     *
     * Les quatre traductions emploient une locution **invariable** — « en
     * retard », « con retraso », « in ritardo », « em atraso » — pour
     * qu'une seule forme serve tous les comptes. L'espagnol l'imposait :
     * l'adjectif du libellé nu, « atrasado », s'accorde, donc ni le
     * singulier ni le pluriel n'aurait convenu aux deux.
     */
    const overdueCount = ctx.attr<number>(OVERDUE, 'count');
    const overdueLabel =
      typeof overdueCount === 'number' && Number.isFinite(overdueCount) && overdueCount > 0
        ? ctx.t('devoirs.overdue_count', { count: overdueCount })
        : ctx.t('devoirs.overdue');
    // Passe par `listRow` plutôt que par un `div` de classe `row` écrit ici :
    // la bannière doit réserver la gouttière comme les lignes de devoir, et
    // `listRow` est le seul endroit qui sache la poser.
    const overdueBanner = overdueOn
      ? listRow({ primary: chip(overdueLabel, 'problem'), accent: null })
      : '';

    /**
     * L'état vide, **après** le bandeau de retard et la prochaine échéance.
     *
     * Le retour était placé avant le calcul du bandeau, donc une liste vide
     * l'effaçait — et avec le filtre « pour demain » la carte affichait
     * « Rien à rendre demain » au-dessus de quatre devoirs en retard. C'est
     * la configuration d'un vendredi soir, d'un week-end ou d'un jour férié :
     * pas un cas de coin, mais le cas le plus fréquent de ce filtre.
     *
     * **Une fausse mise en sécurité est le pire genre de défaut** pour une
     * carte dont tout l'objet est de dire ce qui reste à faire. Et le
     * commentaire de `nextDue` disait déjà pourquoi : ces deux éléments ne
     * dépendent pas de la liste affichée, et c'est vide qu'ils servent le
     * plus. Le raisonnement était juste et n'avait été appliqué qu'à la
     * prochaine échéance.
     *
     * Le chemin voisin de `limit: 0` gardait le bandeau, lui : les deux
     * chemins « zéro ligne » se contredisaient, ce qui aurait dû suffire à
     * signaler qu'un des deux avait tort.
     */
    if (raw.length === 0) {
      return html`${overdueBanner}${nextDue}${emptyState(ctx.t(emptyFor(ctx.config)))}`;
    }

    /**
     * `limit: 0` : la liste n'est pas vide, c'est l'affichage qui est à zéro.
     *
     * Sans cette garde la carte rendait une **coquille** : ni titre, ni ligne,
     * ni message. Mesuré le 10 septembre 2026 — quatre-vingt-neuf pixels
     * portant la seule pastille « en retard » et la ligne de prochaine
     * échéance, au-dessus de quinze devoirs invisibles et inexpliqués.
     *
     * Et le message d'état vide ordinaire ne convient pas : « rien à faire »
     * au-dessus de quinze devoirs à faire serait FAUX, du même genre que le
     * retard qui ignorait `done`. D'où une phrase à elle, qui nomme la cause
     * au lieu de la cacher — c'est la seule façon de rendre l'option
     * réversible pour qui l'a posée sans y penser.
     *
     * La bannière et la prochaine échéance restent : elles ne dépendent pas de
     * la liste affichée, et c'est ici qu'elles sont le plus utiles.
     */
    if (limited.length === 0) {
      return html`${overdueBanner}${nextDue}${emptyState(ctx.t('devoirs.limit_zero'))}`;
    }

    // La coche n'existe que si l'intégration annonce l'écriture. On lit la
    // capacité, on ne la suppose pas.
    const todoId = ctx.entityId(TODO_LIST);
    const features = ctx.attr<number>(TODO_LIST, 'supported_features') ?? 0;
    const writable = Boolean(todoId) && (features & UPDATE_ITEM) !== 0;

    // Le devoir se désigne côté service par son `id`, qui est l'`uid` de
    // l'entité todo, et par rien d'autre. Le repli sur l'énoncé ne désignait
    // rien : l'entité nomme un élément par son `uid` ou par son `summary`,
    // qui est la matière. Un devoir sans `id` n'a donc pas de case. L'appel ne
    // part jamais du rendu, uniquement d'une action de l'utilisateur (voir
    // @change ci-dessous).
    const toggle = async (item: Homework, checkbox: HTMLInputElement): Promise<void> => {
      const itemRef = item.id;
      if (!todoId || !itemRef) return;
      const status = checkbox.checked ? 'completed' : 'needs_action';
      try {
        await ctx.callService('todo.update_item', { item: itemRef, status }, { entity_id: todoId });
      } catch {
        // L'appel a échoué : la case ne doit pas mentir sur l'état réel.
        checkbox.checked = !checkbox.checked;
      }
    };

    const rowFor = (h: Homework): TemplateResult => {
      const overdue = isOverdue(h, ctx.timeZone);
      /**
       * **Chaque niveau dit ce qui le distingue, et rien de plus.**
       *
       * Une seule règle, appliquée deux fois : ce que l'intertitre porte
       * déjà, la ligne ne le répète pas. Groupée par échéance, la ligne dit
       * la matière ; groupée par matière, elle dit l'échéance.
       *
       * Les deux moitiés ont été mesurées séparément, et la seconde était
       * pire. Groupée par échéance, le 10 septembre 2026 : quinze lignes sur
       * dix-sept dont la fin reprenait mot pour mot le titre juste au-dessus.
       * Groupée par matière, le 11 septembre 2026 : **vingt lignes sur
       * vingt**, soit la totalité — le titre de bloc et le titre de ligne
       * étaient la même chaîne, sans exception. Le propriétaire l'a signalé,
       * et le défaut était le symétrique exact de celui déjà corrigé dans
       * l'autre sens : la règle avait été écrite pour un cas au lieu d'être
       * écrite comme règle.
       *
       * L'échéance garde son gabarit (« pour le 11 septembre ») plutôt que
       * la date nue : en tête de ligne, une date seule ne dit pas de quoi
       * elle est la date, et cette carte en porte deux notions (rendu et
       * retard).
       */
      const dateLisible = h.due ? dueLabelOf(h.due, ctx.language, ctx.timeZone) : '';
      const titreLigne =
        by === 'subject'
          ? dateLisible
            ? ctx.t('devoirs.due', { date: dateLisible })
            : ctx.t('devoirs.name')
          : (h.subject ?? ctx.t('devoirs.name'));
      // La couleur de matière est une gouttière à gauche, comme sur les cinq
      // autres cartes qui portent une matière. Voir `RowOptions.accent` pour
      // ses trois valeurs, et la règle `.row.empile` de `styles.ts` pour les
      // deux dispositifs que ce placement a annulés.
      const accent = subjectAccent(h.background_color, h.subject, ctx.config.subject_colors);
      // `description_text` vide retombe sur le HTML, et ce n'est pas un
      // raffinement : `??` ne se replie que sur l'absence, alors que
      // `plainText` traite déjà la chaîne vide comme une absence. Un devoir
      // publiant `description_text: ''` à côté d'un `description` lisible
      // rendait donc la matière et **rien** en dessous.
      const publie = typeof h.description_text === 'string' ? h.description_text : '';
      const enonce = publie.trim() === '' ? plainText(h.description) : publie;
      const replie = maxLines > 0 && lignesEstimees(enonce) > maxLines;
      const pieces = piecesOf(h, origineInstance);
      const piecesOn = ctx.config.show_attachments !== false && pieces.length > 0;
      /**
       * L'énoncé replié : du **texte**, et une bascule à côté.
       *
       * C'était un `details` dont le `summary` contenait tout l'énoncé, et le
       * navigateur retenait l'état sans qu'on ait rien à stocker. Mesuré le
       * 10 septembre 2026 : **269 caractères de nom accessible** et **zéro**
       * caractère hors du `summary`. Un lecteur d'écran entendait donc
       * l'énoncé entier comme le libellé d'un bouton, suivi de « replié »,
       * puis déplier ne lui révélait rien : l'affordance mentait sur sa
       * nature.
       *
       * Le texte redevient du texte. Il n'est jamais perdu pour un lecteur
       * d'écran — la coupe est faite par `overflow`, qui n'ôte rien de l'arbre
       * d'accessibilité — donc la bascule ne lui apporte rien et n'a pas à se
       * faire passer pour ce qu'elle n'est pas : c'est un contrôle visuel, au
       * libellé court, dont `aria-expanded` dit honnêtement l'état.
       *
       * Les deux libellés sont rendus et un seul est visible. Écrire le texte
       * du bouton à la main sur un clic serait écrasé au prochain rendu.
       */
      const enonceRendu = replie
        ? html`<span class="enonce" style="--pronote-max-lines: ${maxLines}"
            ><span class="enonce-corps">${enonce}</span
            ><button
              type="button"
              class="enonce-bascule"
              aria-expanded="false"
              @click=${basculeEnonce}
            >
              <span class="enonce-deplier">${ctx.t('devoirs.enonce_deplier')}</span
              ><span class="enonce-replier">${ctx.t('devoirs.enonce_replier')}</span>
            </button></span
          >`
        : enonce;
      /**
       * L'énoncé, puis les pièces jointes — **hors** du bloc repliable.
       *
       * Un devoir dont l'énoncé est replié doit continuer à dire qu'il porte
       * un document : c'est justement le devoir dont on risque de ne lire que
       * les trois premières lignes.
       *
       * Des **pastilles**, une par pièce, et non le gabarit de l'interface
       * web de PRONOTE : le propriétaire a explicitement laissé le choix de
       * la forme, le 10 septembre 2026, en demandant l'intégration adaptée à
       * Home Assistant plutôt que celle du site.
       *
       * La pastille est déjà le vocabulaire de quatre cartes d'ici — rien
       * n'est inventé — elle tire ses couleurs des variables du thème, et
       * elle donne une cible de clic prenable au doigt, ce qu'un nom précédé
       * d'un tiret n'était pas.
       *
       * Le libellé « Pièces jointes : » a disparu avec : il coûtait une ligne
       * entière et ne portait rien qu'un nom de fichier dans une pastille ne
       * porte déjà. Il survit en **nom accessible du groupe**, sur
       * `aria-label`, pour qu'un lecteur d'écran sache de quoi ces pastilles
       * sont la liste au lieu de les énumérer sans les nommer.
       *
       * `role="list"` sur des `span` plutôt qu'un `ul` : `listRow` enveloppe
       * `secondary` dans un `span`, et un `ul` dedans serait une imbrication
       * invalide. Les rôles donnent la même sémantique à un lecteur d'écran
       * — « liste de deux éléments » — sans produire du HTML fautif. Le rôle
       * d'élément vit sur l'enveloppe et non sur la pastille : posé sur une
       * ancre, il aurait remplacé son rôle de lien.
       *
       * `undefined` quand il n'y a ni énoncé ni pièce : `listRow` teste la
       * présence de `secondary`, et un gabarit est toujours vrai.
       */
      const secondary =
        enonce === '' && !piecesOn
          ? undefined
          : html`${enonceRendu}${
              piecesOn
                ? html`<span
                    class="devoirs-pieces"
                    role="list"
                    aria-label=${
                      pieces.length === 1
                        ? ctx.t('devoirs.attachments_one')
                        : ctx.t('devoirs.attachments_many')
                    }
                  >
                    ${pieces.map((piece) => {
                      // Un nom lisible, ou un libelle generique. Une adresse
                      // de piece jointe PRONOTE ne porte pas le titre du
                      // document dans son chemin : sans ce repli, un lien
                      // sans nom se serait rendu VIDE, donc invisible et
                      // pourtant present -- Lit n'ecrit rien pour
                      // `undefined`, et aucun type ne l'aurait signale.
                      const libelle = piece.name ?? ctx.t('devoirs.attachment_open');
                      // La pastille n'est pas produite par `chip()` : cette
                      // primitive rend un `span`, et une piece ouvrable doit
                      // etre une ancre. Les deux portent la meme classe, donc
                      // le meme style, sans dupliquer la regle.
                      //
                      // La raison pour laquelle un fichier ne s'ouvre pas
                      // etait posee en `title` sur cette pastille. Retiree :
                      // il n'y a pas de survol au doigt, et un `span` n'est
                      // pas focalisable, donc le dispositif ne repondait qu'a
                      // la souris -- sur telephone, qui est la cible de ce
                      // projet, les cinq pastilles muettes restaient
                      // inexpliquees. La phrase est desormais rendue UNE
                      // fois sous le groupe, en texte, quand au moins une
                      // piece n'est pas ouvrable.
                      return html`<span class="devoirs-piece" role="listitem"
                        >${
                          piece.key !== undefined && appareil !== ''
                            ? html`<button
                                type="button"
                                class="chip chip-lien chip-demande"
                                @click=${(event: Event): void => {
                                  const bouton = event.currentTarget;
                                  if (bouton instanceof HTMLButtonElement && piece.key) {
                                    void ouvrirPiece(piece.key, bouton);
                                  }
                                }}
                              >
                                ${libelle}
                              </button>`
                            : piece.url === undefined
                            ? html`<span class="chip">${libelle}</span>`
                            : html`<a
                                class="chip chip-lien"
                                href=${piece.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                >${libelle}</a
                              >`
                        }</span
                      >`;
                    })}
                    ${
                      pieces.some((piece) => piece.key !== undefined && appareil !== '')
                        ? html`<span class="devoirs-piece-etat" role="status"></span>`
                        : ''
                    }
                  </span>`
                : ''
            }`;
      return html`
        ${listRow({
          // La matière TITRE le bloc, elle n'occupe plus une colonne à sa
          // gauche : c'est l'énoncé qui est le contenu de la carte, et une
          // colonne de matière le comprimait à 132 pixels sur une carte de
          // 420. Le bloc lui rend toute la largeur.
          stacked: true,
          accent: accent ?? null,
          primary: html`
            ${
              writable && h.id
                ? html`<input
                    type="checkbox"
                    .checked=${h.done === true}
                    @change=${(event: Event): void => {
                      const target = event.currentTarget;
                      if (target instanceof HTMLInputElement) void toggle(h, target);
                    }}
                  />`
                : ''
            }
            ${titreLigne}
          `,
          // Le texte simple publié par l'intégration s'il existe, sinon
          // l'énoncé HTML dévêtu ici — jamais injecté. Replié seulement s'il
          // dépasse vraiment, et suivi de ses pièces jointes : voir plus haut.
          secondary,
          // `undefined` et non un gabarit vide : `listRow` teste la
          // présence de `trailing`, et un `TemplateResult` est toujours vrai
          // — chaque ligne sans retard aurait donc posé une boîte vide dans la
          // tête du bloc.
          //
          // La fin de ligne ne porte plus que le retard. L'échéance en est
          // partie : elle titre la ligne quand le bloc est groupé par
          // matière, et elle titre le bloc sinon — dans les deux cas elle est
          // déjà dite une fois.
          trailing: overdue ? html`${chip(ctx.t('devoirs.overdue'), 'problem')}` : undefined,
        })}
      `;
    };

    /**
     * Une note, **une seule fois par carte**, quand au moins une pièce
     * affichée ne s'ouvre pas.
     *
     * La même phrase était posée en `title` sur chaque pastille muette. Elle
     * ne répondait qu'à la souris : il n'y a pas de survol au doigt, et un
     * `span` n'est pas focalisable. Sur téléphone — la cible de ce projet —
     * cinq pastilles sur huit restaient donc inexpliquées, ce qui est
     * exactement la conclusion que l'infobulle devait empêcher.
     *
     * Une fois par carte et non par devoir : l'information se lit une fois.
     * Répétée sous chaque devoir porteur, elle coûterait plusieurs lignes
     * pour rien.
     *
     * Elle nomme le repère visuel — le soulignement — plutôt que de décrire
     * une catégorie que le lecteur ne peut pas distinguer autrement.
     */
    const noteFichiers =
      ctx.config.show_attachments !== false &&
      limited.some((h) => piecesOf(h, origineInstance).some((piece) => !ouvrable(piece)))
        ? html`<div class="notice">${ctx.t('devoirs.attachment_not_openable')}</div>`
        : '';

    const groups = groupOf(limited, by, ctx.timeZone, ctx.language);
    const out: (TemplateResult | string)[] = [overdueBanner, nextDue];
    for (const g of groups) {
      // `role="heading"` et un niveau : sans ça, les sept intertitres d'une
      // carte groupée par jour étaient sept `div` de texte nu, et un lecteur
      // d'écran ne pouvait pas sauter d'un jour au suivant — il traversait les
      // vingt énoncés en linéaire. Mesuré : sept intertitres, zéro titre.
      //
      // Niveau 3, parce que le titre de la carte est le niveau au-dessus et
      // qu'une vue Home Assistant porte déjà son propre titre. Un `h3` réel
      // aurait été préférable, mais la classe `title` porte les styles
      // d'en-tête de carte : changer la balise ici sans toucher à la feuille
      // partagée aurait donné des marges de titre HTML par-dessus. Le rôle
      // règle la sémantique sans rien changer à la peinture.
      out.push(html`<div class="title" role="heading" aria-level="3">${g.label}</div>`);
      // Les lignes d'un jour ne sont plus enveloppées. L'enveloppe existait
      // pour leur faire partager une colonne de matière de largeur unique ;
      // il n'y a plus de colonne de matière, la matière titre son bloc.
      out.push(html`${g.items.map((h) => rowFor(h))}`);
    }

    out.push(noteFichiers);
    return html`${out}`;
  },
};
