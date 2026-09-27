import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { HaFormSchema, HomeAssistant } from './ha-types';
import { createResolveCache, isChildDevice } from './resolve';
import { dropDanglingOverrides } from './overrides';
import type { CardSpec, EntityKey, CarnetCardConfig, Translate } from './types';
import { sharedStyles } from './ui/styles';
import { localize } from '../localize';

export class CarnetCardEditor extends LitElement {
  static styles = sharedStyles;

  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) spec?: CardSpec;
  @state() private config?: CarnetCardConfig;

  private t: Translate = (path, vars) => localize(path, vars, this.hass?.language);

  // Le même mécanisme que la carte (voir base-card.ts), avec son propre
  // cache : sans lui, l'éditeur
  // rebalaierait tout le registre (Object.values(hass.entities)) à chaque
  // mise à jour d'état de la maison tant qu'il reste ouvert.
  private resolveCache = createResolveCache();

  setConfig(config: CarnetCardConfig): void {
    this.config = config;
  }

  private formSchema(config: CarnetCardConfig): HaFormSchema[] {
    return [
      {
        name: 'device_id',
        required: true,
        selector: { device: { integration: 'carnet_scolaire' } },
      },
      { name: 'title', selector: { text: {} } },
      ...(this.spec?.schema(config, this.t) ?? []),
    ];
  }

  /**
   * Résout d'abord dans la racine de catalogue de la carte (`notes.sections`,
   * `devoirs.filter`…) et ne retombe sur `editor.` que pour les deux champs
   * de base (`device_id`, `title`). `localize` rend le chemin lui-même
   * quand la clé manque : c'est le signal du repli — jamais le repli final,
   * qui reste le nom du champ (voir `computeHelper`, qui applique le même
   * principe côté aide : un champ ajouté sans traduction ne doit jamais
   * afficher un chemin de catalogue à l'utilisateur).
   *
   * Protégé (pas privé) : le test de repli l'expose via une sous-classe,
   * plutôt que de le lire par une conversion de type qui contourne
   * TypeScript.
   */
  protected computeLabel = (s: HaFormSchema): string => {
    const spec = this.spec;
    if (spec) {
      const path = `${spec.key}.${s.name}`;
      const own = this.t(path);
      if (own !== path) return own;
    }
    const path = `editor.${s.name}`;
    const value = this.t(path);
    return value === path ? s.name : value;
  };

  /**
   * Même repli que `computeLabel`, mais sur les clés `*_helper` — et rend
   * `undefined` plutôt que le chemin brut quand aucune aide n'existe, pour
   * que `ha-form` n'affiche rien plutôt qu'une clé de traduction. Protégé
   * pour la même raison que `computeLabel`.
   */
  protected computeHelper = (s: HaFormSchema): string | undefined => {
    const spec = this.spec;
    if (spec) {
      const path = `${spec.key}.${s.name}_helper`;
      const own = this.t(path);
      if (own !== path) return own;
    }
    const path = `editor.${s.name}_helper`;
    const value = this.t(path);
    return value === path ? undefined : value;
  };

  protected render(): TemplateResult | typeof nothing {
    const hass = this.hass;
    const config = this.config;
    const spec = this.spec;
    if (!hass || !config || !spec) return nothing;
    return html`
      <ha-form
        .hass=${hass}
        .data=${config}
        .schema=${this.formSchema(config)}
        .computeLabel=${this.computeLabel}
        .computeHelper=${this.computeHelper}
        @value-changed=${this.valueChanged}
      ></ha-form>
      ${this.diagnosis(hass, spec, config)}
    `;
  }

  private valueChanged = (ev: CustomEvent<{ value?: CarnetCardConfig }>): void => {
    const value = ev.detail?.value;
    if (!value) return;
    // ha-form remonte l'objet complet : remplacer, pas fusionner, sinon un
    // champ que l'utilisateur vide est silencieusement restauré.
    this.config = { ...value };
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: this.config },
        bubbles: true,
        composed: true,
      })
    );
  };

  /**
   * Dit à l'utilisateur, dans l'éditeur, quelles entités sa carte trouvera —
   * plutôt que de le laisser découvrir une carte vide.
   */
  private diagnosis(
    hass: HomeAssistant,
    spec: CardSpec,
    config: CarnetCardConfig
  ): TemplateResult | typeof nothing {
    if (!config.device_id) return nothing;

    // isChildDevice rend faux aussi bien pour un appareil de compte que pour
    // un appareil disparu du registre : il faut écarter ce second cas en
    // premier, sous peine d'accuser à tort « c'est un compte, pas un enfant ».
    if (!hass.devices[config.device_id]) {
      return html`<div class="notice problem">${this.t('common.unknown_device')}</div>`;
    }
    if (!isChildDevice(hass, config.device_id)) {
      return html`<div class="notice problem">${this.t('editor.account_device_picked')}</div>`;
    }

    const keys: EntityKey[] = [
      ...spec.requires(config),
      ...(spec.requiresAny?.(config) ?? []),
      ...spec.optional(config),
    ];
    // Le même contrôle que la carte : une surcharge qui ne désigne rien n'est
    // pas « trouvée ».
    const resolved = dropDanglingOverrides(
      hass,
      this.resolveCache.resolve(hass, config.device_id, spec.scope, keys, config.entities),
      config.entities
    );

    return html`
      <div class="title">${this.t('editor.diagnosis')}</div>
      ${keys.map(
        (k) => html`
          <div class="row">
            <span class="primary"><code>${k}</code></span>
            <span class="trailing">
              ${resolved.has(k) ? this.t('editor.found') : this.t('editor.not_found')}
            </span>
          </div>
        `
      )}
    `;
  }
}
