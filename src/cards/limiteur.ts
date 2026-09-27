import { html, type TemplateResult } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx } from '../core/types';
import { durationToMinutes, formatDuration, formatRelative, formatTimeWithDay } from '../core/format';
import { chip, listRow } from '../core/ui/parts';
import { listAttr } from '../core/list';

interface Config extends CarnetCardConfig {
  show_refresh?: boolean;
  refresh_tier?: string;
}

const STATE: EntityKey = 'sensor:limiter_state';
const BUDGET: EntityKey = 'sensor:remaining_budget';
const CALLS: EntityKey = 'sensor:calls_today';
const NEXT: EntityKey = 'sensor:next_collection';
const LAST: EntityKey = 'sensor:last_collection';
const SESSION_AGE: EntityKey = 'sensor:session_age';
const SESSION_LIFETIME: EntityKey = 'sensor:session_lifetime';
const LOGINS: EntityKey = 'sensor:logins_today';
const THROTTLED: EntityKey = 'binary_sensor:throttled';

const TONES: Record<string, 'ok' | 'warn' | 'problem'> = {
  nominal: 'ok',
  throttled: 'warn',
  quiet_hours: 'warn',
  backoff: 'problem',
  credentials_hold: 'problem',
  bootstrap_failed: 'problem',
};

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-limiteur',
  name: 'Carnet scolaire — Limiteur',
  description: "Budget d'appels, état du limiteur et prochaine collecte.",
  key: 'limiteur',
  // Les entités de diagnostic sont sur l'appareil de compte. Le socle suit
  // via_device_id : l'utilisateur configure quand même l'appareil de l'enfant,
  // comme pour les sept autres cartes.
  scope: 'account',
  size: 5,
  // tickMs déclaratif : ce n'est pas un changement de propriété réactive qui
  // regrise le bouton en fin d'intervalle de garde (`ctx.refreshCoolingDown`
  // est calculé une fois par rendu, à partir de `Date.now()`) — sans cette
  // minuterie, la carte resterait grisée bien après la fin de la garde. Le
  // socle pose et retire l'intervalle ; on ne met jamais de `setInterval` ici.
  tickMs: 30_000,
  requires: () => [STATE],
  optional: () => [BUDGET, CALLS, NEXT, LAST, SESSION_AGE, SESSION_LIFETIME, LOGINS, THROTTLED],
  schema: () => [
    { name: 'show_refresh', selector: { boolean: {} } },
    { name: 'refresh_tier', selector: { text: {} } },
  ],
  render(ctx: RenderCtx<Config>) {
    const lang = ctx.language;
    const tz = ctx.timeZone;
    const out: TemplateResult[] = [];

    // STATE est la seule entité requise (pas de `requiresAny`) : le socle
    // garantit qu'elle est résolue et hors unknown/unavailable avant d'appeler
    // `render` (spec §4.3). Un repli `?? 'nominal'` ici serait du code mort
    // dangereux : s'il s'exécutait un jour, il afficherait une pastille verte
    // « Nominal » pour un état que la carte n'a en réalité pas pu lire.
    const state = ctx.entity(STATE)!.state;
    const until = ctx.attr<string>(STATE, 'until');
    // **Les six libellés sont ceux de l'entité, pas ceux de la carte.** Trois
    // divergeaient jusqu'au 10 septembre 2026 : `backoff` se lisait ici
    // « En retrait » quand l'intégration dit « Temporisation »,
    // `credentials_hold` « Identifiants en attente » pour « Connexions
    // suspendues », `bootstrap_failed` « Démarrage en échec » pour « Page de
    // session illisible ».
    //
    // Deux de ces trois étaient des contresens, et le pire est
    // `credentials_hold` : « en attente » se lit « on attend que vous
    // saisissiez vos identifiants », alors que le sens est l'inverse —
    // l'intégration a suspendu d'elle-même toute tentative après trois refus
    // dans l'heure. Le libellé poussait donc à ressaisir le mot de passe,
    // c'est-à-dire au geste exact que la pause existe pour empêcher, là où
    // PRONOTE sanctionne l'adresse IP.
    //
    // La règle qui en sort et qui vaut pour toute valeur d'énumération :
    // **l'historique, le journal de bord et la boîte de dialogue d'entité
    // portent le libellé de l'entité**, et ce sont les surfaces où l'on
    // enquête après coup. Une carte est une vue de cette entité ; si elle
    // reformule, le même incident se relit sous deux noms selon l'écran.
    // C'est ainsi que le défaut a été trouvé — un état lu sur une carte,
    // introuvable dans la documentation du socle. Ne renommez pas ces six
    // chaînes sans que l'intégration bouge d'abord.
    //
    // `localize` (via `ctx.t`) rend le chemin lui-même quand la clé manque :
    // c'est le signal du repli, jamais un texte à montrer tel quel. Un état
    // que le catalogue ne connaît pas encore (l'intégration en ajoute un avant
    // que les traductions suivent) retombe donc sur l'état brut plutôt que sur
    // la clé technique.
    const stateKey = `limiteur.state_${state}`;
    const stateLabel = ctx.t(stateKey);
    out.push(
      listRow({
        primary: ctx.t('limiteur.state'),
        secondary: until
          ? ctx.t('limiteur.until', { time: formatTimeWithDay(until, lang, tz) })
          : undefined,
        trailing: chip(stateLabel === stateKey ? state : stateLabel, TONES[state] ?? 'neutral'),
      })
    );

    if (ctx.status(BUDGET) === 'ok') {
      const cap = ctx.attr<number>(BUDGET, 'daily_cap');
      out.push(
        listRow({
          primary: ctx.t('limiteur.budget'),
          secondary: cap !== undefined ? ctx.t('limiteur.budget_of', { cap }) : undefined,
          trailing: ctx.entity(BUDGET)?.state,
        })
      );
    }

    if (ctx.status(CALLS) === 'ok') {
      out.push(
        listRow({ primary: ctx.t('limiteur.calls_today'), trailing: ctx.entity(CALLS)?.state })
      );
      const byTier = ctx.attr<Record<string, number>>(CALLS, 'by_tier') ?? {};
      const tiers = Object.entries(byTier);
      if (tiers.length > 0) {
        out.push(html`<div class="title">${ctx.t('limiteur.by_tier')}</div>`);
        for (const [tier, n] of tiers) {
          out.push(listRow({ primary: tier, trailing: String(n) }));
        }
      }
    }

    if (ctx.status(LAST) === 'ok') {
      out.push(
        listRow({
          primary: ctx.t('limiteur.last_collection'),
          secondary: ctx.attr<string>(LAST, 'tier'),
          trailing: formatRelative(ctx.entity(LAST)?.state, lang),
        })
      );
    }

    if (ctx.status(NEXT) === 'ok') {
      // `tiers_due` n'est typé nulle part côté registre : un attribut qui
      // n'est pas un tableau ferait lever `join` ici, ce qui effacerait toute
      // la carte plutôt que de dégrader seulement cette ligne.
      const due = listAttr<string>(ctx.attr(NEXT, 'tiers_due'));

      /**
       * Une échéance passée est une lecture légitime : un palier est en
       * retard. Mais « il y a 38 min » sur une PROCHAINE collecte se lit comme
       * une erreur d'affichage, et n'apprend rien sur la cause.
       *
       * `overdue_by` (secondes de retard, 0 à l'heure) et `failing` (palier →
       * nombre d'échecs consécutifs) séparent deux situations que le seul
       * horodatage confondait : « l'échéance est passée et rien n'a tourné »
       * et « il tourne et échoue à chaque fois ». Les deux attributs sont
       * récents côté intégration : absents, la ligne reste celle d'avant.
       */
      const overdueBy = ctx.attr<number>(NEXT, 'overdue_by');
      const overdue = typeof overdueBy === 'number' && overdueBy > 0;
      const failing = ctx.attr(NEXT, 'failing');
      const failingTiers =
        typeof failing === 'object' && failing !== null && !Array.isArray(failing)
          ? Object.keys(failing)
          : [];

      /**
       * Ne pas nommer deux fois le même palier.
       *
       * Le cas réel observé est `tiers_due: ['static']` avec
       * `failing: { static: 2 }` — un palier jamais collecté est dû
       * « maintenant », donc son retard vaut zéro alors qu'il échoue depuis
       * le démarrage. La ligne affichait « static · en échec : static ».
       *
       * Quand les deux ensembles coïncident, seul l'échec est dit : il porte
       * déjà le nom du palier ET la raison. « aucun palier en attente » ne
       * s'affiche que si rien n'est ni dû ni en échec — sinon la ligne se
       * contredirait elle-même.
       */
      const detail = [
        failingTiers.length > 0
          ? // Les paliers dus QUI NE SONT PAS déjà nommés par l'échec.
            due.filter((tier) => !failingTiers.includes(tier)).join(', ')
          : due.length > 0
            ? due.join(', ')
            : ctx.t('limiteur.none'),
        overdue
          ? ctx.t('limiteur.overdue', {
              duration: formatDuration(Math.round(overdueBy / 60), lang),
            })
          : '',
        failingTiers.length > 0
          ? ctx.t('limiteur.failing', { tiers: failingTiers.join(', ') })
          : '',
      ]
        .filter(Boolean)
        .join(' · ');

      out.push(
        listRow({
          primary: ctx.t('limiteur.next_collection'),
          secondary: detail,
          // Une échéance en retard n'a plus rien à dire en relatif : c'est le
          // retard lui-même qui porte l'information, déjà dans `secondary`.
          trailing: overdue ? undefined : formatRelative(ctx.entity(NEXT)?.state, lang),
        })
      );
    }

    if (ctx.status(LOGINS) === 'ok') {
      out.push(
        listRow({ primary: ctx.t('limiteur.logins_today'), trailing: ctx.entity(LOGINS)?.state })
      );
    }

    /**
     * Les deux durées de session, mises en forme selon l'unité que l'entité
     * DÉCLARE — et non selon celle qu'on croit qu'elle publie.
     *
     * Les deux capteurs n'ont pas la même unité : l'âge est en secondes,
     * la durée de vie en minutes. La carte les traitait tous les deux comme
     * des minutes et affichait « 22 h 33 » pour une session de 29 minutes.
     * Un facteur 60 sur une durée reste un nombre plausible : c'est ce qui
     * l'a rendu invisible, sur la page comme dans les tests.
     */
    const durationRow = (key: EntityKey, labelKey: string): void => {
      if (ctx.status(key) !== 'ok') return;
      const published = ctx.entity(key)?.state;
      const unit = ctx.attr<string>(key, 'unit_of_measurement');
      const minutes = durationToMinutes(published, unit);
      out.push(
        listRow({
          primary: ctx.t(labelKey),
          // Unité absente ou inconnue : on rend ce que l'entité publie, tel
          // quel. Moins joli qu'une durée mise en forme, mais une conversion
          // devinée serait plausible ET fausse — le défaut qu'on vient de
          // corriger.
          trailing:
            minutes === undefined
              ? [published, unit].filter(Boolean).join(' ')
              : formatDuration(minutes, lang),
        })
      );
    };

    durationRow(SESSION_AGE, 'limiteur.session_age');
    durationRow(SESSION_LIFETIME, 'limiteur.session_lifetime');

    // `binary_sensor:throttled` recoupe la pastille d'état : quand
    // `sensor:limiter_state` vaut déjà `throttled`, la pastille l'affirme et
    // ce capteur binaire n'apporterait rien de plus — l'afficher quand même
    // dupliquerait la même affirmation sur deux surfaces, avec le risque
    // qu'elles se désaccordent un jour (l'un `on`, l'autre pas encore
    // remonté à `throttled`) sans qu'on sache laquelle croire. Il n'est donc
    // rendu que quand il porte une information que la pastille ne porte pas
    // déjà : bridé alors que l'état affiché n'est pas `throttled`.
    if (
      state !== 'throttled' &&
      ctx.status(THROTTLED) === 'ok' &&
      ctx.entity(THROTTLED)?.state === 'on'
    ) {
      out.push(html`<div class="notice">${ctx.t('limiteur.throttled')}</div>`);
    }

    if (ctx.config.show_refresh) {
      // Un boost est plafonné à un par palier et par intervalle : le bouton se
      // grise après appel, parce qu'une interface qui laisse cliquer sans
      // effet est une interface qui ment. L'appel ne part jamais d'ici — il
      // ne part que depuis ce gestionnaire de clic, jamais depuis render.
      // `aria-describedby` relie le bouton à la note explicative ci-dessous :
      // sans ça, rien ne dit au lecteur d'écran — ni à l'œil qui ne lit pas
      // le petit texte en italique — pourquoi le bouton est grisé.
      out.push(html`
        <div class="row">
          <button
            ?disabled=${ctx.refreshCoolingDown}
            aria-describedby="limiteur-refresh-note"
            @click=${() => {
              void ctx.refresh(ctx.config.refresh_tier);
            }}
          >
            ${ctx.refreshCoolingDown ? ctx.t('common.refresh_pending') : ctx.t('common.refresh')}
          </button>
        </div>
        <div id="limiteur-refresh-note" class="notice">${ctx.t('limiteur.refresh_note')}</div>
        ${
          ctx.refreshFailed
            ? html`<div class="notice problem">${ctx.t('limiteur.refresh_failed')}</div>`
            : ''
        }
      `);
    }

    return html`${out}`;
  },
};
