import { html, type TemplateResult } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx, Translate } from '../core/types';
import { formatDayLabel, formatTime, parseTimestamp } from '../core/format';
import { chip, emptyState, listRow } from '../core/ui/parts';
import { listAttr, sortedBy } from '../core/list';
import { isCanceled, statusLabel, teachersOf, type Lesson } from '../core/lesson';
import { subjectAccent } from '../core/subject-color';

interface Config extends CarnetCardConfig {
  range?: 'today' | 'tomorrow' | 'week';
  show_rooms?: boolean;
  show_teachers?: boolean;
  /**
   * Table matière → couleur, renseignée par l'utilisateur.
   *
   * C'est le **deuxième** rang de couleur, et un secours : `subjectAccent`
   * préfère la couleur du serveur, que l'intégration publie sur chaque créneau
   * (`background_color`). Cette table ne sert donc plus qu'à colorer une
   * matière que l'établissement laisse sans couleur, ou à remplacer une teinte
   * illisible dans un thème.
   *
   * Le commentaire précédent affirmait l'inverse : que l'intégration « ne la
   * publie pas encore » et que cette table était le seul rang qui produise
   * quelque chose. Faux depuis la version 0.0.13 de l'intégration — mesuré le
   * 9 septembre 2026, les vingt-sept créneaux portent la couleur. Le même
   * commentaire figurait sur trois cartes ; `devoirs.ts` et `notes.ts` ont été
   * corrigés avant celui-ci.
   *
   * Absente du formulaire d'éditeur, et pour une raison : aucun sélecteur
   * `ha-form` ne rend correctement un dictionnaire ouvert dont les clés sont
   * les matières de l'établissement. En YAML, l'utilisateur a au moins la
   * coloration syntaxique de Home Assistant.
   */
  subject_colors?: Record<string, string>;
}

/**
 * Couture de test pour le surlignage « en cours », qui dépend de
 * `Date.now()`. Elle vit ici, en variable de module, plutôt que dans
 * `Config` : `CarnetCardConfig` porte un index de signature ouvert
 * (`[option: string]: unknown`), donc tout champ ajouté à `Config` reste
 * atteignable depuis le YAML d'un tableau de bord — un `now:` posé à la
 * main y figerait le surlignage sur un instant arbitraire, en permanence.
 * En important cette variable directement, seuls les tests peuvent
 * l'atteindre ; aucune configuration ne le peut.
 */
export const testClock: { now?: string } = {};

const KEYS: Record<NonNullable<Config['range']>, EntityKey> = {
  today: 'sensor:lessons_today',
  tomorrow: 'sensor:timetable_tomorrow',
  week: 'sensor:timetable_week',
};

const keyFor = (c: Config): EntityKey => KEYS[c.range ?? 'today'];

/**
 * Deux capteurs binaires optionnels, indépendants du créneau : ils signalent
 * qu'un contrôle ou une sortie existe quelque part dans la journée, pas quel
 * créneau précis. Contrairement à `binary_sensor:in_class` (délibérément
 * absent de cette carte — voir le rapport), rien ici ne fait doublon avec un
 * calcul déjà posé sur les horodatages des créneaux.
 */
const IN_CLASS: EntityKey = 'binary_sensor:in_class';
const TEST_TODAY: EntityKey = 'binary_sensor:test_today';
const OUTING_TODAY: EntityKey = 'binary_sensor:outing_today';

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-emploi-du-temps',
  name: 'Carnet scolaire — Emploi du temps',
  description: 'Les cours du jour, du lendemain ou de la semaine.',
  key: 'emploi_du_temps',
  scope: 'child',
  // La hauteur dépend du mode : une journée tient en une poignée de lignes,
  // une semaine en trente à quarante, plus un intertitre par jour. Annoncer 8
  // dans tous les cas faisait empiler les colonnes de travers dès qu'on
  // passait en semaine.
  size: (c) => (c.range === 'week' ? 24 : 8),
  stub: { range: 'today', show_rooms: true },
  requires: (c) => [keyFor(c)],
  optional: () => [IN_CLASS, TEST_TODAY, OUTING_TODAY],
  schema: (_config: Config, t?: Translate) => [
    {
      name: 'range',
      selector: {
        select: {
          mode: 'dropdown',
          options: [
            { value: 'today', label: t ? t('emploi_du_temps.range_today') : "Aujourd'hui" },
            { value: 'tomorrow', label: t ? t('emploi_du_temps.range_tomorrow') : 'Demain' },
            { value: 'week', label: t ? t('emploi_du_temps.range_week') : 'Semaine' },
          ],
        },
      },
    },
    { name: 'show_rooms', selector: { boolean: {} } },
    { name: 'show_teachers', selector: { boolean: {} } },
  ],
  // Le surlignage « en cours » est calculé sur Date.now() (voir plus bas) :
  // sans repeint périodique, la pastille peut désigner un cours terminé
  // pendant une heure entière, entre deux cycles de collecte PRONOTE, alors
  // qu'aucune propriété réactive ne change. Le socle pose et retire lui-même
  // la minuterie.
  tickMs: 60_000,
  render(ctx: RenderCtx<Config>) {
    const c = ctx.config;
    const key = keyFor(c);
    // `listAttr` survit à un attribut absent, nul, ou qui n'est simplement
    // pas un tableau (objet, chaîne…) : un `[...x]` sur une valeur non
    // itérable lèverait dans `render`, et une exception ici n'affiche pas un
    // message d'erreur — elle efface la carte entière, sans même le
    // « donnée pas encore collectée » qu'on afficherait sinon.
    const lessons = listAttr<Lesson>(ctx.attr(key, 'lessons'));

    if (lessons.length === 0) return emptyState(ctx.t('emploi_du_temps.empty'));

    // Tri sur l'instant réel, pas sur la représentation textuelle : deux
    // créneaux à décalages horaires mixtes (l'un en `Z`, l'autre en
    // `+02:00`) ne se comparent pas correctement chaîne à chaîne — le
    // premier chiffre d'heure peut sembler « petit » alors que l'instant
    // réel est le plus tardif des deux.
    const sorted = sortedBy(
      lessons,
      (a, b) =>
        (parseTimestamp(a.start)?.getTime() ?? 0) - (parseTimestamp(b.start)?.getTime() ?? 0)
    );

    const lang = ctx.language;
    const tz = ctx.timeZone;
    const out: TemplateResult[] = [];

    // Pastille de tête de journée : `test_today` et `outing_today` sont
    // optionnels et ne disent rien tant qu'ils ne sont pas résolus — jamais
    // de pastille « pas de contrôle » ou « pas de sortie ». Seul `'on'`
    // déclenche l'affichage ; une entité résolue mais à `'off'` reste muette,
    // comme une entité absente.
    //
    // Et UNIQUEMENT en mode journée. Ces deux capteurs ne décrivent
    // qu'aujourd'hui : posés en tête d'une vue « demain », ils décriraient le
    // mauvais jour ; en tête d'une semaine, ils affirmeraient sans dire quel
    // jour. Les cours portent déjà leurs propres attributs `test` et `outing`,
    // qui situent l'information au bon créneau dans tous les modes — la
    // pastille de tête n'est qu'un résumé, et un résumé faux vaut moins que
    // pas de résumé.
    if ((c.range ?? 'today') === 'today') {
      const dayBadges: TemplateResult[] = [];
      if (ctx.entity(TEST_TODAY)?.state === 'on') {
        dayBadges.push(chip(ctx.t('emploi_du_temps.test'), 'warn'));
      }
      if (ctx.entity(OUTING_TODAY)?.state === 'on') {
        dayBadges.push(chip(ctx.t('emploi_du_temps.outing')));
      }
      if (dayBadges.length > 0) out.push(html`<div class="row">${dayBadges}</div>`);
    }

    let currentDay = '';
    const now = (parseTimestamp(testClock.now) ?? new Date()).getTime();

    // `binary_sensor:in_class` dit SI un cours est en cours ; les horodatages
    // des créneaux disent LEQUEL. Aucune des deux sources ne remplace l'autre,
    // et les faire concourir sur la même question produirait tôt ou tard deux
    // réponses contradictoires. On leur donne donc des rôles distincts : le
    // capteur a un droit de VETO, jamais celui de désigner.
    //
    // À `off`, aucun créneau n'est surligné même si l'horloge le suggère — le
    // capteur voit des choses que l'attribut `lessons` ne porte pas : jour
    // banalisé, cours déplacé après la collecte, élève dispensé. À `on` sans
    // créneau correspondant, la carte ne fabrique rien : elle ne sait pas
    // lequel, elle se tait. Absent ou non résolu, le comportement est
    // exactement celui d'avant.
    const notInClass = ctx.status(IN_CLASS) === 'ok' && ctx.entity(IN_CLASS)?.state === 'off';

    for (const l of sorted) {
      // En mode semaine, un intertitre par jour.
      if (c.range === 'week') {
        const label = formatDayLabel(l.start, lang, tz);
        if (label && label !== currentDay) {
          currentDay = label;
          out.push(html`<div class="title">${label}</div>`);
        }
      }

      const canceled = isCanceled(l);

      // Un créneau annulé n'est jamais « en cours ».
      const start = parseTimestamp(l.start)?.getTime();
      const end = parseTimestamp(l.end)?.getTime();
      // Un cours dont l'élève est dispensé n'est pas « en cours » pour lui.
      const current =
        !notInClass &&
        !canceled &&
        l.exempted !== true &&
        start !== undefined &&
        end !== undefined &&
        now >= start &&
        now < end;

      const badges: TemplateResult[] = [];
      if (current) badges.push(chip(ctx.t('emploi_du_temps.current'), 'ok'));
      if (canceled) badges.push(chip(ctx.t('emploi_du_temps.canceled'), 'problem'));
      // Le motif du serveur, tel qu'il l'a écrit. Toujours en `warn` : c'est
      // une réserve sur le créneau, pas une panne — même quand il accompagne
      // une annulation, qui porte déjà sa propre pastille rouge.
      const reason = statusLabel(l);
      if (reason !== '') badges.push(chip(reason, 'warn'));
      if (l.test) badges.push(chip(ctx.t('emploi_du_temps.test'), 'warn'));
      if (l.outing) badges.push(chip(ctx.t('emploi_du_temps.outing')));
      if (l.exempted === true) badges.push(chip(ctx.t('emploi_du_temps.exempted')));

      const details = [
        c.show_rooms ? l.classroom : undefined,
        c.show_teachers ? teachersOf(l.teachers) : undefined,
      ]
        .filter(Boolean)
        .join(' · ');

      out.push(
        listRow({
          primary: html`${formatTime(l.start, lang, tz)} ${l.subject ?? '—'}`,
          secondary: details || undefined,
          trailing: badges.length > 0 ? html`${badges}` : undefined,
          // Un cours annulé reste visible, barré. Le retirer donnerait
          // l'illusion qu'il n'a jamais existé.
          canceled,
          // `?? null` et non `?? undefined` : la grille entière réserve la
          // gouttière, donc un créneau sans couleur reste aligné sur ses
          // voisins colorés. Voir `RowOptions.accent`.
          accent: subjectAccent(l.background_color, l.subject, c.subject_colors) ?? null,
        })
      );
    }

    return html`${out}`;
  },
};
