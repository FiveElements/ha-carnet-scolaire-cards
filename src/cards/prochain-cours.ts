import { html } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx } from '../core/types';
import { formatDayLabel, formatRelative, formatTime, parseTimestamp } from '../core/format';
import { chip, emptyState, listRow, unavailableState } from '../core/ui/parts';
import { subjectAccent } from '../core/subject-color';

interface Config extends CarnetCardConfig {
  show_wake_up?: boolean;
  show_end_of_day?: boolean;
  show_next_test?: boolean;
  /**
   * La table de couleurs de matière, en YAML seulement — comme sur les cinq
   * autres cartes qui portent une matière. Absente de l'éditeur visuel : un
   * dictionnaire dont les clés varient d'un établissement à l'autre ne se
   * modélise pas dans `ha-form`. Voir `subjectAccent`.
   */
  subject_colors?: Record<string, string>;
}

const NEXT: EntityKey = 'sensor:next_lesson';
const WAKE: EntityKey = 'sensor:next_wake_up';
const END: EntityKey = 'sensor:end_of_lessons';
const TEST: EntityKey = 'sensor:next_test';

/**
 * Deux capteurs binaires optionnels qui parlent de la JOURNÉE, là où le reste
 * de la carte parle du PROCHAIN cours : question différente, donc jamais de
 * doublon possible avec `NEXT`.
 *
 * `in_class` répond à « un cours a-t-il lieu maintenant ? ». Il n'influence
 * jamais quel cours est affiché — la carte continue de montrer le *suivant*
 * — il ajoute seulement un repère de contexte, pour que le lecteur ne prenne
 * pas la ligne affichée pour le cours en cours (même esprit que la variable
 * `IN_CLASS` de emploi-du-temps.ts, rôle différent : ici un simple repère,
 * là-bas un droit de veto sur le surlignage).
 *
 * `lessons_canceled` répond à « des cours sont-ils annulés aujourd'hui ? ».
 * L'attribut `canceled` du prochain cours reste seul maître du cours
 * affiché — strictement plus précis pour CE cours-là — mais ne peut rien
 * dire des autres créneaux de la journée. Cette notice ne marque donc
 * jamais le cours affiché comme annulé ; elle informe seulement qu'un
 * cours de la journée l'est, quelque part.
 */
const IN_CLASS: EntityKey = 'binary_sensor:in_class';
const LESSONS_CANCELED: EntityKey = 'binary_sensor:lessons_canceled';

/** `teachers` arrive tantôt en tableau, tantôt en chaîne selon la version de l'intégration. */
const teachersOf = (value: unknown): string => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return typeof value === 'string' ? value : '';
};

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-prochain-cours',
  name: 'Carnet scolaire — Prochain cours',
  description: 'Le prochain cours : matière, heure, salle, professeur.',
  key: 'prochain_cours',
  scope: 'child',
  size: 2,
  requires: () => [NEXT],
  optional: (c) => [
    ...(c.show_wake_up ? [WAKE] : []),
    ...(c.show_end_of_day ? [END] : []),
    ...(c.show_next_test ? [TEST] : []),
    IN_CLASS,
    LESSONS_CANCELED,
  ],
  schema: () => [
    { name: 'show_wake_up', selector: { boolean: {} } },
    { name: 'show_end_of_day', selector: { boolean: {} } },
    { name: 'show_next_test', selector: { boolean: {} } },
  ],
  // Le rendu affiche `formatRelative` (« dans 30 min »), calculé sur
  // Date.now() : sans repeint périodique, ce texte resterait figé pendant des
  // heures entre deux cycles de collecte PRONOTE alors qu'aucune propriété
  // réactive ne change. Le socle pose et retire lui-même la minuterie.
  tickMs: 60_000,
  /**
   * « Plus aucun cours » et « pas encore collectée » ont la même valeur :
   * `unknown`. Quand plus aucun cours n'est collecté — les vacances, la fin
   * de l'horizon d'emploi du temps — `_next_lesson_start` rend `None` côté
   * intégration, et Home Assistant publie `unknown` pour un capteur
   * TIMESTAMP. Le socle écartait donc la carte, et « Aucun cours à venir »
   * n'était jamais affiché. Seuls les attributs tranchent : `fetched_at`
   * prouve que la collecte a eu lieu (voir FORMES.md, le pendant positif de
   * la règle sur `unavailable`). La carte assume donc les deux phrases.
   */
  attributeDriven: true,
  render(ctx: RenderCtx<Config>) {
    // `attributeDriven` fait parvenir ici un état `unknown` ou `unavailable` :
    // c'est la carte qui dit alors lequel des deux vides s'applique.
    if (ctx.status(NEXT) !== 'ok') {
      const collected =
        ctx.entity(NEXT)?.state === 'unknown' && ctx.attr(NEXT, 'fetched_at') !== undefined;
      return collected ? emptyState(ctx.t('prochain_cours.empty')) : unavailableState((path, vars) => ctx.t(path, vars));
    }
    // Le socle garantit `e` défini ici : NEXT est la seule entité requise,
    // sans `requiresAny`, et son statut vient d'être vérifié.
    const e = ctx.entity(NEXT)!;
    // Le socle ne traite comme « indisponible » que unknown/unavailable : un
    // horodatage qui ne se parse pas (état 'none' notamment, publié par
    // l'intégration quand il n'y a plus de cours — mais aussi tout autre état
    // que l'intégration pourrait publier sans que ce soit un vide) reste ici
    // du ressort de la carte — c'est le vide qui lui appartient. Un état non
    // parsable ne veut pas dire que la carte n'a rien à montrer : matière,
    // salle et professeurs peuvent rester exploitables.
    const start = parseTimestamp(e.state);

    const tz = ctx.timeZone;
    const lang = ctx.language;
    const subject = (ctx.attr<string>(NEXT, 'subject') ?? '').trim();
    // La couleur de matière, résolue comme sur les cinq autres cartes :
    // serveur, puis table de l'utilisateur, puis rien. Les lignes qui ne
    // portent pas de matière — salle, professeurs, réveil, fin de journée —
    // réservent la gouttière sans la colorer, pour rester alignées sous
    // celle qui la porte.
    const accent = subjectAccent(
      ctx.attr(NEXT, 'background_color'),
      subject,
      ctx.config.subject_colors
    );
    const room = ctx.attr<string>(NEXT, 'classroom');
    const teachers = teachersOf(ctx.attr(NEXT, 'teachers'));
    const canceled = ctx.attr<boolean>(NEXT, 'canceled') === true;

    // Rien d'exploitable nulle part : c'est là, et seulement là, que le vide
    // appartient à la carte.
    if (!start && !subject && !room && !teachers) {
      return emptyState(ctx.t('prochain_cours.empty'));
    }

    const endRaw = ctx.attr<string>(NEXT, 'end');
    const endTime = parseTimestamp(endRaw) ? formatTime(endRaw, lang, tz) : '';
    const startTime = start ? formatTime(e.state, lang, tz) : '';
    /**
     * Une heure de fin peut être DÉDUITE plutôt que fournie.
     *
     * Quand PRONOTE omet la fin d'un cours, l'intégration la calcule depuis la
     * position du créneau dans la grille — et le code amont qui s'en charge
     * porte en commentaire « might be wrong ». Sur certains établissements
     * c'est systématique. La présenter comme une heure du serveur serait une
     * affirmation que personne ne peut tenir : on la marque d'un « ≈ », dont
     * le sens est donné en infobulle.
     */
    const endInferred = ctx.attr<boolean>(NEXT, 'end_inferred') === true;
    const endLabel = endInferred
      ? html`<span title=${ctx.t('common.inferred_time')}>≈${endTime}</span>`
      : endTime;
    const timeRange = endTime ? html`${startTime} – ${endLabel}` : html`${startTime}`;

    // Deux entités optionnelles muettes tant qu'elles ne sont pas résolues à
    // 'on' : absentes, non résolues ou à 'off', elles ne produisent aucune
    // pastille — l'absence d'information n'est pas une information (spec
    // « les trois états », qui appartient ici entièrement à la carte
    // puisque ces deux clés sont optionnelles).
    // Quand un cours est en train de se dérouler, la pastille « Cours en ce
    // moment » surplombe une ligne qui décrit le cours SUIVANT : sur une
    // instance réelle, cela donnait « Cours en ce moment / FRANCAIS 10:30 –
    // 11:30 · dans 28 min », qu'on lit comme si FRANCAIS était le cours en
    // train de se dérouler. Un intitulé explicite sépare les deux — posé
    // seulement dans ce cas, puisque sans pastille il n'y a aucune ambiguïté
    // à lever et le titre ne serait qu'une redite.
    const inClass = ctx.status(IN_CLASS) === 'ok' && ctx.entity(IN_CLASS)?.state === 'on';
    const lessonsCanceledToday =
      ctx.status(LESSONS_CANCELED) === 'ok' && ctx.entity(LESSONS_CANCELED)?.state === 'on';

    return html`
      ${
        inClass || lessonsCanceledToday
          ? html`<div class="row">
              ${inClass ? chip(ctx.t('prochain_cours.in_class')) : ''}
              ${lessonsCanceledToday ? chip(ctx.t('prochain_cours.lessons_canceled'), 'warn') : ''}
            </div>`
          : ''
      }
      ${inClass ? html`<div class="title">${ctx.t('prochain_cours.name')}</div>` : ''}
      ${listRow({
        primary: subject || ctx.t('prochain_cours.name'),
        secondary: start ? html`${timeRange} · ${formatRelative(e.state, lang)}` : undefined,
        trailing: canceled ? chip(ctx.t('prochain_cours.canceled'), 'problem') : undefined,
        canceled,
        accent: accent ?? null,
      })}
      ${room ? listRow({ primary: ctx.t('prochain_cours.room', { room }), accent: null }) : ''}
      ${teachers ? listRow({ primary: teachers, accent: null }) : ''}
      ${
        ctx.config.show_wake_up && ctx.status(WAKE) === 'ok'
          ? listRow({
              primary: ctx.t('prochain_cours.wake_up', {
                time: formatTime(ctx.entity(WAKE)?.state, lang, tz),
              }),
              accent: null,
            })
          : ''
      }
      ${
        ctx.config.show_end_of_day && ctx.status(END) === 'ok'
          ? listRow({
              // Même réserve que pour la fin du cours : la fin de journée se
              // déduit du dernier créneau, dont la fin peut elle-même l'être.
              primary: html`${ctx.t('prochain_cours.end_of_day', {
                time: formatTime(ctx.entity(END)?.state, lang, tz),
              })}${
                ctx.attr<boolean>(END, 'end_inferred') === true
                  ? html` <span title=${ctx.t('common.inferred_time')}>≈</span>`
                  : ''
              }`,
              accent: null,
            })
          : ''
      }
      ${
        ctx.config.show_next_test && ctx.status(TEST) === 'ok'
          ? listRow({
              // Contrairement à `wake_up`/`end_of_day`, un contrôle n'a aucune
              // raison de tomber le jour même : le jour et l'heure comptent
              // tous les deux, d'où `formatDayLabel` en plus de `formatTime`
              // (mêmes outils — ctx.language, ctx.timeZone — que les deux
              // autres lignes). L'intégration ne documente aucun attribut de
              // matière sur cette entité : mieux vaut une ligne juste
              // qu'une ligne enrichie d'une donnée supposée.
              primary: ctx.t('prochain_cours.next_test'),
              secondary: [
                formatDayLabel(ctx.entity(TEST)?.state, lang, tz),
                formatTime(ctx.entity(TEST)?.state, lang, tz),
              ]
                .filter(Boolean)
                .join(' · '),
              accent: null,
            })
          : ''
      }
    `;
  },
};
