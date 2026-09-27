import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HassEntity, HomeAssistant } from './ha-types';
import { createResolveCache, resolveDevice } from './resolve';
import { dropDanglingOverrides } from './overrides';
import type {
  AllowedCall,
  AllowedResponseCall,
  CardSpec,
  EntityKey,
  EntityStatus,
  CarnetCardConfig,
  RenderCtx,
  Translate,
} from './types';
import { sharedStyles } from './ui/styles';
import { errorState, missingState, unavailableState } from './ui/parts';
import { localize } from '../localize';
import { dateTimeFormat } from './intl';

/** Un boost est plafonné à un par palier et par intervalle côté intégration. */
export const REFRESH_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Ce qui reste de la garde quand l'appel a été **rejeté**.
 *
 * Une minute, et le nombre est un compromis entre deux faits qui se sont
 * présentés dans cet ordre.
 *
 * Le premier : le propriétaire a demandé, le 10 septembre 2026, qu'un appel
 * rejeté ne verrouille plus le bouton un quart d'heure. Il l'avait payé — son
 * clic échouait sur un défaut de forme, et la garde le punissait quand même.
 *
 * Le second, rapporté par la session de l'intégration puis vérifié dans son
 * source, et qui contredit l'argument que j'avais donné au propriétaire pour
 * emporter sa décision. J'affirmais qu'une priorité relevée deux fois ne
 * place aucune requête. **C'est vrai d'un palier sain et faux d'un palier en
 * échec**, pour trois raisons qui s'additionnent :
 *
 * - `scheduler.py` n'arme le plafond du boost (`boost_served_at`) que dans
 *   `mark_collected`, et sous `if state.boosted`. Un palier qui échoue n'y
 *   passe jamais, donc le plafond ne s'arme jamais, donc **chaque clic est
 *   accepté** ;
 * - `request()` remet `not_before = 0.0`, ce qui efface le plancher que
 *   `mark_failed` avait posé précisément pour qu'un palier quotidien ne soit
 *   pas rejoué à chaque tick de cinq minutes ;
 * - et le maintien du limiteur ne rattrape pas toujours : `account.py`
 *   appelle `coordinator.note_failure()`, jamais `limiter.note_failure()`.
 *   Un palier qui échoue par la **forme** de la réponse n'ouvre donc aucun
 *   maintien, et là chaque clic accepté achète une requête réelle — contre
 *   un serveur dont la seule sanction porte sur l'adresse IP.
 *
 * Rendre la garde à zéro ouvrait donc un chemin de clics répétés sur
 * exactement le cas où l'on clique plusieurs fois : celui où ça ne marche
 * pas. Une minute retire la punition dont le propriétaire s'est plaint sans
 * ouvrir ce chemin. Ce n'est pas la réponse complète — la question « un
 * boost doit-il pouvoir effacer un plancher d'échec ? » se règle dans
 * l'ordonnanceur, pas ici.
 */
export const REFRESH_REJECTED_COOLDOWN_MS = 60 * 1000;

const ABSENT_STATES = new Set(['unknown', 'unavailable']);

/**
 * Le fuseau à passer à `Intl`, déduit de la préférence de l'utilisateur.
 *
 * `hass.locale.time_zone` ne vaut pas un identifiant IANA : c'est un choix
 * d'affichage, `'local'` (le fuseau du navigateur) ou `'server'` (celui de
 * l'instance, publié dans `hass.config.time_zone`). Le socle passait cette
 * valeur telle quelle à `Intl.DateTimeFormat`, qui lève une `RangeError` sur
 * `'local'` — et une exception dans `render()` n'affiche pas un message
 * d'erreur : elle laisse la carte entièrement vide. Sur une instance réelle,
 * les deux cartes qui mettent en forme une date ne rendaient plus rien du
 * tout, en jetant une exception à chaque évènement de la maison.
 *
 * On ne fait jamais confiance à la valeur obtenue sans la vérifier : un
 * fuseau que le moteur ne connaît pas ramènerait exactement la même panne.
 */
export function resolveTimeZone(hass: {
  locale?: { time_zone?: string };
  config?: { time_zone?: string };
}): string {
  // Le formateur vient du cache (voir `intl.ts`) : le fuseau du navigateur
  // est donc lu une fois par chargement de page. Un ordinateur qui change de
  // fuseau en cours de session garde l'ancien jusqu'au rechargement, ce que
  // fait aussi le reste du frontal de Home Assistant.
  const browser = ((): string => {
    try {
      return dateTimeFormat(undefined).resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  })();
  const preference = hass.locale?.time_zone;
  const candidate =
    preference === 'server'
      ? hass.config?.time_zone
      : preference === 'local' || preference === undefined || preference === ''
        ? browser
        : // Une valeur inattendue est peut-être déjà un identifiant IANA :
          // on la teste plutôt que de la jeter.
          preference;
  return usable(candidate) ? candidate : usable(browser) ? browser : 'UTC';
}

/**
 * Les réglages d'affichage qui changent le rendu sans changer aucun état :
 * la langue, la préférence de fuseau et le fuseau de l'instance. Lus sur une
 * valeur non typée, parce que l'ancien `hass` de `shouldUpdate` en est une.
 */
const champ = (o: unknown, k: string): unknown =>
  typeof o === 'object' && o !== null ? (Reflect.get(o, k) as unknown) : undefined;

function settingsOf(hass: object): {
  language: unknown;
  localeZone: unknown;
  serverZone: unknown;
} {
  return {
    language: champ(hass, 'language'),
    localeZone: champ(champ(hass, 'locale'), 'time_zone'),
    serverZone: champ(champ(hass, 'config'), 'time_zone'),
  };
}

function usable(timeZone: string | undefined): timeZone is string {
  if (!timeZone) return false;
  try {
    // Le constructeur est le seul validateur disponible : `Intl` n'expose
    // aucun « ce fuseau existe-t-il ». On garde sa sortie pour que la règle
    // no-new ne voie pas une construction pour effet de bord.
    const probe = dateTimeFormat('en', { timeZone });
    return probe.resolvedOptions().timeZone !== undefined;
  } catch {
    return false;
  }
}

/**
 * La garde de rafraîchissement survit au rechargement de la page.
 *
 * Elle vivait en mémoire d'instance : recharger l'onglet réarmait le bouton
 * alors que le serveur, lui, refusait toujours le boost. L'utilisateur
 * appuyait, rien ne se passait, et il recommençait — exactement le
 * comportement que le plafond existe pour éviter, sur un serveur qui
 * sanctionne l'adresse IP.
 *
 * La clé porte l'appareil : deux enfants ont chacun leur garde. Le stockage
 * peut être refusé (navigation privée, réglages du navigateur) ; dans ce cas
 * on retombe silencieusement sur le comportement d'avant, dégradé mais jamais
 * bloquant.
 *
 * Ce que cela ne corrige PAS : la garde reste globale par appareil, alors que
 * le plafond serveur est par palier. Deux paliers différents partagent donc
 * une garde qu'ils ne devraient pas partager. Le remède complet est une
 * entité de diagnostic côté intégration, qui n'existe pas.
 */
const GUARD_PREFIX = 'carnet-scolaire-cards:refreshed-at:';

const readGuard = (deviceId: string | undefined): number => {
  if (!deviceId) return 0;
  try {
    return Number(globalThis.localStorage?.getItem(GUARD_PREFIX + deviceId)) || 0;
  } catch {
    return 0;
  }
};

const writeGuard = (deviceId: string | undefined, at: number): void => {
  if (!deviceId) return;
  try {
    globalThis.localStorage?.setItem(GUARD_PREFIX + deviceId, String(at));
  } catch {
    // Stockage indisponible : la garde reste celle de l'instance.
  }
};

export function makeCardClass(spec: CardSpec): CustomElementConstructor {
  class CarnetCardBase extends LitElement {
    static styles = sharedStyles;

    @property({ attribute: false }) hass?: HomeAssistant;
    @state() private config?: CarnetCardConfig;
    @state() private refreshedAt = 0;
    @state() private refreshFailed = false;
    // Bascule à chaque tour de la minuterie déclarative (spec.tickMs) : sa
    // seule fonction est de forcer un repeint pour les cartes qui dépendent
    // de Date.now() sans qu'aucune propriété réactive ne change (compte à
    // rebours, créneau en cours, bouton grisé du limiteur).
    @state() private tick = 0;
    // Curseur de navigation local (voir RenderCtx.cursor). Dans l'instance de
    // l'élément et jamais dans la configuration : une position de consultation
    // écrite dans le tableau de bord y resterait pour tout le monde.
    @state() private cursor = 0;
    private tickTimer?: ReturnType<typeof setInterval>;

    private resolved = new Map<EntityKey, string>();
    // Langue de Home Assistant, jamais un repli français codé en dur — sauf
    // en setConfig, où hass n'est pas encore posé (voir cette méthode).
    private t: Translate = (path, vars) => localize(path, vars, this.hass?.language);

    // Mémoïse le balayage du registre (Object.values(hass.entities).filter(...))
    // sur l'identité de hass.entities ET hass.devices, partagé avec
    // l'éditeur (voir editor.ts) : Home Assistant remplace tout l'objet hass
    // à chaque mise à jour d'état, mais ces deux sous-objets ne changent que
    // si le registre lui-même a changé. resolveEntities consulte les deux
    // (via resolveDevice) : oublier devices rendrait une résolution périmée
    // quand un appareil apparaît/disparaît.
    private resolveCache = createResolveCache();

    connectedCallback(): void {
      super.connectedCallback();
      if (spec.tickMs !== undefined) {
        this.tickTimer = setInterval(() => {
          this.tick++;
        }, spec.tickMs);
      }
    }

    disconnectedCallback(): void {
      super.disconnectedCallback();
      // Une fuite d'intervalle sur un tableau de bord ouvert en permanence
      // est un vrai défaut : la minuterie ne doit jamais survivre à la carte.
      if (this.tickTimer !== undefined) {
        clearInterval(this.tickTimer);
        this.tickTimer = undefined;
      }
    }

    setConfig(config: CarnetCardConfig): void {
      if (!config || typeof config !== 'object' || typeof config.type !== 'string') {
        throw new Error(this.t('common.bad_config'));
      }
      this.config = config;
      // La configuration a changé : la carte n'est plus celle qu'on
      // consultait, et un curseur hérité de l'ancienne afficherait un jour
      // qui n'a rien à voir avec la nouvelle.
      this.cursor = 0;
    }

    getCardSize(): number {
      if (typeof spec.size === 'function') {
        // Home Assistant peut interroger la taille avant `setConfig` : dans ce
        // cas la carte n'a rien à mesurer, et le repli vaut mieux qu'un appel
        // sur une configuration absente.
        return this.config ? spec.size(this.config) : 3;
      }
      return spec.size ?? 3;
    }

    static getConfigElement(): HTMLElement {
      const el = document.createElement('carnet-scolaire-card-editor') as HTMLElement & {
        spec?: CardSpec;
      };
      el.spec = spec;
      return el;
    }

    static getStubConfig(): Partial<CarnetCardConfig> {
      return { type: `custom:${spec.type}`, ...spec.stub };
    }

    private entityKeys(config: CarnetCardConfig): {
      required: EntityKey[];
      any: EntityKey[];
      all: EntityKey[];
    } {
      const required = spec.requires(config);
      const any = spec.requiresAny?.(config) ?? [];
      return { required, any, all: [...required, ...any, ...spec.optional(config)] };
    }

    /**
     * Home Assistant remplace l'objet `hass` à chaque mise à jour d'état, et
     * le `hasChanged` par défaut de Lit est `!==` : sans ce garde-fou,
     * `render()` — et donc le balayage du registre — partirait à chaque
     * évènement d'état de la maison, y compris sans rapport avec cette carte.
     * On ne laisse passer que : la config a changé, un refresh vient d'avoir
     * lieu, le registre (entities/devices) a changé d'identité, ou l'état
     * d'une entité déjà résolue par cette carte a changé.
     *
     * Le registre compte au moins autant que les états : une carte qui
     * affiche « entité introuvable » attend précisément que l'entité
     * apparaisse au registre (le propriétaire active le palier concerné) ;
     * sans ce déclencheur, elle ne se repeindrait jamais. Même chose pour
     * `devices`, qui alimente la branche « appareil introuvable ».
     */
    protected shouldUpdate(changed: PropertyValues): boolean {
      if (!this.hasUpdated) return true;
      // Ces changements locaux doivent toujours repeindre, qu'ils
      // s'accompagnent ou non d'un changement de `hass` : la config, un
      // refresh qui vient d'aboutir ou d'échouer, et un tour de la
      // minuterie déclarative (spec.tickMs).
      if (
        changed.has('config') ||
        changed.has('refreshedAt') ||
        changed.has('refreshFailed') ||
        changed.has('tick') ||
        changed.has('cursor')
      ) {
        return true;
      }
      if (!changed.has('hass')) return true;
      const oldHass = changed.get('hass');
      const hass = this.hass;
      if (
        !hass ||
        typeof oldHass !== 'object' ||
        oldHass === null ||
        !('states' in oldHass) ||
        !('entities' in oldHass) ||
        !('devices' in oldHass)
      ) {
        return true;
      }
      if (oldHass.entities !== hass.entities || oldHass.devices !== hass.devices) return true;
      // La langue et le fuseau alimentent `ctx.t`, `ctx.language` et
      // `ctx.timeZone` : les changer dans son profil, sans qu'aucun état
      // bouge, laissait la carte dans l'ancienne langue et les anciennes
      // heures. On compare les VALEURS, pas les objets, pour ne pas repeindre
      // à chaque évènement de la maison si le frontal recrée `locale`.
      const before = settingsOf(oldHass);
      const now = settingsOf(hass);
      if (
        before.language !== now.language ||
        before.localeZone !== now.localeZone ||
        before.serverZone !== now.serverZone
      ) {
        return true;
      }
      const oldStates = oldHass.states;
      for (const id of this.resolved.values()) {
        if (oldStates[id] !== hass.states[id]) return true;
      }
      return false;
    }

    private resolveAll(
      hass: HomeAssistant,
      config: CarnetCardConfig,
      keys: EntityKey[]
    ): Map<EntityKey, string> {
      return this.resolveCache.resolve(hass, config.device_id, spec.scope, keys, config.entities);
    }

    protected render(): TemplateResult | typeof nothing {
      const hass = this.hass;
      const config = this.config;
      if (!hass || !config) return nothing;

      if (!config.device_id && !config.entities) {
        return this.frame(html`<div class="notice">${this.t('common.no_device')}</div>`);
      }
      if (config.device_id && !hass.devices[config.device_id]) {
        return this.frame(
          html`<div class="notice problem">${this.t('common.unknown_device')}</div>`
        );
      }

      const { required, any, all } = this.entityKeys(config);
      this.resolved = this.resolveAll(hass, config, all);
      // Une surcharge qui ne désigne rien tombe en « introuvable » : voir
      // `dropDanglingOverrides`.
      this.resolved = dropDanglingOverrides(hass, this.resolved, config.entities);

      // État 1 — entité absente du registre pour cet appareil.
      const missingRequired = required.filter((k) => !this.resolved.has(k));
      const anyUnsatisfied = any.length > 0 && !any.some((k) => this.resolved.has(k));
      if (missingRequired.length > 0 || anyUnsatisfied) {
        const keys = missingRequired.length > 0 ? missingRequired : any;
        return this.frame(missingState(keys, this.t));
      }

      // État 2 — entité présente, état non collecté. Transitoire, pas une erreur.
      //
      // TOUTES les clés requises doivent être exploitables, plus au moins une
      // des ancres de `requiresAny`. Le socle ne vérifiait qu'UNE ancre, prise
      // dans `requiresAny` dès qu'il existait : une seconde clé requise à
      // `unknown` arrivait alors jusqu'au rendu, où la carte pouvait
      // l'afficher comme une valeur.
      const exploitable = (k: EntityKey): boolean => {
        const e = this.entityFor(k);
        return e !== undefined && !ABSENT_STATES.has(e.state);
      };
      const resolvedAny = any.filter((k) => this.resolved.has(k));
      const hasUsable =
        required.every(exploitable) &&
        (resolvedAny.length === 0 || resolvedAny.some(exploitable));
      // `attributeDriven` rend la main à la carte plutôt que d'afficher « pas
      // encore collectée » : voir CardSpec (la cantine et le prochain cours).
      if (!hasUsable && spec.attributeDriven !== true) {
        return this.frame(unavailableState(this.t));
      }

      // État 3 — la carte décide, le vide lui appartient.
      //
      // Le `catch` n'est pas une politesse : Lit laisse la racine d'ombre
      // VIDE quand `render()` lève, et Home Assistant rappelle le rendu à
      // chaque évènement de la maison — une carte fautive disparaît donc de
      // la page en jetant des milliers d'exceptions, sans rien afficher.
      // Observé en production. Le message reste générique ; la trace part en
      // console, seul endroit où elle sert à quelque chose.
      try {
        return this.frame(spec.render(this.makeCtx(hass, config)));
      } catch (error) {
        console.error(`[${spec.type}] le rendu a levé`, error);
        return this.frame(errorState(this.t));
      }
    }

    private frame(body: TemplateResult): TemplateResult {
      const title = this.config?.title;
      return html`
        <ha-card>
          ${title ? html`<div class="title">${title}</div>` : ''}
          <div class="body">${body}</div>
        </ha-card>
      `;
    }

    private entityFor(key: EntityKey): HassEntity | undefined {
      const id = this.resolved.get(key);
      return id ? this.hass?.states[id] : undefined;
    }

    private makeCtx(hass: HomeAssistant, config: CarnetCardConfig): RenderCtx {
      const deviceId = resolveDevice(hass, config.device_id, spec.scope);
      const device = deviceId ? hass.devices[deviceId] : undefined;

      // Seul point d'appel de service ouvert à la carte : `AllowedCall`
      // ferme la liste à la compilation. `hass.callService` lui-même reste
      // hors de `ctx.hass` (voir HassView dans types.ts) : ce découpage sur
      // le point est le seul endroit du socle qui reconstitue domaine et
      // service.
      const callService = async (
        call: AllowedCall,
        data?: Record<string, unknown>,
        target?: Record<string, unknown>
      ): Promise<void> => {
        const sep = call.indexOf('.');
        const domain = call.slice(0, sep);
        const service = call.slice(sep + 1);
        await hass.callService(domain, service, data, target);
      };

      // Le même découpage, pour la liste close des services à réponse. La
      // réponse arrive sous `response` dans l'objet que le frontal résout ;
      // tout autre forme rend `undefined`, et la carte le traite comme un
      // échec.
      const callForResponse = async (
        call: AllowedResponseCall,
        data: Record<string, unknown>
      ): Promise<unknown> => {
        const sep = call.indexOf('.');
        const domain = call.slice(0, sep);
        const service = call.slice(sep + 1);
        const resultat = await hass.callService(domain, service, data, undefined, false, true);
        return resultat !== null && typeof resultat === 'object' && 'response' in resultat
          ? resultat.response
          : undefined;
      };

      return {
        hass,
        config,
        language: hass.language,
        timeZone: resolveTimeZone(hass),
        deviceName: device?.name_by_user ?? device?.name ?? '',
        entityId: (k) => this.resolved.get(k),
        entity: (k) => this.entityFor(k),
        status: (k): EntityStatus => {
          if (!this.resolved.has(k)) return 'missing';
          const e = this.entityFor(k);
          if (!e || ABSENT_STATES.has(e.state)) return 'unavailable';
          return 'ok';
        },
        // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- `T` est une commodité d'écriture pour lire un attribut d'entité Home Assistant, qui n'est typé nulle part (voir RenderCtx.attr dans types.ts) : ce n'est pas une garantie de type, l'appelant reste responsable de ce qu'il annonce.
        attr: <T>(k: EntityKey, name: string) =>
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- même justification : lecture d'un attribut d'entité, jamais typé côté registre.
          this.entityFor(k)?.attributes[name] as T | undefined,
        // Site correct : hass est déjà connu ici, sa langue toujours définie.
        t: (path, vars) => localize(path, vars, hass.language),
        callService,
        callForResponse,
        refresh: async (tier?: string) => {
          this.refreshFailed = false;
          if (!config.device_id) {
            // `device_id` est REQUIS par le service. Sans lui l'appel serait
            // rejete par la validation, et l'utilisateur verrait une erreur
            // brute de Home Assistant au lieu du message de la carte. Une
            // configuration par surcharge `entities` seule est le cas ou ca
            // arrive ; la carte dit alors que la demande n'a pas abouti, ce
            // qui est exactement vrai.
            //
            // Teste AVANT la garde, et l'ordre compte : un appel qui ne part
            // pas ne doit pas verrouiller le bouton un quart d'heure. La
            // garde protege le budget de requetes, et rien n'a ete demande
            // ici.
            this.refreshFailed = true;
            return;
          }
          // Posé AVANT l'appel : un double-clic pendant l'attente doit
          // retomber sous le refroidissement, pas en envoyer un second — la
          // seule carte qui touche au budget de requêtes en dépend.
          //
          // Et RENDU si l'appel est rejeté, ce qui suppose de retenir l'état
          // d'avant. Arbitré par le propriétaire le 10 septembre 2026, après
          // l'avoir payé : le bouton refusait `device_id` en cible, son clic
          // échouait, et la garde le verrouillait quand même un quart
          // d'heure. Le défaut est corrigé, la punition non.
          //
          // L'objection qui avait fait renoncer une première fois est
          // sérieuse : `refresh` peut échouer APRÈS que l'ordonnanceur a
          // accepté la priorité — une coupure de la liaison, par exemple — et
          // rendre la garde autorise alors un second boost pour un premier
          // qui a bel et bien porté. Ce qui la tranche est le coût comparé :
          // une priorité relevée deux fois ne place AUCUNE requête PRONOTE,
          // c'est l'ordonnanceur qui décide et le plafond serveur reste par
          // palier ; un verrou injustifié, lui, se paie tout de suite et se
          // paie en entier.
          const previousAt = this.refreshedAt;
          const previousStored = readGuard(config.device_id);
          const armedAt = Date.now();
          this.refreshedAt = armedAt;
          writeGuard(config.device_id, armedAt);
          try {
            await callService(
              'carnet_scolaire.refresh',
              {
                // `device_id` est un CHAMP du service, pas une CIBLE, et
                // c'est toute la difference. `services.yaml` le declare sous
                // `fields:` avec un selecteur `device:` — il n'y a pas de
                // bloc `target:` — et `services.py` valide
                // `vol.Required(ATTR_DEVICE_ID): cv.string`.
                //
                // Passe en quatrieme argument, il partait dans le `target` de
                // l'appel, et `cv.TARGET_SERVICE_FIELDS` normalise le
                // `device_id` d'une cible en LISTE avant que Home Assistant
                // ne la fusionne dans les donnees du service. Le schema
                // recevait donc une liste la ou il attend une chaine, et
                // rejetait chaque clic : « value should be a string at
                // 'device_id' ». Rapporte par le proprietaire le 10 septembre
                // 2026 en appuyant sur le bouton de la carte limiteur.
                //
                // Le blame revient a l'integration, qui l'a corrige depuis :
                // `ServiceRegistry.async_call` termine par
                // `service_data.update(target)`, et une cible a deja traverse
                // `cv.ensure_list`. Les six schemas declaraient `cv.string`,
                // donc toute automatisation construite a la souris echouait
                // pareil. Les deux formes sont acceptees maintenant.
                //
                // La forme ci-dessous ne change pas pour autant : c'est celle
                // que `services.yaml` declare, sous `fields:` et sans bloc
                // `target:`. Un contrat qui tolere deux formes se lit sur
                // celle qu'il declare.
                //
                // C'est le MEME defaut que `tier`/`tiers` ci-dessous, et le
                // meme mecanisme l'a cache : le test gelait la forme du code
                // au lieu de la verifier contre `services.py`. Deux fois de
                // suite sur le meme appel. La forme d'un appel de service se
                // lit dans le depot de l'integration, jamais dans le souvenir
                // de ce qu'on a ecrit.
                device_id: config.device_id,
                // `tiers`, au pluriel, et une LISTE. Verifie dans le depot de
                // l'integration : `services.py` declare
                // `vol.Optional(ATTR_TIERS)` avec `ATTR_TIERS = "tiers"`, et
                // le schema n'a pas d'`extra=` — voluptuous refuse donc toute
                // cle inconnue. La carte envoyait `tier` : tout
                // rafraichissement avec un palier configure etait rejete par
                // la validation, sans qu'aucune requete ne parte.
                // `cv.ensure_list` accepterait un scalaire, mais
                // `services.yaml` declare le champ `multiple: true` : la
                // liste est la forme du contrat.
                ...(tier ? { tiers: [tier] } : {}),
              }
            );
          } catch {
            // Le rejet doit remonter à l'utilisateur, pas disparaître : la
            // carte reste seule juge de la façon de le montrer.
            this.refreshFailed = true;
            // Rendue, mais pas jusqu'à zéro : la garde est **anti-datée** pour
            // qu'il n'en reste qu'une minute. Voir
            // `REFRESH_REJECTED_COOLDOWN_MS` — sur un palier en échec, chaque
            // clic accepté achète une requête réelle.
            //
            // `Math.max` avec l'état d'avant : un rejet rend du temps, il
            // n'en donne jamais. Si un rafraîchissement avait **réussi** deux
            // minutes plus tôt, sa garde vaut encore treize minutes, et
            // l'échec d'un clic suivant ne doit pas la raccourcir.
            //
            // Aucun test ne l'épingle, et il faut le dire plutôt que d'en
            // écrire un qui ferait semblant : par le bouton, ce cas n'est pas
            // atteignable — pendant qu'une garde court, le bouton est grisé,
            // donc il n'y a pas de second clic. La tentative de test passait
            // avec ET sans le `Math.max`, pour cette raison exactement, et
            // elle a été retirée. Ce qui reste ici est une garantie de forme,
            // gratuite, contre un appelant futur qui n'aurait pas de bouton
            // grisé devant lui.
            const shortened = Date.now() - (REFRESH_COOLDOWN_MS - REFRESH_REJECTED_COOLDOWN_MS);
            this.refreshedAt = Math.max(previousAt, shortened);
            // La garde partagée n'est touchée que si PERSONNE ne l'a reprise
            // entre-temps. Deux cartes du même appareil peuvent être sur la
            // même vue : écrire sans regarder raccourcirait la garde qu'une
            // voisine vient d'armer pour un appel qui, lui, a réussi.
            if (readGuard(config.device_id) === armedAt) {
              writeGuard(config.device_id, Math.max(previousStored, shortened));
            }
          }
        },
        // La garde retenue est la plus récente des deux : celle de l'instance
        // et celle relue du stockage. Un rechargement de page ne réarme donc
        // plus le bouton avant l'heure.
        refreshCoolingDown:
          Date.now() - Math.max(this.refreshedAt, readGuard(config.device_id)) <
          REFRESH_COOLDOWN_MS,
        refreshFailed: this.refreshFailed,
        cursor: this.cursor,
        setCursor: (value: number) => {
          // `Math.trunc` et non une confiance dans l'appelant : le curseur
          // sert d'index de jour, et un flottant produirait une date
          // fractionnaire — donc un libellé de date faux, pas une erreur.
          this.cursor = Number.isFinite(value) ? Math.trunc(value) : 0;
        },
      };
    }
  }

  return CarnetCardBase;
}
