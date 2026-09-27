import { html, nothing, type TemplateResult } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx, Translate } from '../core/types';
import { formatDayLabel, formatTime, parseTimestamp } from '../core/format';
import { chip, emptyState } from '../core/ui/parts';
import { listAttr, sortedBy } from '../core/list';
import { isCanceled, statusLabel, teachersOf, type Lesson } from '../core/lesson';
import { subjectAccent } from '../core/subject-color';
import { dateTimeFormat } from '../core/intl';

/**
 * La journée en grille : un filet de couleur, une colonne d'horaires, la
 * matière.
 *
 * C'est un portage d'apparence d'une carte de l'ancien format. Elle
 * ouvre sur **aujourd'hui**, et deux flèches permettent de parcourir les
 * autres jours de la semaine déjà collectée. Pas de sélecteur de semaine :
 * au-delà de la fenêtre collectée il n'y a rien à afficher, et la carte
 * emploi du temps rend déjà la semaine d'un seul tenant.
 *
 * Cinq éléments constituent le seuil d'acceptation, nommés par l'utilisateur :
 * l'heure de début **et** de fin, le filet de couleur, l'intitulé de matière,
 * le barré avec sa pastille sur un cours annulé, et la zone repas.
 *
 * S'y ajoutent, demandés ensuite : la **salle** et le **professeur** sur
 * chaque créneau, un **en-tête** portant la date et les bornes de la journée
 * de classe, et la **navigation** d'un jour à l'autre. Tous se désactivent,
 * aucun n'est requis pour que la carte ait un sens.
 *
 * ## La navigation ne coûte aucune requête
 *
 * C'est la seule raison pour laquelle elle est acceptable ici. `Client.lessons()`
 * facture à la **semaine** : demander « aujourd'hui » coûte exactement le même
 * appel que demander la semaine entière, et l'intégration a replié son palier
 * hebdomadaire dans le palier emploi du temps pour cette raison. Toute la
 * semaine courante est donc déjà publiée dans l'attribut `lessons` de
 * `sensor:timetable_week` — changer de jour n'est qu'un filtre sur une liste
 * qui est en mémoire du navigateur.
 *
 * Une flèche ne déclenche donc **jamais** de collecte, et ne peut pas en
 * déclencher : la carte n'a qu'un seul appel de service à sa disposition et ne
 * s'en sert pas. Sans le capteur de semaine, les flèches n'apparaissent pas —
 * plutôt que d'aller chercher un jour qu'il faudrait payer.
 *
 * ## La position n'est pas une configuration, le décalage en est une
 *
 * Le jour **consulté** vit dans `ctx.cursor`, l'état d'interface du socle, et
 * jamais dans le YAML : un rechargement de page ramène sur le jour de repos,
 * comme une position de défilement. Ce paragraphe interdisait aussi une
 * option de jour, et l'argument qu'il donnait était à moitié faux — il
 * disait qu'une option `day: -1` afficherait « l'avant-veille le lendemain ».
 * C'est vrai d'une **date** écrite en dur ; c'est faux d'un **décalage
 * relatif**, qui est recalculé à chaque repeint et désigne donc toujours la
 * veille.
 *
 * `day_offset` est ce décalage relatif, et il répond à un besoin que le
 * curseur ne peut pas servir : **plusieurs cartes côte à côte**, chacune sur
 * son jour, comme une fenêtre glissante sur la semaine. Demandé par le
 * propriétaire le 10 septembre 2026 avec cet objectif explicite.
 *
 * La distinction à garder, parce qu'elle seule justifie que l'un soit dans le
 * YAML et l'autre pas : le curseur dit **où quelqu'un a navigué**, ce qui est
 * personnel, momentané et n'a rien à faire dans une configuration partagée ;
 * `day_offset` dit **de quel jour cette carte parle**, ce qui est une
 * propriété de la carte et ne se périme jamais.
 *
 * Les deux se composent, dans cet ordre : jour de repos, puis `day_offset`
 * (l'origine **de cette carte**), puis le curseur. Les flèches partent donc
 * du jour calculé et le bouton de retour ramène à l'origine de la carte, pas
 * à aujourd'hui.
 *
 * ## Le jour de repos, et pourquoi ce n'est pas toujours aujourd'hui
 *
 * `ctx.cursor` est un **décalage en jours depuis le jour de repos**, et non
 * depuis aujourd'hui. Sans `auto_advance` les deux sont le même jour et la
 * distinction ne se voit pas ; avec, le jour de repos avance au prochain jour
 * de cours une fois la journée terminée, et `cursor` continue de compter à
 * partir de lui — c'est ce qui garde les flèches et le bouton de retour
 * cohérents.
 *
 * Deux conséquences à connaître, la seconde étant un défaut corrigé ici.
 *
 * **Un décalage dérive.** Le jour de repos est recalculé à chaque repeint :
 * quelqu'un qui consulte demain à 23 h 59 regarde après minuit le jour
 * d'après, sans avoir rien touché. C'est inhérent à un curseur relatif, et le
 * remède serait de retenir une clé de jour plutôt qu'un entier — donc de
 * demander au socle un état qu'il ne donne pas, délibérément.
 *
 * **Mais une dérive ne doit pas sortir de la fenêtre collectée.** C'était le
 * vrai défaut : poussé au-delà du dernier jour collecté, le curseur faisait
 * afficher « aucun cours ce jour-là » pour une date dont la carte ne sait
 * **rien**. C'est la seule affirmation fausse que cette carte puisse produire,
 * et les commentaires de `stepTo` disaient déjà qu'il fallait l'empêcher — la
 * flèche était bornée, le curseur ne l'était pas. Un curseur qui pointe hors
 * fenêtre revient donc au jour de repos.
 */

interface Config extends CarnetCardConfig {
  /**
   * Table matière → couleur, renseignée par l'utilisateur.
   *
   * C'est le **deuxième** rang de couleur. Le premier produit depuis la
   * version 0.0.13 de l'intégration : sur les créneaux, la couleur du serveur
   * arrive et **gagne** sur cette table. Une entrée écrite pour compenser son
   * absence est donc devenue inerte, en restant dans le YAML — voir
   * `docs/couleurs-de-matiere.md`. La table reste le repli des matières que
   * l'établissement laisse sans couleur.
   *
   * Les clés sont comparées **sans casse ni espaces de bord** : PRONOTE écrit
   * souvent les matières en capitales, et personne ne devrait avoir à recopier
   * « SCIENCES VIE & TERRE » à l'identique pour obtenir une couleur.
   */
  subject_colors?: Record<string, string>;
  /** La zone repas. Active par défaut : c'est un des cinq éléments requis. */
  show_meal?: boolean;
  /** Le libellé de la zone repas. Par défaut « Repas », traduit. */
  meal_label?: string;
  /** Début de la fenêtre méridienne, `HH:MM`. Par défaut 11:00. */
  meal_from?: string;
  /** Fin de la fenêtre méridienne, `HH:MM`. Par défaut 14:30. */
  meal_to?: string;
  show_rooms?: boolean;
  show_teachers?: boolean;
  show_current?: boolean;
  /** L'en-tête : la date, et les bornes de la journée de classe. */
  show_header?: boolean;
  /**
   * Les flèches de navigation d'un jour à l'autre.
   *
   * Sans effet quand `sensor:timetable_week` n'est pas résolu : il n'y a alors
   * aucun autre jour en mémoire, et une flèche qui ne mène nulle part vaut
   * moins que pas de flèche.
   */
  show_nav?: boolean;
  /**
   * Avancer au prochain jour de cours quand la journée est finie.
   *
   * **Inactive par défaut**, et ce n'est pas de la prudence de façade : une
   * carte qui montre demain là où elle montrait aujourd'hui change ce qu'elle
   * affirme. Personne ne doit se le voir imposer par une mise à jour.
   *
   * Le déclencheur est la fin du **dernier cours** du jour affiché, plus le
   * délai de `auto_advance_after`. Un jour **sans** cours n'a pas de dernier
   * cours : il n'y a alors rien à attendre et la carte passe directement au
   * prochain jour de cours. C'est la conséquence à connaître avant d'activer
   * l'option — « aucun cours mercredi » est une information vraie, et au repos
   * on ne la verra plus. Les flèches y mènent toujours.
   *
   * L'option ne fait rien sans `sensor:timetable_week`, pour la même raison
   * que les flèches : le prochain jour de cours se lit dans la semaine déjà
   * collectée, et sauter vers un jour dont on n'a pas les données afficherait
   * une journée vide qui aurait l'air d'une journée sans cours.
   */
  auto_advance?: boolean;
  /**
   * Le délai, en minutes, entre la fin du dernier cours et le saut.
   *
   * Par défaut trente minutes. Zéro est accepté et signifie « à la sonnerie ».
   * Une valeur qui n'est pas un nombre fini positif retombe sur le défaut : ce
   * champ vient d'un YAML écrit à la main, et un `NaN` propagé dans une
   * comparaison de temps rendrait la comparaison toujours fausse — donc
   * l'option silencieusement inopérante.
   */
  auto_advance_after?: number;
  /**
   * Le jour de cette carte, en jours depuis le jour de repos.
   *
   * `0` — le défaut — ne change rien : aucune configuration existante ne
   * bouge. `1` donne le lendemain, `2` le surlendemain, `-1` la veille. Trois
   * cartes à `0`, `1` et `2` font une fenêtre glissante de trois jours.
   *
   * **Depuis le jour de repos et non depuis aujourd'hui**, et ce choix
   * mérite d'être connu parce qu'il ne se voit que dans un cas. Sans
   * `auto_advance` les deux sont le même jour, donc `1` est bien demain.
   * Avec `auto_advance`, le jour de repos avance au prochain jour de cours
   * une fois la journée finie : la fenêtre glisse alors **avec** lui, et les
   * trois cartes montrent trois jours de cours consécutifs au lieu d'en
   * répéter un. Une origine à « aujourd'hui » aurait fait que la carte à `0`
   * saute et que les autres ne sautent pas — deux cartes sur le même jour, et
   * un trou.
   *
   * Ce que ça exige de l'honnêteté de la carte : tout jour autre
   * qu'aujourd'hui se lit dans `sensor:timetable_week`. Un décalage qui
   * pointe hors de la semaine collectée — ou sans ce capteur du tout — ne
   * doit pas afficher « aucun cours ce jour-là », qui affirmerait quelque
   * chose d'une date dont la carte ne sait **rien**. Elle dit alors que le
   * jour n'est pas dans la fenêtre. C'est la seule affirmation fausse que
   * cette carte puisse produire, et une option qui désigne un jour à la main
   * est le moyen le plus direct de l'atteindre.
   *
   * La valeur vient d'un YAML écrit à la main : elle est tronquée à l'entier
   * et retombe à zéro si elle n'est pas un nombre fini. Un `NaN` propagé
   * dans un calcul de date ne produirait pas une erreur mais une date
   * invalide, donc une carte vide sans raison lisible.
   */
  day_offset?: number;
}

/**
 * Couture de test pour la mise en avant « en cours », qui dépend de
 * `Date.now()`. En variable de module et non dans `Config` : l'index de
 * signature ouvert de `CarnetCardConfig` rendrait sinon un `now:` posé dans
 * le YAML d'un tableau de bord capable de figer la mise en avant pour de bon.
 */
export const testClock: { now?: string } = {};

const LESSONS: EntityKey = 'sensor:lessons_today';
const IN_CLASS: EntityKey = 'binary_sensor:in_class';
/**
 * La semaine collectée — la seule source des autres jours.
 *
 * Optionnelle, et le rester : le palier peut être désactivé chez
 * l'utilisateur, auquel cas la carte reste exactement ce qu'elle était, sur
 * aujourd'hui. Les créneaux qu'elle porte sortent de la **même** liste
 * dédoublonnée que ceux d'aujourd'hui, en amont côté intégration : les deux
 * capteurs ne peuvent pas se contredire sur un même jour.
 */
const WEEK: EntityKey = 'sensor:timetable_week';

/**
 * Délai par défaut entre la fin du dernier cours et le saut, en minutes.
 *
 * Trente et non zéro : à la sonnerie, l'élève est encore dans l'établissement
 * et le parent qui regarde la carte cherche l'heure de sortie qu'il vient de
 * manquer. Une demi-heure laisse la journée se lire jusqu'au bout.
 */
const AUTO_ADVANCE_AFTER = 30;

/** Fenêtre méridienne par défaut, en minutes depuis minuit. */
const MEAL_FROM = 11 * 60;
const MEAL_TO = 14 * 60 + 30;

/**
 * Durée minimale d'un intervalle pour qu'il puisse être un repas.
 *
 * Une constante et non une option : dix minutes entre deux cours sont un
 * changement de salle, pas un déjeuner, et personne n'a besoin de régler ce
 * seuil. Une option de plus sur cette carte coûterait plus qu'elle
 * n'apporterait.
 */
const MEAL_MIN_MINUTES = 30;

/** `HH:MM` en minutes depuis minuit, ou `undefined` si la chaîne ne l'est pas. */
const parseClock = (value: string | undefined): number | undefined => {
  if (typeof value !== 'string') return undefined;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  return h * 60 + min;
};

/**
 * L'heure locale d'un instant, en minutes depuis minuit, **dans le fuseau de
 * la carte**.
 *
 * Passe par `Intl` et non par `getHours()`, qui rendrait l'heure du fuseau du
 * navigateur — donc une fenêtre méridienne décalée pour un utilisateur qui
 * consulte son tableau de bord depuis un autre pays. Le fuseau vient de
 * `ctx.timeZone`, que le socle a déjà traduit et validé : la préférence
 * `hass.locale.time_zone` vaut `'local'` ou `'server'` et ferait lever `Intl`.
 */
const minutesOfDay = (date: Date, timeZone: string): number => {
  const parts = dateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  const [h, m] = parts.split(':');
  return Number(h) * 60 + Number(m);
};

/* ---- Les jours ------------------------------------------------------------

   Toute la navigation se fait sur des clés de jour civil `AAAA-MM-JJ`, jamais
   sur des instants. Deux raisons :

   - un jour civil n'est pas un intervalle de 24 heures. Aux changements
     d'heure il en fait 23 ou 25, et une arithmétique en millisecondes rate
     alors le jour visé deux fois par an ;
   - la comparaison de deux clés se fait par ordre lexicographique, qui
     coïncide avec l'ordre chronologique sur ce format. C'est ce qui rend les
     bornes de la fenêtre lisibles en un coup d'oeil.

   L'arithmétique de calendrier passe par `Date.UTC`, qui ne connaît aucun
   changement d'heure : on manipule des numéros de jour, pas des durées. */

/** La clé de jour civil d'un instant, dans le fuseau de la carte. */
const dayKeyOf = (date: Date, timeZone: string): string => {
  const parts = dateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad2 = (value: number): string => String(value).padStart(2, '0');

/** La clé de jour décalée de `days` jours. */
const shiftDayKey = (key: string, days: number): string => {
  const m = DAY_KEY.exec(key);
  if (!m) return key;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

/**
 * Un instant qui tombe bien ce jour-là, dans le fuseau de la carte.
 *
 * Sert uniquement à donner une date à afficher pour un jour **sans cours** :
 * dès qu'un cours existe, son horodatage fait un meilleur ancrage que
 * n'importe quel calcul.
 *
 * Midi UTC comme point de départ, puis vérification : c'est le décalage le
 * plus robuste, mais pas un décalage sûr. Les fuseaux vont de -12 à +14, donc
 * midi UTC tombe le lendemain à Kiritimati (+14). On corrige d'un jour dans
 * l'un ou l'autre sens plutôt que de supposer, parce que se tromper ici
 * afficherait une date fausse au-dessus de créneaux justes — exactement le
 * genre d'erreur plausible que ce dépôt s'interdit.
 */
const anchorFor = (key: string, timeZone: string): string | undefined => {
  if (!DAY_KEY.test(key)) return undefined;
  const m = DAY_KEY.exec(key);
  if (!m) return undefined;
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  for (const shift of [0, -1, 1]) {
    const at = new Date(base + shift * 86_400_000);
    if (dayKeyOf(at, timeZone) === key) return at.toISOString();
  }
  return undefined;
};

/**
 * Les jours que la fenêtre collectée contient, en ordre croissant.
 *
 * Ce sont les bornes de la navigation, et elles viennent des **données**, pas
 * d'un calcul de semaine. La différence compte un jour sur sept : le lundi, la
 * veille appartient à la semaine précédente, que personne n'a collectée. Des
 * bornes calculées laisseraient la flèche active et la carte afficherait
 * « aucun cours » pour un dimanche dont elle ne sait rien — une affirmation
 * fausse, et la seule que cette carte pourrait produire.
 *
 * Un jour **sans** cours à l'intérieur de la fenêtre reste atteignable, lui,
 * et doit l'être : « aucun cours mercredi » est une information vraie et
 * utile, pas un trou à sauter.
 */
const daysOf = (lessons: Lesson[], timeZone: string): string[] => {
  const keys = new Set<string>();
  for (const lesson of lessons) {
    const at = parseTimestamp(lesson.start);
    if (at !== undefined) keys.add(dayKeyOf(at, timeZone));
  }
  return sortedBy([...keys], (a, b) => (a < b ? -1 : a > b ? 1 : 0));
};

/** Le numéro de jour d'une clé, pour compter des jours entre deux dates. */
const dayNumber = (key: string): number | undefined => {
  const m = DAY_KEY.exec(key);
  if (!m) return undefined;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
};

/**
 * La destination d'une flèche depuis le jour affiché, ou `undefined` quand il
 * n'y en a pas — auquel cas la flèche est désactivée.
 *
 * Deux comportements, et il faut les deux :
 *
 * - **à l'intérieur de la fenêtre**, on avance d'un jour civil, même vers un
 *   jour sans cours. « Aucun cours mercredi » est une information vraie, et
 *   c'est souvent celle qu'on venait chercher ;
 * - **au bord de la fenêtre**, on saute au jour collecté le plus proche dans
 *   cette direction. Sans ce rattrapage, un dimanche placé devant une semaine
 *   qui commence le mardi serait un cul-de-sac : la flèche désactivée alors
 *   que quatre jours sont en mémoire. Le cas n'est pas théorique — un lundi
 *   férié le produit.
 */
const stepTo = (from: string, delta: 1 | -1, days: string[]): string | undefined => {
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  if (firstDay === undefined || lastDay === undefined) return undefined;
  const next = shiftDayKey(from, delta);
  if (next >= firstDay && next <= lastDay) return next;
  if (delta === 1) return days.find((day) => day > from);
  const before = days.filter((day) => day < from);
  return before[before.length - 1];
};

/**
 * La salle, précédée de son mot : « Salle 2.14 » plutôt que « 2.14 ».
 *
 * Le nombre seul ne dit pas ce qu'il est. Sur une ligne où il voisine avec des
 * horaires et un nom de professeur, « 2.14 » se lit aussi bien comme une note
 * que comme une salle — et la carte notes, elle, écrit vraiment des nombres à
 * cet endroit-là. Le mot coûte cinq caractères et retire l'ambiguïté.
 *
 * Le mot vient du catalogue, jamais du code : « Aula » en italien et en
 * espagnol, « Sala » en portugais.
 *
 * **Le mot n'est pas ajouté deux fois.** Mesuré sur une instance, aucune des
 * 32 salles renseignées ne porte le mot — elles font trois ou quatre
 * caractères, chiffres et capitales. Mais le champ est du texte libre côté
 * serveur : un établissement qui écrit « SALLE 204 » ou « Salle polyvalente »
 * obtiendrait « Salle SALLE 204 », qui est plausible et faux.
 *
 * Le préfixe est déduit du catalogue en rendant le gabarit avec une salle
 * vide. Sa limite est assumée : une traduction qui placerait le mot APRÈS la
 * valeur (« 204 (aula) ») rendrait la détection inopérante, sans autre
 * conséquence que de ne plus dédoublonner.
 *
 * La comparaison passe par `fold`, en portee de module : elle ne capture rien
 * de son appelant, et la garder a l'interieur la recreait a chaque creneau
 * rendu.
 *
 * `NFD` et rien de plus, et c'est une correction : la comparaison des matières
 * retire en plus les marques combinantes (`\p{M}`), et cette fonction l'avait
 * recopié. Une mutation a montré que la ligne ne servait à rien ici — la
 * décomposition place les lettres de base AVANT leur accent, donc « Sallé 3 »
 * décomposé commence déjà par « salle ». Retirer les marques ne changerait le
 * verdict que pour un accent situé À L'INTÉRIEUR du mot, et aucun des quatre
 * catalogues n'en a un : Salle, Aula, Sala, Aula. Le test qui prétendait
 * couvrir ce repli mesurait donc `NFD`, pas le repli.
 */
const fold = (value: string): string => value.normalize('NFD').trim().toLowerCase();

const roomLabel = (value: string, t: Translate): string => {
  const room = value.trim();
  if (room === '') return '';
  const word = fold(t('journee.room', { room: '' }));
  if (word !== '' && fold(room).startsWith(word)) return room;
  return t('journee.room', { room });
};

/**
 * Le délai d'avance en millisecondes, à partir de ce que porte la
 * configuration.
 *
 * Tolérante à l'entrée et stricte à la sortie : `ha-form` rend un nombre, mais
 * un YAML écrit à la main rend ce qu'on y a mis. Une chaîne numérique est
 * acceptée — refuser `'45'` là où `45` passe serait une distinction que
 * personne ne peut voir dans un éditeur de texte — et tout le reste retombe
 * sur le défaut.
 */
const autoAdvanceDelay = (value: unknown): number => {
  const minutes = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) {
    return AUTO_ADVANCE_AFTER * 60_000;
  }
  return minutes * 60_000;
};

/**
 * `day_offset`, en entier, ou zéro.
 *
 * Même discipline qu'`autoAdvanceDelay` et pour la même raison : ce champ
 * vient du YAML. `Math.trunc` plutôt qu'une confiance dans l'appelant — un
 * `1.5` produirait une date fractionnaire, donc un libellé de jour faux
 * plutôt qu'une erreur. Les chaînes numériques sont acceptées : Home
 * Assistant en produit selon la voie d'édition.
 */
const dayOffsetOf = (value: unknown): number => {
  const days = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof days !== 'number' || !Number.isFinite(days)) return 0;
  return Math.trunc(days);
};

/** L'instant de fin le plus tardif d'un jour donné, ou `undefined`. */
const lastEndOfDay = (key: string, lessons: Lesson[], timeZone: string): number | undefined => {
  let last: number | undefined;
  for (const lesson of lessons) {
    const start = parseTimestamp(lesson.start);
    if (start === undefined || dayKeyOf(start, timeZone) !== key) continue;
    const end = parseTimestamp(lesson.end)?.getTime();
    if (end !== undefined && (last === undefined || end > last)) last = end;
  }
  return last;
};

/**
 * Le jour sur lequel la carte se repose : aujourd'hui, ou le prochain jour de
 * cours quand la journée est finie depuis assez longtemps.
 *
 * Avance de jour **collecté** en jour collecté, jamais d'un jour civil : sauter
 * sur un samedi que personne n'a collecté afficherait « aucun cours ce
 * jour-là » pour une date dont la carte ne sait rien.
 *
 * S'arrête sur le premier jour dont le dernier cours n'est pas encore terminé.
 * Un jour sans fin connue — donc sans cours — n'a rien à attendre et se
 * traverse. Et la boucle est bornée par la taille de la fenêtre et non par la
 * condition d'arrêt : une itération qui avance sur des données doit avoir une
 * borne qui ne dépend pas de ces données.
 */
const restingDay = (
  todayKey: string,
  todayEnd: number | undefined,
  now: number,
  delay: number,
  days: string[],
  lessons: Lesson[],
  timeZone: string
): string => {
  let key = todayKey;
  let end = todayEnd;
  for (let guard = 0; guard <= days.length; guard += 1) {
    if (end !== undefined && now < end + delay) return key;
    const next = days.find((day) => day > key);
    if (next === undefined) return key;
    key = next;
    end = lastEndOfDay(next, lessons, timeZone);
  }
  return key;
};

interface Bounds {
  first?: string;
  last?: string;
}

/**
 * Les bornes d'une journée, calculées comme l'intégration les calcule.
 *
 * Réservé aux jours **autres** qu'aujourd'hui : pour aujourd'hui, les bornes
 * sont publiées (`first_start`, `last_end`) et un fait publié se lit, il ne se
 * recalcule pas. Pour les autres jours rien n'est publié, alors on reprend la
 * formule à l'identique — `min(start)` et `max(end)` sur **tous** les
 * créneaux, cours annulés compris — pour que l'en-tête veuille dire la même
 * chose d'un jour à l'autre.
 */
const boundsOf = (lessons: Lesson[]): Bounds => {
  let first: number | undefined;
  let last: number | undefined;
  const out: Bounds = {};
  for (const lesson of lessons) {
    const start = parseTimestamp(lesson.start)?.getTime();
    if (start !== undefined && (first === undefined || start < first)) {
      first = start;
      out.first = lesson.start;
    }
    const end = parseTimestamp(lesson.end)?.getTime();
    if (end !== undefined && (last === undefined || end > last)) {
      last = end;
      out.last = lesson.end;
    }
  }
  return out;
};

/**
 * La fin de journée publiée est-elle une heure **déduite** ?
 *
 * L'intégration calcule `last_end` comme le `max` des fins de cours — relevé
 * dans son module de capteurs — et une fin de cours peut être déduite faute que le serveur
 * l'envoie. **L'attribut n'emporte aucun drapeau** : rien, dans `last_end`
 * seul, ne dit qu'il vient d'un calcul.
 *
 * On lit donc le fait publié comme borne — c'est lui la source — et on va
 * chercher dans la liste la réponse à une question qu'il ne porte pas. C'est
 * la limite de la règle « un fait publié se lit, ne se recalcule pas » : elle
 * suppose que le fait publié réponde à la question posée.
 *
 * La comparaison porte sur l'**instant**, pas sur la chaîne : deux
 * horodatages au même instant peuvent s'écrire différemment (`Z` contre
 * `+02:00`).
 */
const dayEndIsInferred = (lessons: Lesson[], lastEnd: string | undefined): boolean => {
  const target = parseTimestamp(lastEnd)?.getTime();
  if (target === undefined) return false;
  return lessons.some(
    (l) => l.end_inferred === true && parseTimestamp(l.end)?.getTime() === target
  );
};

interface Slot {
  kind: 'lesson' | 'meal';
  start?: string;
  end?: string;
  lesson?: Lesson;
}

/**
 * Les créneaux du jour, avec les zones repas insérées.
 *
 * Une zone repas est un **intervalle sans cours** qui recouvre la fenêtre
 * méridienne et dure au moins `MEAL_MIN_MINUTES`. Elle n'affirme rien de plus
 * que « pas de cours ici » : ni menu servi, ni présence de l'élève au
 * réfectoire. Son libellé est une convention de l'utilisateur, pas une
 * affirmation du module — c'est pourquoi il est configurable.
 */
const withMeals = (
  lessons: Lesson[],
  config: Config,
  timeZone: string
): { slots: Slot[]; mealInferred: boolean } => {
  const slots: Slot[] = [];
  let mealInferred = false;
  if (config.show_meal === false) {
    return { slots: lessons.map((lesson) => ({ kind: 'lesson', lesson })), mealInferred };
  }

  const from = parseClock(config.meal_from) ?? MEAL_FROM;
  const to = parseClock(config.meal_to) ?? MEAL_TO;

  for (const [index, lesson] of lessons.entries()) {
    slots.push({ kind: 'lesson', lesson });

    const next = lessons[index + 1];
    if (next === undefined) continue;

    const gapStart = parseTimestamp(lesson.end);
    const gapEnd = parseTimestamp(next.start);
    if (gapStart === undefined || gapEnd === undefined) continue;

    const minutes = (gapEnd.getTime() - gapStart.getTime()) / 60_000;
    if (minutes < MEAL_MIN_MINUTES) continue;

    // Recouvrement avec la fenêtre méridienne, dans le fuseau de la carte.
    const a = minutesOfDay(gapStart, timeZone);
    const b = minutesOfDay(gapEnd, timeZone);
    if (b <= from || a >= to) continue;

    // La borne gauche de l'intervalle est la FIN du cours précédent. Quand
    // cette fin est déduite, la position du repas l'est aussi : on le dit,
    // plutôt que de présenter un créneau calculé comme un créneau connu.
    if (lesson.end_inferred === true) mealInferred = true;

    slots.push({ kind: 'meal', start: lesson.end, end: next.start });
  }

  return { slots, mealInferred };
};

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-journee',
  name: 'Carnet scolaire — Vue journée',
  description: 'La journée en grille : horaires, couleur de matière, annulations et repas.',
  key: 'journee',
  scope: 'child',
  size: 10,
  stub: {
    show_meal: true,
    show_rooms: true,
    show_teachers: true,
    show_current: true,
    show_header: true,
    show_nav: true,
  },
  requires: () => [LESSONS],
  optional: () => [IN_CLASS, WEEK],
  // Aucun libellé posé ici : l'éditeur générique les résout sous la racine de
  // catalogue de la carte (`journee.show_meal`, `journee.meal_from`…), et
  // aucune option de cette carte n'est un choix multiple dont les valeurs
  // demanderaient d'être traduites une à une.
  //
  // `subject_colors` est délibérément absente du formulaire : aucun sélecteur
  // `ha-form` ne rend correctement un dictionnaire ouvert dont les clés sont
  // les matières de l'établissement. Un sélecteur `object` afficherait un
  // éditeur de texte brut sans validation, ce qui n'aide personne — autant
  // assumer le YAML, où l'utilisateur a la coloration syntaxique de Home
  // Assistant. La page de documentation le dit et donne l'exemple.
  schema: () => [
    { name: 'show_meal', selector: { boolean: {} } },
    { name: 'meal_label', selector: { text: {} } },
    { name: 'meal_from', selector: { text: {} } },
    { name: 'meal_to', selector: { text: {} } },
    { name: 'show_rooms', selector: { boolean: {} } },
    { name: 'show_teachers', selector: { boolean: {} } },
    { name: 'show_current', selector: { boolean: {} } },
    { name: 'show_header', selector: { boolean: {} } },
    { name: 'show_nav', selector: { boolean: {} } },
    { name: 'auto_advance', selector: { boolean: {} } },
    {
      name: 'auto_advance_after',
      selector: { number: { min: 0, max: 720, step: 5, mode: 'box' } },
    },
    // Les bornes du formulaire ne sont pas celles de l'option : le YAML
    // accepte n'importe quel entier, et un jour hors fenetre se dit plutot
    // qu'il ne se refuse. Sept jours de part et d'autre couvrent la semaine
    // collectee, qui est ce que la carte peut vraiment afficher.
    {
      name: 'day_offset',
      selector: { number: { min: -7, max: 7, step: 1, mode: 'box' } },
    },
  ],
  // La mise en avant du cours en cours se calcule sur `Date.now()` : sans
  // repeint périodique, elle désignerait un cours terminé pendant une heure
  // entière entre deux collectes PRONOTE, sans qu'aucune propriété réactive
  // ne change.
  tickMs: 60_000,
  render(ctx: RenderCtx<Config>) {
    const c = ctx.config;
    const lang = ctx.language;
    const tz = ctx.timeZone;
    // `ctx.t` enveloppee plutot que passee telle quelle : une methode detachee
    // de son objet est un vrai piege en JavaScript, et la regle de lint ne peut
    // pas savoir que `RenderCtx` est un objet simple sans `this`. La fleche
    // coute une ligne et ferme la question.
    const traduire: Translate = (path, vars) => ctx.t(path, vars);
    const clock = parseTimestamp(testClock.now) ?? new Date();
    const now = clock.getTime();

    // ---- Quel jour affiche-t-on ? ---------------------------------------
    //
    // La fenêtre n'est lue que si le capteur de semaine a un état exploitable.
    // Il est optionnel : le socle ne l'écarte pas quand il est au registre
    // sans avoir jamais été collecté, et ses attributs sont alors absents.
    const weekLessons =
      ctx.status(WEEK) === 'ok' ? listAttr<Lesson>(ctx.attr(WEEK, 'lessons')) : [];
    const days = daysOf(weekLessons, tz);
    const navOn = c.show_nav !== false && days.length > 0;
    // Un curseur sans fenêtre pour le porter retombe à zéro, plutôt que
    // d'afficher une journée vide qui aurait l'air d'une journée sans cours.
    // Le cas se produit : le palier hebdomadaire peut disparaître entre deux
    // repeints — option retirée, appareil remplacé — pendant qu'on consultait
    // la veille.
    const cursor = navOn ? ctx.cursor : 0;
    const todayKey = dayKeyOf(clock, tz);

    // Le jour de repos. `auto_advance` le déplace au prochain jour de cours
    // quand la journée est finie ; sinon c'est aujourd'hui, et rien ne change
    // pour qui n'a pas activé l'option.
    //
    // La fin d'aujourd'hui se prend d'abord sur l'attribut PUBLIÉ `last_end` :
    // il porte tous les créneaux du jour, cours annulés compris, et un fait
    // publié se lit plutôt que se recalcule. Le repli sur la fenêtre couvre le
    // cas où l'attribut manque alors que des cours existent — sans lui, un
    // attribut absent ferait sauter une journée entière de cours.
    const published = parseTimestamp(ctx.attr<string>(LESSONS, 'last_end'))?.getTime();
    const baseKey =
      c.auto_advance === true && days.length > 0
        ? restingDay(
            todayKey,
            published ?? lastEndOfDay(todayKey, weekLessons, tz),
            now,
            autoAdvanceDelay(c.auto_advance_after),
            days,
            weekLessons,
            tz
          )
        : todayKey;

    // L'origine DE CETTE CARTE : le jour de repos décalé de `day_offset`.
    // C'est elle, et non le jour de repos, qui sert de zéro au curseur — sans
    // quoi les flèches d'une carte « demain » repartiraient d'aujourd'hui et
    // le bouton de retour la ramènerait sur le jour d'une autre carte.
    const offset = dayOffsetOf(c.day_offset);
    const originKey = offset === 0 ? baseKey : shiftDayKey(baseKey, offset);

    // Le curseur est un décalage : il dérive quand l'origine bouge sous lui,
    // à minuit comme à l'heure du saut. Hors de la fenêtre collectée, il
    // ferait afficher « aucun cours ce jour-là » pour une date inconnue de la
    // carte — alors retour à l'origine. À l'origine (`cursor` nul) on ne
    // borne rien ici : un dimanche hors fenêtre est un jour légitime à
    // afficher, et le cas du décalage est traité plus bas, avec une phrase
    // plutôt qu'un repli silencieux.
    const first = days[0];
    const last = days[days.length - 1];
    const wanted = shiftDayKey(originKey, cursor);
    const drifted =
      cursor !== 0 &&
      first !== undefined &&
      last !== undefined &&
      (wanted < first || wanted > last);
    const dayKey = drifted ? originKey : wanted;

    // Aujourd'hui se lit sur SON capteur et non sur la fenêtre : c'est lui le
    // requis, il fonctionne sans le palier hebdomadaire, et il porte des
    // bornes publiées qu'on n'a pas à recalculer. Les deux capteurs sortent de
    // la même liste dédoublonnée côté intégration, ils ne peuvent pas se
    // contredire sur un même jour.
    //
    // La condition porte sur le JOUR affiché et non sur `cursor`, qui ne vaut
    // plus zéro sur aujourd'hui dès que le jour de repos a avancé.
    const onToday = dayKey === todayKey;
    const lessons = onToday
      ? listAttr<Lesson>(ctx.attr(LESSONS, 'lessons'))
      : weekLessons.filter((lesson) => {
          const at = parseTimestamp(lesson.start);
          return at !== undefined && dayKeyOf(at, tz) === dayKey;
        });
    const bounds: Bounds = onToday
      ? {
          first: ctx.attr<string>(LESSONS, 'first_start'),
          last: ctx.attr<string>(LESSONS, 'last_end'),
        }
      : boundsOf(lessons);

    /**
     * L'en-tête : les flèches, la date, et les bornes de la journée de classe.
     *
     * Les bornes d'aujourd'hui viennent des attributs `first_start` et
     * `last_end`, pas d'un calcul de la carte. Deux précisions relevées dans
     * le module de capteurs de l'intégration :
     *
     * - elles portent sur **tous** les créneaux du jour, cours annulés
     *   compris. Un premier cours annulé fixe donc quand même le début de la
     *   journée, ce qui est le bon sens de « journée de classe » : l'élève est
     *   attendu à cette heure-là tant qu'on ne lui a pas dit le contraire ;
     * - `last_end` peut être une heure **déduite**, sans que l'attribut le
     *   dise. Le drapeau est donc cherché dans la liste, sur le créneau qui
     *   porte cette fin, et il alimente l'**infobulle** des bornes.
     *
     * Cette carte marquait la fin déduite d'un « ≈ » visible, ici et sur
     * chaque ligne. Le propriétaire l'a fait retirer le 10 septembre 2026 :
     * sur l'établissement de référence le serveur n'envoie **aucune** heure de
     * fin, le marqueur était donc sur les 37 créneaux de la semaine, et un
     * signe présent partout ne distingue plus rien — il ne restait que le
     * bruit. L'information n'est pas perdue pour autant : le `title` la porte,
     * il n'a jamais dépendu du glyphe, et il reste la seule chose à lire pour
     * savoir si une heure est donnée ou calculée. La carte prochain cours,
     * elle, garde son « ≈ » : elle n'affiche qu'une heure de fin, pas
     * trente-sept.
     *
     * Les flèches restent visibles quand `show_header` est coupé, avec la
     * seule date : naviguer sans voir quel jour on regarde n'aurait aucun
     * sens, et les deux options répondent à des besoins différents — l'une
     * allège, l'autre déplace.
     */
    const header = ((): TemplateResult | '' => {
      const wantBounds = c.show_header !== false;
      // La date n'est plus facultative dès que le jour affiché n'est pas
      // aujourd'hui : des créneaux de demain sans date au-dessus se lisent
      // comme ceux d'aujourd'hui. C'est plausible ET faux, et l'avance
      // automatique rend le cas atteignable sans que personne ait cliqué —
      // donc sans que personne sache qu'il faut se méfier.
      if (!wantBounds && !navOn && onToday) return '';

      // La date s'ancre sur un cours dès qu'il y en a un — un horodatage réel
      // vaut mieux que n'importe quel calcul. Sinon sur l'horloge pour
      // aujourd'hui, et sur un instant reconstruit pour les autres jours.
      const day = formatDayLabel(
        bounds.first ?? (onToday ? clock.toISOString() : anchorFor(dayKey, tz)),
        lang,
        tz
      );
      const from = wantBounds ? formatTime(bounds.first, lang, tz) : '';
      const to = wantBounds ? formatTime(bounds.last, lang, tz) : '';
      // Ni date, ni bornes, ni flèches : un en-tête vide vaut moins que pas
      // d'en-tête.
      if (day === '' && from === '' && to === '' && !navOn) return '';
      // Le bouton ramène à l'origine de la carte, donc son libellé nomme
      // cette origine et pas aujourd'hui. Trois cas, dans cet ordre : le jour
      // se trouve être aujourd'hui, ce qui est le plus clair à dire ; sinon
      // c'est le prochain jour de cours (avance automatique, sans décalage) ;
      // sinon c'est le jour propre à cette carte, et rien d'autre ne le
      // décrit.
      const restLabel =
        originKey === todayKey
          ? ctx.t('journee.today')
          : offset === 0
            ? ctx.t('journee.rest_day')
            : ctx.t('journee.card_day');
      const inferred = dayEndIsInferred(lessons, bounds.last);

      const arrow = (delta: 1 | -1, glyph: string, label: string): TemplateResult => {
        const target = stepTo(dayKey, delta, days);
        const targetNumber = target === undefined ? undefined : dayNumber(target);
        // L'origine est celle DE LA CARTE, parce que `cursor` compte depuis
        // elle. Avec `todayKey` ici, une flèche appliquerait le saut
        // automatique une seconde fois ; avec `baseKey`, elle annulerait
        // `day_offset` au premier clic.
        const origin = dayNumber(originKey);
        const reachable = targetNumber !== undefined && origin !== undefined;
        return html`<button
          class="jour-fleche"
          ?disabled=${!reachable}
          aria-label=${label}
          title=${label}
          @click=${() => {
            if (targetNumber !== undefined && origin !== undefined)
              ctx.setCursor(targetNumber - origin);
          }}
        >
          ${glyph}
        </button>`;
      };

      return html`
        <div class="jour-entete">
          <div class="jour-nav">
            ${navOn ? arrow(-1, '‹', ctx.t('journee.prev_day')) : ''}
            <span class="jour-date">${day}</span>
            ${navOn ? arrow(1, '›', ctx.t('journee.next_day')) : ''}
            <!-- Le retour à aujourd'hui n'apparaît que lorsqu'on n'y est
                 plus : un bouton qui ne fait rien fatigue plus qu'il
                 n'aide. -->
            ${
              navOn && cursor !== 0
                ? html`<button
                    class="jour-retour"
                    @click=${() => {
                      ctx.setCursor(0);
                    }}
                  >
                    ${restLabel}
                  </button>`
                : ''
            }
          </div>
          ${
            from === '' || to === ''
              ? ''
              : html`<span
                  class="jour-bornes"
                  title=${inferred ? ctx.t('common.inferred_time') : ''}
                  >${from} – ${to}</span
                >`
          }
        </div>
      `;
    })();

    // L'en-tête survit à la journée vide, et c'est le moment où il sert :
    // « mercredi 9 septembre — aucun cours » se lit mieux que « aucun cours »
    // seul, qui laisse le doute sur le jour dont on parle.
    //
    // Et le libellé change avec le jour : « aucun cours aujourd'hui » posé
    // au-dessus d'un jeudi serait une affirmation fausse. C'est le défaut que
    // ce dépôt traque, et la navigation venait de le rendre atteignable.
    // Hors de la fenêtre collectée, la carte ne sait RIEN du jour demandé —
    // ce n'est pas la même chose qu'un jour sans cours, et les deux se
    // ressemblent à l'écran. Le cas n'existe que par `day_offset` : le
    // curseur, lui, est ramené dans la fenêtre plus haut, et un repli
    // silencieux serait ici le pire choix — deux cartes afficheraient la
    // même date en laissant croire à deux jours différents.
    //
    // L'en-tête est conservé : il porte la date demandée, donc il dit DE QUEL
    // jour on n'a rien. Sans lui la phrase serait vraie et inutilisable.
    const outOfWindow =
      offset !== 0 &&
      !onToday &&
      (first === undefined || last === undefined || dayKey < first || dayKey > last);
    if (outOfWindow) {
      return html`${header}${emptyState(ctx.t('journee.out_of_window'))}`;
    }

    if (lessons.length === 0) {
      return html`${header}${emptyState(ctx.t(onToday ? 'journee.empty' : 'journee.empty_day'))}`;
    }

    // Tri sur l'instant réel : deux créneaux à décalages horaires mixtes ne se
    // comparent pas correctement chaîne à chaîne.
    const sorted = sortedBy(
      lessons,
      (a, b) =>
        (parseTimestamp(a.start)?.getTime() ?? 0) - (parseTimestamp(b.start)?.getTime() ?? 0)
    );

    const { slots, mealInferred } = withMeals(sorted, c, tz);

    // `binary_sensor:in_class` a un droit de VETO, jamais celui de désigner :
    // il dit SI un cours a lieu, les horodatages disent LEQUEL. À `off`, aucun
    // créneau n'est mis en avant même si l'horloge le suggère — le capteur voit
    // ce que l'attribut ne porte pas : jour banalisé, cours déplacé après la
    // collecte, élève dispensé.
    const notInClass = ctx.status(IN_CLASS) === 'ok' && ctx.entity(IN_CLASS)?.state === 'off';

    const rows = slots.map((slot) => {
      if (slot.kind === 'meal') {
        return html`
          <div class="jour-ligne jour-repas">
            <div class="jour-heures">
              <!-- Pas de marqueur visible sur la borne gauche : l'infobulle
                   de la ligne, elle, dit que le creux vient d'une fin
                   déduite. -->
              <span>${formatTime(slot.start, lang, tz)}</span>
              <span>${formatTime(slot.end, lang, tz)}</span>
            </div>
            <div class="jour-filet" aria-hidden="true"></div>
            <div class="jour-corps">
              <span class="jour-matiere" title=${mealInferred ? ctx.t('journee.meal_inferred') : ''}
                >${c.meal_label ?? ctx.t('journee.meal')}</span
              >
            </div>
          </div>
        `;
      }

      const l = slot.lesson;
      if (l === undefined) return html``;

      const canceled = isCanceled(l);
      const accent = subjectAccent(l.background_color, l.subject, c.subject_colors);
      const start = parseTimestamp(l.start)?.getTime();
      const end = parseTimestamp(l.end)?.getTime();
      // Un cours dont l'élève est dispensé n'est pas « en cours » pour lui.
      const current =
        c.show_current !== false &&
        !notInClass &&
        !canceled &&
        l.exempted !== true &&
        start !== undefined &&
        end !== undefined &&
        now >= start &&
        now < end;

      // Salle et professeurs, dans cet ordre : la salle est ce qu'on cherche
      // en marchant dans le couloir, le nom du professeur ce qu'on cherche en
      // relisant la journée. `teachersOf` absorbe les deux formes que
      // l'intégration a publiées selon ses versions — un tableau ou une
      // chaîne unique.
      const details = [
        c.show_rooms === false ? '' : roomLabel(l.classroom ?? '', traduire),
        c.show_teachers === false ? '' : teachersOf(l.teachers),
      ]
        .filter((part) => part !== '')
        .join(' · ');

      const badges: TemplateResult[] = [];
      if (canceled) badges.push(chip(ctx.t('journee.canceled'), 'problem'));
      const reason = statusLabel(l);
      if (reason !== '') badges.push(chip(reason, 'warn'));
      if (l.test) badges.push(chip(ctx.t('journee.test'), 'warn'));
      if (l.outing) badges.push(chip(ctx.t('journee.outing')));
      if (l.exempted === true) badges.push(chip(ctx.t('journee.exempted')));

      return html`
        <div class="jour-ligne ${current ? 'jour-courant' : ''}">
          <div class="jour-heures">
            <span>${formatTime(l.start, lang, tz)}</span>
            <!-- L'heure de FIN. Quand l'intégration l'a déduite faute que le
                 serveur l'envoie, seule l'infobulle le dit : le glyphe qui la
                 précédait a été retiré sur demande du propriétaire, parce que
                 l'établissement de référence le produisait sur CHAQUE ligne.
                 Ne le remettez pas sans le mesurer : un marqueur que 37
                 créneaux sur 37 portent n'avertit plus, il décore. -->
            <span title=${l.end_inferred === true ? ctx.t('common.inferred_time') : ''}
              >${formatTime(l.end, lang, tz)}</span
            >
          </div>
          <!-- Le filet ENTRE les horaires et le corps : sur cette carte il
               sépare l'heure de la matière, il ne borde pas la ligne. C'est la
               seule des six où la couleur n'est pas une gouttière, et le
               propriétaire a tranché dans ce sens après avoir vu les deux.

               La valeur passe malgré tout par la même propriété personnalisée
               que la règle .row.accented des cinq autres : un placement
               différent ne justifie pas un second mécanisme, sinon le
               filtrage de la valeur finit par divorcer entre les deux.

               Sans guillemet oblique dans ce commentaire : il est à
               l'intérieur du gabarit html, qu'un guillemet oblique fermerait
               au milieu. Ici l'erreur signalée était « Property row does not
               exist on type TemplateResult », à deux lignes du vrai
               coupable. -->
          <div
            class="jour-filet ${accent === undefined ? 'jour-filet-neutre' : ''}"
            style=${accent === undefined ? nothing : `--pronote-subject-color: ${accent}`}
            aria-hidden="true"
          ></div>
          <div class="jour-corps">
            <div class="jour-tete">
              <span class="jour-matiere ${canceled ? 'canceled' : ''}">${l.subject ?? '—'}</span>
              ${badges.length > 0 ? html`<span class="jour-pastilles">${badges}</span>` : ''}
            </div>
            <!-- Salle et professeur sur leur propre ligne, et non à la suite
                 de la matière : un nom de professeur fait facilement trente
                 caractères, et sur la largeur d'une colonne de section il
                 repoussait les pastilles hors du champ visible. Le point
                 médian ne s'affiche que si les deux éléments sont là. -->
            ${details === '' ? '' : html`<div class="jour-detail">${details}</div>`}
          </div>
        </div>
      `;
    });

    return html`${header}
      <div class="jour">${rows}</div>`;
  },
};
