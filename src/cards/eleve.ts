import { html, type TemplateResult } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx } from '../core/types';
import { formatTimeWithDay } from '../core/format';
import { chip, listRow } from '../core/ui/parts';

interface Config extends CarnetCardConfig {
  show_photo?: boolean;
  /** Faux par défaut : une carte est une surface partageable. */
  show_establishment?: boolean;
}

const CLASS: EntityKey = 'sensor:class_name';
const PHOTO: EntityKey = 'image:photo';
const IN_CLASS: EntityKey = 'binary_sensor:in_class';
const SCHOOL_DAY: EntityKey = 'binary_sensor:school_day';
const HOLIDAYS: EntityKey = 'binary_sensor:holidays';
const NEXT: EntityKey = 'sensor:next_lesson';
const PERIOD: EntityKey = 'sensor:current_period';

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-eleve',
  name: 'Carnet scolaire — Élève',
  description: 'En-tête de synthèse : classe, état du jour, prochain cours.',
  key: 'eleve',
  scope: 'child',
  size: 3,
  // Faux par défaut : `stub` est la config proposée par le sélecteur HA, et
  // aucune photo d'enfant ne doit être publiée sans que le parent l'ait
  // explicitement demandé.
  stub: {},
  requires: () => [CLASS],
  optional: (c) => [...(c.show_photo ? [PHOTO] : []), IN_CLASS, SCHOOL_DAY, HOLIDAYS, NEXT, PERIOD],
  schema: () => [
    { name: 'show_photo', selector: { boolean: {} } },
    { name: 'show_establishment', selector: { boolean: {} } },
  ],
  render(ctx: RenderCtx<Config>) {
    const lang = ctx.language;
    const tz = ctx.timeZone;
    const rows: TemplateResult[] = [];

    // Le nom vient du registre d'appareils, jamais d'une chaîne du code.
    const secondary = ctx.config.show_establishment
      ? ctx.attr<string>(CLASS, 'establishment')
      : undefined;

    // Une carte tait ce qu'elle ignore : si aucun des trois capteurs d'état
    // n'est résolu (palier désactivé — ils sont `optional`), on ne rend
    // aucune pastille plutôt que d'affirmer « pas de cours » par défaut.
    const stateKnown =
      ctx.status(HOLIDAYS) === 'ok' ||
      ctx.status(IN_CLASS) === 'ok' ||
      ctx.status(SCHOOL_DAY) === 'ok';

    let tone: 'ok' | 'neutral' = 'neutral';
    let stateLabel: string | undefined;
    if (stateKnown) {
      stateLabel = ctx.t('eleve.no_class');
      if (ctx.entity(HOLIDAYS)?.state === 'on') stateLabel = ctx.t('eleve.holidays');
      else if (ctx.entity(IN_CLASS)?.state === 'on') {
        stateLabel = ctx.t('eleve.in_class');
        tone = 'ok';
      } else if (ctx.entity(SCHOOL_DAY)?.state === 'on') stateLabel = ctx.t('eleve.school_day');
    }

    rows.push(
      listRow({
        primary: ctx.deviceName,
        secondary: [ctx.entity(CLASS)?.state, secondary].filter(Boolean).join(' · '),
        trailing: stateLabel ? chip(stateLabel, tone) : undefined,
      })
    );

    if (ctx.status(NEXT) === 'ok') {
      rows.push(
        listRow({
          primary: ctx.t('eleve.next', {
            subject: ctx.attr<string>(NEXT, 'subject') ?? '—',
            time: formatTimeWithDay(ctx.entity(NEXT)?.state, lang, tz),
          }),
        })
      );
    }

    if (ctx.status(PERIOD) === 'ok') {
      rows.push(
        listRow({
          primary: ctx.t('eleve.period', { period: ctx.entity(PERIOD)?.state ?? '—' }),
        })
      );
    }

    // Uniquement l'entity_picture publiée par l'entité `image` : aucune URL
    // construite par la carte, aucun appel au service d'identité complet.
    const picture =
      ctx.config.show_photo && ctx.status(PHOTO) === 'ok'
        ? ctx.attr<string>(PHOTO, 'entity_picture')
        : undefined;

    return html`
      <div class="ident">
        ${picture ? html`<img class="photo" src=${picture} alt="" />` : ''}
        <div class="ident-body">${rows}</div>
      </div>
    `;
  },
};
