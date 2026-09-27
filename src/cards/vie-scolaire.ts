import { html, type TemplateResult } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx, Translate } from '../core/types';
import { compareInstants, formatDayLabel, formatDuration, formatTime } from '../core/format';
import { chip, emptyState, listRow, sourcesState } from '../core/ui/parts';
import { latestFirst, listAttr, sortedBy } from '../core/list';

type Section = 'absences' | 'delays' | 'punishments';

interface Config extends CarnetCardConfig {
  sections?: Section[];
  limit?: number;
}

interface Absence {
  from_date?: string;
  to_date?: string;
  /**
   * PRONOTE écrit la durée d'une absence **déjà composée** — « 2h00 » — et
   * l'intégration la recopie telle quelle (`_absence_dict` : « ``hours``/
   * ``days``, never ``minutes`` »). C'est donc une chaîne, pas un nombre : la
   * multiplier par 60 rendait « NaN h NaN » sur une vraie instance.
   */
  hours?: string | number;
  justified?: boolean;
  reasons?: unknown;
}
interface Delay {
  date?: string;
  /** Un retard, lui, porte bien un entier de minutes. */
  minutes?: number;
  justified?: boolean;
  reasons?: unknown;
}
/** Un créneau de punition : c'est ici, et nulle part ailleurs, que vit la durée. */
interface PunishmentSlot {
  start?: string;
  duration_minutes?: number;
}
interface Punishment {
  nature?: string;
  giver?: string;
  /**
   * Une punition n'a **pas** de champ `duration` au premier niveau : sa durée
   * se lit sur ses créneaux. L'ancienne lecture d'un `p.duration` inexistant
   * ne rendait jamais rien, en silence.
   */
  schedule?: unknown;
}

const ABSENCES: EntityKey = 'sensor:absences';
const DELAYS: EntityKey = 'sensor:delays';
const PUNISHMENTS: EntityKey = 'sensor:punishments';
// Un parent dont l'intégration ne publie que ce capteur (palier différent des
// trois autres) doit quand même obtenir une carte utile : voir requiresAny
// ci-dessous, et le rapport de correctifs (dette2).
const UNJUSTIFIED_ABSENCES: EntityKey = 'sensor:unjustified_absences';
const IN_PROGRESS: EntityKey = 'binary_sensor:absence_in_progress';
const UPCOMING: EntityKey = 'binary_sensor:punishment_upcoming';
const NEXT_PUNISHMENT: EntityKey = 'sensor:next_punishment';

/**
 * Un instant en toutes lettres : « lundi 7 septembre · 14:00 ». Une valeur
 * illisible rend la chaîne vide, jamais l'horodatage ISO brut — c'est
 * pourtant ce que la carte affichait, et personne ne lit un ISO.
 */
const stamp = (value: string | undefined, language: string, timeZone: string): string =>
  [formatDayLabel(value, language, timeZone), formatTime(value, language, timeZone)]
    .filter(Boolean)
    .join(' · ');

/** L'étendue d'une absence, sans répéter le jour quand elle tient dans la journée. */
const spanLabel = (
  from: string | undefined,
  to: string | undefined,
  language: string,
  timeZone: string
): string => {
  const start = stamp(from, language, timeZone);
  if (!start) return stamp(to, language, timeZone);
  const endTime = formatTime(to, language, timeZone);
  if (!endTime) return start;
  const sameDay =
    formatDayLabel(from, language, timeZone) === formatDayLabel(to, language, timeZone);
  // Une borne de fin identique à la borne de début n'apprend rien : une
  // flèche vers la même heure se lit comme une donnée manquante.
  if (sameDay && endTime === formatTime(from, language, timeZone)) return start;
  return `${start} → ${sameDay ? endTime : stamp(to, language, timeZone)}`;
};

/** Les motifs écrits par l'établissement, rendus tels quels — jamais traduits. */
const reasonsLabel = (value: unknown): string =>
  listAttr<unknown>(value)
    .filter((r): r is string => typeof r === 'string' && r.trim() !== '')
    .join(' · ');

/**
 * La durée d'une absence. PRONOTE l'écrit déjà composée (« 2h00 ») : ce
 * texte est rendu tel quel. Un nombre, lui, est bien un nombre d'heures.
 */
const absenceDuration = (hours: string | number | undefined, language: string): string => {
  if (hours === undefined || hours === null) return '';
  if (typeof hours === 'number') return formatDuration(hours * 60, language);
  const trimmed = hours.trim();
  if (trimmed === '') return '';
  const n = Number(trimmed);
  return Number.isFinite(n) ? formatDuration(n * 60, language) : trimmed;
};

/** La durée totale d'une punition : la somme de ses créneaux, seule source réelle. */
const punishmentDuration = (schedule: unknown, language: string): string => {
  const total = listAttr<PunishmentSlot>(schedule).reduce(
    (sum, slot) => sum + (typeof slot.duration_minutes === 'number' ? slot.duration_minutes : 0),
    0
  );
  return total > 0 ? formatDuration(total, language) : '';
};

const sectionsOf = (c: Config): Section[] =>
  c.sections && c.sections.length > 0 ? c.sections : ['absences', 'delays', 'punishments'];

/**
 * `slice(-limit)` (l'ancienne implémentation) supposait l'attribut déjà trié
 * du plus ancien au plus récent, sans le vérifier : une intégration qui
 * renvoie le plus récent en tête ferait silencieusement remonter les entrées
 * les plus anciennes. On trie explicitement, du plus ancien au plus récent,
 * avant de confier le tableau à `latestFirst` — sans muter l'entrée.
 */
function byDateAscending<T>(items: T[], dateOf: (item: T) => string | undefined): T[] {
  // Sur l'INSTANT, jamais sur la chaîne, et une date illisible en fin de la
  // liste affichée : voir `compareInstants`.
  return sortedBy(items, (a, b) => compareInstants(dateOf(a), dateOf(b)));
}

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-vie-scolaire',
  name: 'Carnet scolaire — Vie scolaire',
  description: 'Absences, retards et punitions, avec leur détail.',
  key: 'vie_scolaire',
  scope: 'child',
  size: 6,
  stub: { sections: ['absences', 'delays', 'punishments'] },
  requires: () => [],
  requiresAny: () => [ABSENCES, DELAYS, PUNISHMENTS, UNJUSTIFIED_ABSENCES],
  optional: () => [IN_PROGRESS, UPCOMING, NEXT_PUNISHMENT],
  schema: (_config: Config, t?: Translate) => {
    const tr = t ?? ((path: string) => path);
    return [
      {
        name: 'sections',
        selector: {
          select: {
            multiple: true,
            options: [
              { value: 'absences', label: tr('vie_scolaire.absences') },
              { value: 'delays', label: tr('vie_scolaire.delays') },
              { value: 'punishments', label: tr('vie_scolaire.punishments') },
            ],
          },
        },
      },
      { name: 'limit', selector: { number: { min: 1, max: 50, mode: 'box' } } },
    ];
  },
  render(ctx: RenderCtx<Config>) {
    const c = ctx.config;
    const wanted = sectionsOf(c);
    const limit = c.limit ?? 8;
    const out: TemplateResult[] = [];

    // Compteurs en tête (spec §5.7), avant le détail par section. Chacun ne
    // paraît que si son capteur est résolu et exploitable : `ctx.status`
    // distingue déjà « absent » et « pas encore collecté », inutile de le
    // refaire ici. `unjustified_absences` n'a pas de section qui lui soit
    // propre — c'est une sous-mesure des absences, on le rattache donc au
    // même filtre qu'« absences ».
    if (wanted.includes('absences') && ctx.status(ABSENCES) === 'ok') {
      out.push(
        listRow({ primary: ctx.t('vie_scolaire.absences'), trailing: ctx.entity(ABSENCES)!.state })
      );
    }
    if (wanted.includes('absences') && ctx.status(UNJUSTIFIED_ABSENCES) === 'ok') {
      out.push(
        listRow({
          primary: ctx.t('vie_scolaire.unjustified_absences'),
          trailing: chip(ctx.entity(UNJUSTIFIED_ABSENCES)!.state, 'warn'),
        })
      );
    }
    if (wanted.includes('delays') && ctx.status(DELAYS) === 'ok') {
      out.push(
        listRow({ primary: ctx.t('vie_scolaire.delays'), trailing: ctx.entity(DELAYS)!.state })
      );
    }
    if (wanted.includes('punishments') && ctx.status(PUNISHMENTS) === 'ok') {
      out.push(
        listRow({
          primary: ctx.t('vie_scolaire.punishments'),
          trailing: ctx.entity(PUNISHMENTS)!.state,
        })
      );
    }

    // Les bandeaux sont du contenu à part entière : une absence en cours ou
    // une punition à venir, souvent pas encore consignées dans les listes
    // détaillées (`items`), ne doivent jamais être écrasées par l'état vide.
    if (ctx.entity(IN_PROGRESS)?.state === 'on') {
      out.push(html`<div class="notice problem">${ctx.t('vie_scolaire.in_progress')}</div>`);
    }
    if (ctx.entity(UPCOMING)?.state === 'on') {
      out.push(html`<div class="notice problem">${ctx.t('vie_scolaire.upcoming')}</div>`);
      // `sensor:next_punishment` est optionnelle : non résolue, le bandeau
      // reste tel quel, sans échéance et sans message d'erreur. Résolue, on
      // rend l'échéance avec les formateurs de format.ts (jamais l'horodatage
      // brut), toujours avec ctx.language et ctx.timeZone — même paire que
      // `next_test` sur la carte prochain-cours : jour ET heure comptent,
      // rien ne dit qu'une punition tombe le jour même.
      if (ctx.status(NEXT_PUNISHMENT) === 'ok') {
        const when = [
          formatDayLabel(ctx.entity(NEXT_PUNISHMENT)?.state, ctx.language, ctx.timeZone),
          formatTime(ctx.entity(NEXT_PUNISHMENT)?.state, ctx.language, ctx.timeZone),
        ]
          .filter(Boolean)
          .join(' · ');
        if (when) {
          out.push(listRow({ primary: ctx.t('vie_scolaire.next_punishment'), secondary: when }));
        }
      }
    }

    let rows = 0;

    // Le détail des absences vient de `sensor:absences` ; à défaut, de
    // `sensor:unjustified_absences`, qui publie les mêmes éléments restreints
    // aux non justifiées. Sans ce repli, une instance qui ne publie que le
    // second affichait son compteur, puis « Rien à signaler » juste dessous.
    const absencesSource = ctx.status(ABSENCES) === 'ok' ? ABSENCES : UNJUSTIFIED_ABSENCES;

    if (wanted.includes('absences')) {
      const sorted = byDateAscending(
        listAttr<Absence>(ctx.attr(absencesSource, 'items')),
        (a) => a.to_date ?? a.from_date
      );
      const items = latestFirst<Absence>(sorted, limit);
      if (items.length > 0) {
        out.push(html`<div class="title">${ctx.t('vie_scolaire.absences')}</div>`);
        for (const a of items) {
          rows++;
          out.push(
            listRow({
              primary: spanLabel(a.from_date, a.to_date, ctx.language, ctx.timeZone) || '—',
              secondary:
                [absenceDuration(a.hours, ctx.language), reasonsLabel(a.reasons)]
                  .filter(Boolean)
                  .join(' · ') || undefined,
              trailing: chip(
                // « justifiée » est féminin : correct pour une absence. Le
                // retard, plus bas, prend les clés masculines dédiées.
                a.justified ? ctx.t('vie_scolaire.justified') : ctx.t('vie_scolaire.unjustified'),
                a.justified ? 'neutral' : 'warn'
              ),
            })
          );
        }
      }
    }

    if (wanted.includes('delays')) {
      const sorted = byDateAscending(listAttr<Delay>(ctx.attr(DELAYS, 'items')), (d) => d.date);
      const items = latestFirst<Delay>(sorted, limit);
      if (items.length > 0) {
        out.push(html`<div class="title">${ctx.t('vie_scolaire.delays')}</div>`);
        for (const d of items) {
          rows++;
          out.push(
            listRow({
              primary: stamp(d.date, ctx.language, ctx.timeZone) || '—',
              secondary:
                [formatDuration(d.minutes, ctx.language), reasonsLabel(d.reasons)]
                  .filter(Boolean)
                  .join(' · ') || undefined,
              trailing: chip(
                // Un retard est masculin : `justified_m` / `unjustified_m`.
                // Les clés `justified` / `unjustified` (féminin) restent
                // réservées à une absence, juste au-dessus.
                d.justified
                  ? ctx.t('vie_scolaire.justified_m')
                  : ctx.t('vie_scolaire.unjustified_m'),
                d.justified ? 'neutral' : 'warn'
              ),
            })
          );
        }
      }
    }

    if (wanted.includes('punishments')) {
      // Pas de date au premier niveau d'une punition (`nature`, `giver`,
      // `schedule`) : rien à trier avant de tronquer.
      const items = latestFirst<Punishment>(ctx.attr(PUNISHMENTS, 'items'), limit);
      if (items.length > 0) {
        out.push(html`<div class="title">${ctx.t('vie_scolaire.punishments')}</div>`);
        for (const p of items) {
          rows++;
          out.push(
            listRow({
              primary: p.nature ?? '—',
              secondary: p.giver ?? undefined,
              trailing: punishmentDuration(p.schedule, ctx.language) || undefined,
            })
          );
        }
      }
    }

    // Le vide ne porte que sur le détail par section (`rows`) : les compteurs
    // et le bandeau d'échéance, poussés plus haut dans `out`, restent affichés
    // même quand aucune section détaillée n'a de ligne — sans quoi un simple
    // `return emptyState(...)` les effacerait tous les deux.
    //
    // Et le vide n'appartient à la carte que si les sources des sections
    // voulues sont là : le socle la rend dès qu'UNE de ses ancres est
    // exploitable, donc une section dont le capteur est `unknown` ou absent
    // aurait sinon été déclarée « Rien à signaler ».
    if (rows === 0) {
      const sources: EntityKey[] = [];
      if (wanted.includes('absences')) {
        sources.push(ctx.status(ABSENCES) === 'missing' ? UNJUSTIFIED_ABSENCES : ABSENCES);
      }
      if (wanted.includes('delays')) sources.push(DELAYS);
      if (wanted.includes('punishments')) sources.push(PUNISHMENTS);
      out.push(
        sourcesState((k) => ctx.status(k), sources, (path, vars) => ctx.t(path, vars), (c.sections?.length ?? 0) > 0) ?? emptyState(ctx.t('vie_scolaire.empty'))
      );
    }
    return html`${out}`;
  },
};
