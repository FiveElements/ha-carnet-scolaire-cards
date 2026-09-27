import { html, type TemplateResult } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx, Translate } from '../core/types';
import { compareInstants, formatDayLabel, formatGrade } from '../core/format';
import { emptyState, listRow, sourcesState } from '../core/ui/parts';
import { latestFirst, listAttr, sortedBy } from '../core/list';
import { subjectAccent, subjectFilter } from '../core/subject-color';

type Section = 'average' | 'latest' | 'subjects' | 'report_card';

interface Config extends CarnetCardConfig {
  sections?: Section[];
  limit?: number;
  /**
   * Ajoute la date de chaque note aux « dernières notes ». Désactivée par
   * défaut, pour qu'une carte déjà posée ne change pas d'aspect. `date` est
   * une date seule : `formatDayLabel` la lit comme un jour, jamais comme
   * minuit UTC.
   */
  show_date?: boolean;
  /**
   * Les matières à montrer, dans les dernières notes, les moyennes par
   * matière et le bulletin. Absente ou vide : toutes. La moyenne générale et
   * celle de la classe ne sont pas des matières, le filtre ne les touche pas.
   * La comparaison est celle de `subject_colors` : sans casse, sans accents,
   * sans espaces de bord.
   */
  subjects?: string[];
  /**
   * Table matière → couleur, renseignée par l'utilisateur.
   *
   * C'est le **deuxième** rang de couleur, et un secours : `subjectAccent`
   * préfère la couleur du serveur, que l'intégration publie désormais sur les
   * moyennes par matière (`background_color`). Cette table ne sert donc plus
   * qu'à colorer une matière que l'établissement laisse sans couleur, ou à
   * remplacer une teinte illisible dans un thème.
   *
   * Le commentaire précédent affirmait l'inverse : que l'intégration « ne la
   * publie pas encore » et que cette table était le seul rang qui produise
   * quelque chose. C'était vrai à l'écriture et faux depuis, ce qui est le
   * pire état pour un commentaire — il conseillait de remplir une table que
   * le premier rang rend muette. `devoirs.ts` a été corrigé le 10 septembre
   * 2026 ; cette carte a été oubliée, et a donc donné le mauvais conseil deux
   * semaines de plus. Mesuré le 24 septembre 2026 sur une instance : les
   * quatre moyennes par matière portent toutes `background_color`, en
   * hexadécimal strict.
   *
   * La portée est plus étroite ici que sur les autres cartes : seule la
   * section « moyennes par matière » est colorée. Les notes individuelles et
   * le bulletin n'ont pas de couleur côté protocole, et n'en auront pas —
   * voir `Average` et `NO_COLOR`.
   *
   * Absente du formulaire d'éditeur, et pour une raison : aucun sélecteur
   * `ha-form` ne rend correctement un dictionnaire ouvert dont les clés sont
   * les matières de l'établissement. En YAML, l'utilisateur a au moins la
   * coloration syntaxique de Home Assistant.
   */
  subject_colors?: Record<string, string>;
}

interface Grade {
  subject?: string;
  /**
   * La note elle-même. Le champ s'appelle `value` — pas `grade`, que la carte
   * lisait : `formatGrade(undefined)` rendant « — », chaque note s'affichait
   * en tiret sans que rien ne le signale. Défaut trouvé en confrontant la
   * carte à la source de l'intégration (`_grade_dict`), pas aux tests, dont
   * les fixtures reprenaient le nom inventé.
   */
  value?: number | string;
  out_of?: number | string;
  coefficient?: number;
  date?: string;
  class_average?: number | string;
  status?: string;
}

interface Average {
  subject?: string;
  /** `_average_dict` nomme la moyenne de l'élève `student`, jamais `average`. */
  student?: number | string;
  class_average?: number | string;
  out_of?: number | string;
  /**
   * La couleur de la matière. Côté protocole la clé est `couleur` — en
   * minuscules, contrairement au `CouleurFond` des créneaux et des devoirs —
   * et l'intégration la décode sous le même nom que les deux autres familles.
   * `unknown` : chaîne de serveur, filtrée par `subjectColor`.
   *
   * C'est la **seule** famille de cette carte qui en porte une : les notes
   * individuelles n'ont pas de couleur côté protocole, et le bulletin non
   * plus.
   */
  background_color?: unknown;
}

/**
 * Toutes les lignes de cette carte réservent la gouttière de couleur, y
 * compris celles qui ne portent pas de matière (« Élève », « Classe »,
 * « Période ») et celles dont la famille n'en a pas côté protocole (les notes
 * individuelles, le bulletin).
 *
 * La raison est l'alignement, et elle est propre à cette carte : la section
 * « par matière » suit immédiatement la liste des notes **sans intertitre**.
 * Une gouttière posée sur la seule section colorée décalerait les deux listes
 * de trois pixels l'une par rapport à l'autre, ce qui se lirait comme un
 * défaut d'affichage. Voir `RowOptions.accent` pour les trois valeurs.
 */
const NO_COLOR = null;

/**
 * Une matière du bulletin (`_report_attributes`). L'intégration publie aussi
 * `id` et `teachers` : non déclarés, parce qu'un champ déclaré et jamais lu
 * fait croire qu'il est traité.
 */
interface ReportSubject {
  name?: string;
  student_average?: number | string;
  class_average?: number | string;
  coefficient?: number;
  comments?: unknown;
}

const OVERALL: EntityKey = 'sensor:overall_average';
const GRADES: EntityKey = 'sensor:grades';
const AVERAGES: EntityKey = 'sensor:averages';
const CLASS: EntityKey = 'sensor:class_average';
const LATEST: EntityKey = 'sensor:latest_grade';
const PERIOD: EntityKey = 'sensor:current_period';
const REPORT: EntityKey = 'sensor:report_card';

const sectionsOf = (c: Config): Section[] =>
  c.sections && c.sections.length > 0 ? c.sections : ['average', 'latest', 'subjects'];

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-notes',
  name: 'Carnet scolaire — Notes',
  description: 'Moyennes, dernières notes et moyennes par matière.',
  key: 'notes',
  scope: 'child',
  size: 6,
  stub: { sections: ['average', 'latest', 'subjects'] },
  requires: () => [],
  requiresAny: () => [OVERALL, GRADES, AVERAGES],
  optional: () => [CLASS, LATEST, PERIOD, REPORT],
  schema: (_config: Config, t?: Translate) => {
    const tr = t ?? ((path: string) => path);
    return [
      {
        name: 'sections',
        selector: {
          select: {
            multiple: true,
            options: [
              { value: 'average', label: tr('notes.section_average') },
              { value: 'latest', label: tr('notes.section_latest') },
              { value: 'subjects', label: tr('notes.section_subjects') },
              { value: 'report_card', label: tr('notes.section_report_card') },
            ],
          },
        },
      },
      { name: 'limit', selector: { number: { min: 1, max: 50, mode: 'box' } } },
      { name: 'show_date', selector: { boolean: {} } },
      {
        name: 'subjects',
        // Une saisie libre : le formulaire ne connaît pas les matières de
        // l'établissement, et `schema` n'a pas accès à `hass` pour les lire.
        selector: { select: { multiple: true, custom_value: true, options: [] } },
      },
    ];
  },
  render(ctx: RenderCtx<Config>): TemplateResult {
    const c = ctx.config;
    const wanted = sectionsOf(c);
    const blocks: TemplateResult[] = [];
    const keep = subjectFilter(c.subjects);
    const filtered = (c.subjects ?? []).some((s) => s.trim() !== '');

    if (wanted.includes('average') && ctx.status(OVERALL) === 'ok') {
      const overall = ctx.entity(OVERALL);
      blocks.push(
        listRow({
          primary: ctx.t('notes.student'),
          trailing: formatGrade(
            overall?.state,
            ctx.attr<number | string>(OVERALL, 'out_of'),
            ctx.language
          ),
          accent: NO_COLOR,
        })
      );
      if (ctx.status(CLASS) === 'ok') {
        const classEntity = ctx.entity(CLASS);
        blocks.push(
          listRow({
            primary: ctx.t('notes.class'),
            trailing: formatGrade(
              classEntity?.state,
              ctx.attr<number | string>(CLASS, 'out_of'),
              ctx.language
            ),
            accent: NO_COLOR,
          })
        );
      }
    }

    if (wanted.includes('latest')) {
      // Une sentinelle (|1 à |8) rend l'état non numérique : le motif est
      // dans l'attribut `status`, et c'est lui qu'il faut montrer — jamais
      // un vide. `sensor:latest_grade` n'est consulté ici QUE pour ce motif
      // (déclenché seulement quand son état est `unavailable`, donc jamais
      // pour une vraie note) : une vraie note y figurant déjà dans les
      // éléments de `sensor:grades` ci-dessous, la reprendre ici serait un
      // doublon plutôt qu'un oubli.
      const latestStatus = ctx.attr<string>(LATEST, 'status');
      if (ctx.status(LATEST) === 'unavailable' && latestStatus) {
        blocks.push(
          listRow({
            // `notes.name` est le nom de la carte, pas le motif d'une note :
            // un libellé trompeur en repli. `notes.latest_grade` nomme
            // vraiment la ligne quand la matière elle-même est absente.
            primary: ctx.attr<string>(LATEST, 'subject') ?? ctx.t('notes.latest_grade'),
            trailing: latestStatus,
            accent: NO_COLOR,
          })
        );
      }
      // Les plus récentes en tête, sans muter l'attribut, et robuste à une
      // forme inattendue (objet, chaîne, trous) : `latestFirst` s'en charge.
      // Triées par date d'abord : l'intégration garde l'ordre du serveur, qui
      // n'est pas chronologique, et `latestFirst` seul prendrait les
      // dernières REÇUES pour les plus récentes.
      const chronological = sortedBy(
        listAttr<Grade>(ctx.attr(GRADES, 'items')).filter((g) => keep(g.subject)),
        (a, b) => compareInstants(a.date, b.date)
      );
      const items = latestFirst<Grade>(chronological, c.limit ?? 8);
      for (const g of items) {
        blocks.push(
          listRow({
            primary: g.subject ?? '—',
            secondary:
              [
                g.coefficient != null
                  ? ctx.t('notes.coefficient', {
                      value: g.coefficient.toLocaleString(ctx.language),
                    })
                  : '',
                c.show_date === true && g.date
                  ? formatDayLabel(g.date, ctx.language, ctx.timeZone)
                  : '',
              ]
                .filter(Boolean)
                .join(' · ') || undefined,
            trailing: g.status ?? formatGrade(g.value, g.out_of, ctx.language),
            accent: NO_COLOR,
          })
        );
      }
    }

    if (wanted.includes('subjects')) {
      const items = listAttr<Average>(ctx.attr(AVERAGES, 'items')).filter((a) =>
        keep(a.subject)
      );
      for (const a of items) {
        blocks.push(
          listRow({
            primary: a.subject ?? '—',
            secondary:
              a.class_average != null
                ? `${ctx.t('notes.class')} ${formatGrade(a.class_average, a.out_of, ctx.language)}`
                : undefined,
            trailing: formatGrade(a.student, a.out_of, ctx.language),
            // La seule ligne colorée de cette carte, quand l'intégration
            // publie le champ.
            accent: subjectAccent(a.background_color, a.subject, c.subject_colors) ?? NO_COLOR,
          })
        );
      }
    }

    if (wanted.includes('report_card') && ctx.status(REPORT) === 'ok') {
      // Forme confirmée sur la source de l'intégration (`_report_attributes`) :
      // `subjects[]` porte `name`, `student_average`, `class_average`,
      // `coefficient` et `comments`, et l'attribut de premier niveau
      // `comments` porte l'appréciation générale. L'état vaut le nombre de
      // matières, ou rien quand le bulletin n'est pas publié — c'est
      // `ctx.status` qui l'écarte alors, sans que la carte ait à le savoir.
      blocks.push(html`<div class="title">${ctx.t('notes.section_report_card')}</div>`);
      const general = listAttr<unknown>(ctx.attr(REPORT, 'comments'))
        .filter((line): line is string => typeof line === 'string' && line.trim() !== '')
        .join('\n');
      if (general) blocks.push(listRow({ primary: general, accent: NO_COLOR }));
      for (const s of listAttr<ReportSubject>(ctx.attr(REPORT, 'subjects')).filter((r) =>
        keep(r.name)
      )) {
        const parts = [
          s.class_average != null
            ? `${ctx.t('notes.class')} ${formatGrade(s.class_average, undefined, ctx.language)}`
            : '',
          s.coefficient != null
            ? ctx.t('notes.coefficient', { value: s.coefficient.toLocaleString(ctx.language) })
            : '',
          // L'appréciation du professeur, telle qu'il l'a écrite.
          listAttr<unknown>(s.comments)
            .filter((line): line is string => typeof line === 'string' && line.trim() !== '')
            .join('\n'),
        ].filter(Boolean);
        blocks.push(
          listRow({
            primary: s.name ?? '—',
            secondary: parts.length > 0 ? parts.join(' · ') : undefined,
            trailing: formatGrade(s.student_average, undefined, ctx.language),
            accent: NO_COLOR,
          })
        );
      }
    }

    // La période en cours est une information transverse, pas une section :
    // elle s'affiche dès que résolue et exploitable, quelles que soient les
    // sections choisies, et ne compte pas dans le calcul du vide ci-dessous.
    // `current_period` devient *indisponible* plutôt que faux quand
    // l'intégration ne peut pas la déterminer (spec §5.1) : ne rien afficher
    // dans ce cas vaut mieux qu'une période fausse.
    const periodRow =
      ctx.status(PERIOD) === 'ok'
        ? listRow({
            primary: ctx.t('notes.period'),
            trailing: ctx.entity(PERIOD)?.state,
            accent: NO_COLOR,
          })
        : undefined;

    if (blocks.length === 0) {
      // Le vide n'appartient à la carte que si les sources des sections
      // voulues sont là. Le bulletin n'y figure pas : non publié, il vaut
      // `unknown` normalement, et ce n'est pas une collecte en retard.
      const sources: EntityKey[] = [];
      if (wanted.includes('average')) sources.push(OVERALL);
      if (wanted.includes('latest')) sources.push(GRADES);
      if (wanted.includes('subjects')) sources.push(AVERAGES);
      const autre = sourcesState((k) => ctx.status(k), sources, (path, vars) => ctx.t(path, vars), (c.sections?.length ?? 0) > 0);
      if (autre !== undefined) return html`${periodRow ?? ''}${autre}`;
      // Un filtre de matières qui écarte tout le dit : « aucune note pour
      // cette période » serait faux, il y en a, dans d'autres matières.
      if (filtered) {
        return html`${periodRow ?? ''}${emptyState(ctx.t('notes.empty_filtered'))}`;
      }
      // Une carte configurée sur la seule section « par matière » n'a rien
      // à voir avec des notes : le message générique mentirait.
      const subjectsOnly = wanted.length === 1 && wanted[0] === 'subjects';
      return html`
        ${periodRow ?? ''}${emptyState(ctx.t(subjectsOnly ? 'notes.empty_averages' : 'notes.empty'))}
      `;
    }
    return html`${periodRow ?? ''}${blocks}`;
  },
};
