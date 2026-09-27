import { html, type TemplateResult } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx } from '../core/types';
import { emptyState, listRow } from '../core/ui/parts';
import { subjectAccent } from '../core/subject-color';
import { latestFirst, listAttr, sortedBy } from '../core/list';
import { compareInstants, formatDayLabel } from '../core/format';

interface Config extends CarnetCardConfig {
  limit?: number;
  show_acquisitions?: boolean;
  /**
   * La table de couleurs de matière, en YAML seulement — comme sur les cinq
   * autres cartes qui portent une matière. Voir `subjectAccent`.
   */
  subject_colors?: Record<string, string>;
}

/**
 * Une compétence évaluée. `level` est le libellé de maîtrise tel que
 * l'établissement l'écrit — « Très bonne maîtrise », « Maîtrise fragile »… Il
 * n'est JAMAIS traduit : c'est le texte du serveur, et le traduire
 * inventerait une échelle qui n'est pas celle de l'établissement.
 */
interface Acquisition {
  name?: string;
  level?: string;
  abbreviation?: string;
}

/**
 * Une évaluation par compétences.
 *
 * L'intégration publie aussi `id` sur l'évaluation et `domain` sur chaque
 * compétence. Ils ne sont volontairement pas déclarés ici : un champ déclaré
 * et jamais lu fait croire qu'il est traité. Les ajouter le jour où on les
 * affiche.
 */
interface Evaluation {
  /**
   * La couleur de matière telle que le serveur l'écrit, si un jour il
   * l'écrit. `unknown` par honnêteté : un attribut d'entité n'est typé
   * nulle part, et `subjectColor` est ce qui décide de son innocuité.
   */
  background_color?: unknown;
  name?: string;
  subject?: string;
  date?: string;
  acquisitions?: unknown;
}

const EVALUATIONS: EntityKey = 'sensor:evaluations';

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-evaluations',
  name: 'Carnet scolaire — Évaluations',
  description: 'Les évaluations par compétences, avec leur niveau de maîtrise.',
  key: 'evaluations',
  scope: 'child',
  // Une évaluation tient en une ligne, chaque compétence en une de plus.
  // Le détail des compétences multiplie la hauteur ; sans lui, la carte est
  // une simple liste.
  size: (c) => (c.show_acquisitions === false ? 4 : 8),
  stub: { show_acquisitions: true },
  requires: () => [EVALUATIONS],
  optional: () => [],
  // Aucun libellé posé ici : l'éditeur générique les résout lui-même sous la
  // racine de catalogue de la carte (`evaluations.show_acquisitions`,
  // `evaluations.limit`), et cette carte n'a aucune option à choix multiple
  // dont les valeurs demanderaient d'être traduites une à une.
  schema: () => [
    { name: 'show_acquisitions', selector: { boolean: {} } },
    { name: 'limit', selector: { number: { min: 1, max: 50, mode: 'box' } } },
  ],
  render(ctx: RenderCtx<Config>) {
    const c = ctx.config;
    // `listAttr` survit à un attribut absent, nul, ou qui n'est pas un
    // tableau : une exception dans `render` n'affiche pas un message
    // d'erreur, elle efface la carte entière.
    const raw = listAttr<Evaluation>(ctx.attr(EVALUATIONS, 'items'));

    // Le vide appartient à la carte, pas au socle : zéro évaluation est un
    // état normal — c'est même le cas de la rentrée, avant la première
    // évaluation d'une période. Ce n'est pas une panne de collecte.
    if (raw.length === 0) return emptyState(ctx.t('evaluations.empty'));

    // Tri sur l'instant, jamais sur la chaîne : deux dates à décalages
    // horaires différents ne se comparent pas correctement caractère à
    // caractère. Une date illisible part en fin de liste AFFICHÉE plutôt que
    // de s'intercaler au hasard : la liste est chronologique puis lue à
    // l'envers par `latestFirst`, donc c'est en TÊTE de la chronologie
    // qu'elle doit aller. `+Infinity` la plaçait au contraire en tête de la
    // carte, et c'est une évaluation datée que la limite écartait.
    const chronological = sortedBy(raw, (a, b) => compareInstants(a.date, b.date));
    const items = latestFirst<Evaluation>(chronological, c.limit ?? 8);

    const out: TemplateResult[] = [];
    for (const e of items) {
      const when = e.date ? formatDayLabel(e.date, ctx.language, ctx.timeZone) : '';
      out.push(
        listRow({
          primary: e.subject ?? ctx.t('evaluations.name'),
          secondary: e.name,
          trailing: when || undefined,
          accent: subjectAccent(e.background_color, e.subject, c.subject_colors) ?? null,
        })
      );
      if (c.show_acquisitions === false) continue;
      for (const a of listAttr<Acquisition>(e.acquisitions)) {
        // Le niveau brut du serveur, ou son abréviation à défaut. Aucune
        // valeur inventée : une compétence sans niveau s'affiche sans niveau.
        const level = a.level ?? a.abbreviation;
        if (!a.name && !level) continue;
        out.push(
          listRow({
            primary: html`<span class="secondary">${a.name ?? ''}</span>`,
            trailing: level,
            // Gouttière réservée et transparente : une compétence n'est pas une
            // matière, mais elle doit rester alignée sous la ligne qui l'est.
            accent: null,
          })
        );
      }
    }

    return html`${out}`;
  },
};
