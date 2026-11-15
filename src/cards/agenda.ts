import { html } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx } from '../core/types';
import { formatCalendarPage, formatTime, isDateOnly, parseTimestamp } from '../core/format';
import { dateTimeFormat } from '../core/intl';
import { calendarPage, emptyState, listRow, unavailableState } from '../core/ui/parts';
import { subjectColor } from '../core/subject-color';

interface Config extends CarnetCardConfig {
  /** Nombre d'évènements affichés. Absent : 6. */
  limit?: number;
  /** Vacances et jours fériés dans la liste. Absent : affichés. */
  show_holidays?: boolean;
  /** Famille PRONOTE (« Conseil de classe »…) et public sous le titre. Absent : affichés. */
  show_category?: boolean;
}

/**
 * Le capteur « Prochain évènement » porte, dans `items`, tous les évènements
 * à venir de l'agenda de l'établissement. C'est la seule source de la carte :
 * le calendrier dit la même chose sous une forme que Lovelace sait déjà
 * afficher, et le lire en plus ne donnerait rien de neuf.
 */
const NEXT_EVENT: EntityKey = 'sensor:next_school_event';

const DEFAULT_LIMIT = 6;

/**
 * Un évènement de `items`, tel que l'intégration le publie (contrat figé
 * avec le backend le 15 novembre 2026, voir `test/fixtures/FORMES.md`).
 *
 * `start` et `end` ont DEUX formes. Journée entière : une date seule
 * `AAAA-MM-JJ`, et `end` est EXCLUSIVE — le lendemain du dernier jour, comme
 * dans le calendrier de Home Assistant. Sinon : un ISO 8601 complet avec
 * décalage, et `end` est l'heure de fin.
 */
interface SchoolEvent {
  key?: string;
  title?: string;
  start?: string;
  end?: string;
  all_day?: boolean;
  category?: string;
  color?: string | null;
  is_class_council?: boolean;
  is_holiday?: boolean;
  location?: string;
  description?: string;
  audience?: string;
}

const asEvents = (value: unknown): SchoolEvent[] =>
  Array.isArray(value)
    ? value.filter((v): v is SchoolEvent => typeof v === 'object' && v !== null)
    : [];

/** Le jour calendaire `AAAA-MM-JJ` d'un instant, dans le fuseau d'affichage. */
const dayKey = (d: Date, timeZone: string): string =>
  dateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    d
  );

/** La veille d'une date seule — pour rendre inclusive une fin exclusive. */
const previousDay = (date: string): string => {
  const d = new Date(`${date.trim()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Le dernier jour d'une journée entière, inclusif. `end` absente, illisible
 * ou pas après `start` : l'évènement tient en un jour.
 */
const lastDay = (e: SchoolEvent): string | undefined => {
  if (!isDateOnly(e.start)) return undefined;
  const start = e.start!.trim();
  if (!isDateOnly(e.end)) return start;
  const last = previousDay(e.end!);
  return last > start ? last : start;
};

/**
 * Un évènement est-il encore à venir ou en cours ?
 *
 * L'intégration ne publie déjà que les évènements dont la fin est après le
 * moment de la collecte. Mais la collecte est quotidienne : sans ce filtre,
 * un conseil de classe fini à 18 h 30 resterait affiché toute la soirée.
 * Une journée entière se compare en jours, dans le fuseau d'affichage — c'est
 * là que se trouve le « aujourd'hui » de la personne qui lit.
 */
const notOver = (e: SchoolEvent, now: Date, timeZone: string): boolean => {
  if (e.all_day === true || isDateOnly(e.start)) {
    const last = lastDay(e);
    return last === undefined || last >= dayKey(now, timeZone);
  }
  const end = parseTimestamp(e.end) ?? parseTimestamp(e.start);
  return end === undefined || end.getTime() > now.getTime();
};

/**
 * « 20 novembre » : le jour et le mois, sans jour de la semaine. Une date
 * seule se met en forme en UTC, comme partout dans le dépôt (voir
 * `formatDayLabel`) ; un instant suit le fuseau d'affichage.
 */
const dayMonth = (value: string, language: string, timeZone: string): string => {
  const d = parseTimestamp(value.trim());
  if (!d) return '';
  return dateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    timeZone: isDateOnly(value) ? 'UTC' : timeZone,
  }).format(d);
};

/**
 * La ligne de date, dans la forme de l'appli PRONOTE : « Le 20 novembre »,
 * « Le 1 décembre de 17:15 à 18:30 », « Du 20 décembre au 3 janvier ».
 */
const whenLine = (e: SchoolEvent, ctx: RenderCtx<Config>): string => {
  const lang = ctx.language;
  const tz = ctx.timeZone;
  const start = e.start?.trim();
  if (!start) return '';
  if (isDateOnly(start)) {
    const last = lastDay(e) ?? start;
    return last === start
      ? ctx.t('agenda.on_day', { date: dayMonth(start, lang, tz) })
      : ctx.t('agenda.from_to', {
          start: dayMonth(start, lang, tz),
          end: dayMonth(last, lang, tz),
        });
  }
  const startDate = parseTimestamp(start);
  const endDate = parseTimestamp(e.end);
  if (!startDate) return '';
  if (!endDate) {
    return ctx.t('agenda.on_day_at', {
      date: dayMonth(start, lang, tz),
      time: formatTime(start, lang, tz),
    });
  }
  if (dayKey(startDate, tz) === dayKey(endDate, tz)) {
    return ctx.t('agenda.on_day_time', {
      date: dayMonth(start, lang, tz),
      start: formatTime(start, lang, tz),
      end: formatTime(e.end, lang, tz),
    });
  }
  return ctx.t('agenda.from_to_time', {
    start: dayMonth(start, lang, tz),
    start_time: formatTime(start, lang, tz),
    end: dayMonth(e.end!, lang, tz),
    end_time: formatTime(e.end, lang, tz),
  });
};

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-agenda',
  name: 'Carnet scolaire — Agenda',
  description:
    "L'agenda de l'établissement : arrêt des notes, conseils de classe, vacances, réunions.",
  key: 'agenda',
  scope: 'child',
  size: (c) => 1 + Math.min(c.limit ?? DEFAULT_LIMIT, 8),
  requires: () => [NEXT_EVENT],
  optional: () => [],
  schema: () => [
    { name: 'limit', selector: { number: { min: 1, max: 50, mode: 'box' } } },
    { name: 'show_holidays', selector: { boolean: {} } },
    { name: 'show_category', selector: { boolean: {} } },
  ],
  // Un évènement fini disparaît de la liste à son heure de fin, sans attendre
  // la collecte du lendemain : il faut donc repeindre de temps en temps.
  tickMs: 300_000,
  /**
   * L'état du capteur est le début du prochain évènement HORS vacances. Quand
   * il ne reste que des vacances à venir, il vaut `unknown` alors que `items`
   * n'est pas vide — et le socle aurait écarté la carte. `fetched_at`, présent
   * dès la première collecte, distingue alors « rien d'autre que des
   * vacances » de « pas encore collectée ».
   */
  attributeDriven: true,
  render(ctx: RenderCtx<Config>) {
    if (ctx.status(NEXT_EVENT) !== 'ok' && ctx.attr(NEXT_EVENT, 'fetched_at') === undefined) {
      return unavailableState((path, vars) => ctx.t(path, vars));
    }

    const now = new Date();
    const showHolidays = ctx.config.show_holidays !== false;
    const showCategory = ctx.config.show_category !== false;
    const limit = ctx.config.limit ?? DEFAULT_LIMIT;

    const events = asEvents(ctx.attr(NEXT_EVENT, 'items'))
      .filter((e) => (e.title ?? '').trim() !== '' && parseTimestamp(e.start?.trim()) !== undefined)
      .filter((e) => showHolidays || e.is_holiday !== true)
      .filter((e) => notOver(e, now, ctx.timeZone));

    if (events.length === 0) {
      return emptyState(ctx.t(showHolidays ? 'agenda.empty' : 'agenda.empty_without_holidays'));
    }

    return html`${events.slice(0, Math.max(limit, 0)).map((e) => {
      const start = e.start!.trim();
      const page = formatCalendarPage(start, ctx.language, ctx.timeZone);
      const when = whenLine(e, ctx);
      const facts = showCategory
        ? [e.category?.trim(), e.audience?.trim()].filter((s): s is string => !!s)
        : [];
      return listRow({
        primary: page ? calendarPage(page, when, start) : when,
        secondary: html`<strong>${e.title!.trim()}</strong><br />${when}${
            facts.length ? html`<br />${facts.join(' · ')}` : ''
          }${e.location?.trim() ? html`<br />${e.location.trim()}` : ''}`,
        // La couleur de la famille PRONOTE, en liseré seulement — comme la
        // couleur de matière ailleurs, et pour la même raison : choisie pour
        // un fond blanc, elle casse le contraste en aplat sous un thème
        // sombre. `null` réserve la gouttière sans la colorer.
        accent: subjectColor(e.color) ?? null,
      });
    })}`;
  },
};
