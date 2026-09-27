import { html, type TemplateResult } from 'lit';
import type { CardSpec, EntityKey, CarnetCardConfig, RenderCtx } from '../core/types';
import { chip, listRow } from '../core/ui/parts';

/**
 * Le mode de récupération, et de quoi le forcer à la main.
 *
 * Demandée par le propriétaire le 10 septembre 2026, avec sa raison : « ce
 * forçage manuel est utile comme en ce moment ». Le « comme en ce moment »
 * est ce qui justifie la carte : basculer en heures calmes cette nuit-là a
 * demandé d'ouvrir le flux d'options de l'intégration, de trouver dans
 * laquelle des trois étapes du menu vivait le réglage, et de sauvegarder —
 * ce qui **recharge l'entrée** et a rendu douze entités sur seize
 * indisponibles.
 *
 * ## Ce qui marche aujourd'hui, et ce qui attend l'intégration
 *
 * La carte est en **deux moitiés inégales**, et c'est assumé.
 *
 * La **lecture** fonctionne dès maintenant : `LimiterState.QUIET_HOURS` est
 * l'un des six états publiés par `sensor:limiter_state`, sur un ensemble de
 * valeurs fermé. La carte dit donc quel mode est en vigueur sans rien devoir
 * à personne.
 *
 * L'**écriture** n'existe pas encore. `quiet_hours_enabled` est une option
 * d'entrée de configuration, pas une entité ; l'intégration ne publie ni
 * `switch`, ni `select`, ni `number` ; et aucun de ses huit services ne
 * touche au mode. Tant que `select:collection_mode` n'est pas publié, la
 * carte affiche l'état et **une phrase qui dit que la bascule n'est pas
 * disponible** — jamais un bouton qui ne fait rien. Le jour où l'entité
 * paraît, le contrôle apparaît sans que personne touche au tableau de bord.
 *
 * C'est le même pari que `background_color`, qui a tenu : les cartes lisaient
 * le champ avant que l'intégration ne le publie, et l'accent est apparu tout
 * seul. La différence, et elle compte : une lecture absente ne se voit pas,
 * un contrôle absent se verrait. D'où la phrase, plutôt que rien.
 *
 * ## Pourquoi elle n'écrit pas l'option
 *
 * Parce qu'une sauvegarde d'options recharge l'entrée, et qu'un rechargement
 * perd les instantanés : `scheduler.py` ne fait traverser que
 * `last_collected` par `export_state`/`import_state`, et il n'y a **aucun
 * `Store`** dans le composant — les instantanés ne vivent qu'en mémoire.
 * Observé le 9 septembre 2026 à 23 h 55 : douze entités sur seize en
 * `unavailable`, sans rien de recollecté avant 6 h avec les heures calmes
 * actives. Une carte qui produirait ça à chaque clic serait pire que le
 * formulaire qu'elle remplace ; le contrat demandé à l'intégration est donc un
 * **forçage d'exécution**, en mémoire, sans rechargement.
 *
 * Ce commentaire ajoutait d'abord « et les trois capteurs d'emploi du temps
 * sans `lessons` » comme s'il s'agissait d'une preuve de plus. Ce n'en était
 * pas une : Home Assistant ne publie aucun attribut sur une entité
 * `unavailable`, quelle qu'en soit la cause, donc « sans `lessons` » ne dit
 * rien de plus que « indisponible ». Ce qui porte la conclusion est le code du
 * composant, pas cette observation — voir `test/fixtures/FORMES.md`.
 *
 * ## L'invariant n'est pas cassé, et la réponse naïve est « oui »
 *
 * L'invariant du projet est qu'une carte ne déclenche jamais de collecte **à
 * l'affichage**, pas qu'elle ne puisse rien déclencher : `carnet_scolaire.refresh`
 * est dans la liste blanche depuis toujours et c'est bien un geste délibéré.
 * Une bascule de mode a la même forme — un clic explicite, jamais un rendu.
 *
 * Elle élargit en revanche la surface d'action délibérée, et `AllowedCall`
 * gagne une troisième entrée. Ce n'est pas un détail d'implémentation : ce
 * type est ce qui rend vraie une phrase de `docs/limites.md`.
 */
interface Config extends CarnetCardConfig {
  /**
   * L'avertissement sous les boutons. Affiché par défaut.
   *
   * Il dit que repasser en mode normal peut faire repartir la collecte
   * immédiatement. Le masquer est possible pour un tableau de bord de
   * diagnostic où la phrase est connue par cœur ; il vaut mieux ne pas le
   * faire sur une vue partagée.
   */
  show_note?: boolean;
}

/** L'état en vigueur. Publié, et sur un ensemble de valeurs fermé. */
const STATE: EntityKey = 'sensor:limiter_state';

/**
 * Le sélecteur de mode — **pas encore publié par l'intégration**.
 *
 * Optionnel, et le rester même après sa parution : un utilisateur peut très
 * bien ne pas vouloir de forçage manuel, et le socle écarterait alors la
 * carte entière au lieu de lui laisser afficher l'état.
 *
 * **Deux modes, et le troisième a été refusé** — arrêté avec l'intégration le
 * 10 septembre 2026 : `normal` et `quiet_hours`, les deux que les quatre
 * catalogues traduisent déjà. Un mode « suspendu », qui ne collecterait plus
 * du tout, a été écarté pour une raison qui vaut d'être retenue : il est
 * **indistinguable d'une panne** pour tout ce qui lit ces entités. La nuit du
 * 9 au 10 septembre a montré ce que coûte un « indisponible sans raison
 * lisible » ; un réglage qui le produirait exprès serait un piège.
 *
 * La carte ne s'appuie pas sur ce nombre pour autant — elle lit `options` sur
 * l'entité. Si un troisième mode paraît un jour, son bouton apparaît, et son
 * libellé sera la valeur brute jusqu'à ce qu'un catalogue le traduise.
 */
const MODE: EntityKey = 'select:collection_mode';

/**
 * Les tons des six états, repris à la carte limiteur.
 *
 * Dupliqués et non partagés : trois lignes de table valent mieux qu'un module
 * commun pour deux appelants, et les deux cartes n'ont pas la même raison de
 * choisir un ton — celle-ci qualifie un **mode choisi**, celle-là un état
 * subi. Si un troisième appelant paraît, ce sera le moment de mutualiser.
 */
const TONES: Record<string, 'ok' | 'warn' | 'problem'> = {
  nominal: 'ok',
  throttled: 'warn',
  quiet_hours: 'warn',
  backoff: 'problem',
  credentials_hold: 'problem',
  bootstrap_failed: 'problem',
};

export const SPEC: CardSpec<Config> = {
  type: 'carnet-scolaire-mode-collecte',
  name: 'Carnet scolaire — Mode de collecte',
  description: 'Le mode de récupération en vigueur, et de quoi le forcer à la main.',
  key: 'mode_collecte',
  // Les entités de diagnostic vivent sur l'appareil de compte. L'utilisateur
  // configure quand même l'appareil de l'ENFANT : le socle remonte par
  // via_device_id. Ne jamais lui demander de choisir un autre appareil.
  scope: 'account',
  size: 4,
  requires: () => [STATE],
  optional: () => [MODE],
  schema: () => [{ name: 'show_note', selector: { boolean: {} } }],
  render(ctx: RenderCtx<Config>) {
    const out: TemplateResult[] = [];

    // STATE est requise : le socle garantit qu'elle est résolue et hors
    // unknown/unavailable avant d'appeler `render`. Un repli serait du code
    // mort — et un repli sur `nominal` affirmerait un mode qu'on n'a pas lu.
    const state = ctx.entity(STATE)?.state ?? '';

    /**
     * Le libellé d'un état, ou d'un mode.
     *
     * Les six états sont traduits sous la racine de la carte **limiteur**, et
     * cette carte les réutilise plutôt que de recopier six chaînes dans
     * quatre catalogues. Ce sont les valeurs de l'intégration, pas celles
     * d'une carte : elles n'appartiennent à aucune des deux.
     *
     * Une clé absente rend le chemin lui-même — c'est le contrat de
     * `localize`, et il sert ici de test d'existence. Un mode que
     * l'intégration inventerait demain s'affiche donc **tel qu'elle
     * l'envoie**, plutôt qu'en `mode_collecte.mode_futur` au milieu de la
     * carte.
     */
    const labelOf = (value: string, root: string): string => {
      if (value === '') return '';
      const path = `${root}${value}`;
      const label = ctx.t(path);
      return label === path ? value : label;
    };

    out.push(
      listRow({
        primary: ctx.t('mode_collecte.in_force'),
        trailing: chip(labelOf(state, 'limiteur.state_'), TONES[state] ?? 'warn'),
      })
    );

    // Le contrôle, et seulement s'il existe vraiment. `status` vaut 'ok' pour
    // une entité résolue ET porteuse d'un état exploitable ; 'missing' quand
    // l'intégration ne la publie pas, ce qui est le cas aujourd'hui.
    if (ctx.status(MODE) === 'ok') {
      const current = ctx.entity(MODE)?.state ?? '';
      const options = ctx.attr(MODE, 'options');
      // La liste vient de l'entité, jamais d'une constante de carte : c'est
      // l'intégration qui décide quels modes existent, et une liste écrite ici
      // afficherait un mode qu'elle a retiré.
      const modes = Array.isArray(options)
        ? options.filter((mode): mode is string => typeof mode === 'string')
        : [];

      if (modes.length === 0) {
        // Le sélecteur est là mais ne propose rien. Ça se dit, plutôt que de
        // laisser une carte qui affiche un état et rien d'autre sans raison.
        out.push(html`<div class="notice problem">${ctx.t('mode_collecte.no_modes')}</div>`);
      } else {
        const target = ctx.entityId(MODE);
        out.push(html`
          <div class="row">
            ${modes.map(
              (mode) =>
                html`<button
                  ?disabled=${mode === current || target === undefined}
                  aria-pressed=${mode === current ? 'true' : 'false'}
                  @click=${() => {
                    // L'appel ne part QUE d'ici, jamais de `render`.
                    if (target !== undefined) {
                      ctx
                        .callService('select.select_option', { option: mode }, { entity_id: target })
                        .catch(() => {
                          // Home Assistant affiche déjà son bandeau d'erreur,
                          // et le bouton pressé reste celui du mode que
                          // l'entité publie : rien à corriger ici. Sans ce
                          // `catch`, le rejet finissait en « Uncaught (in
                          // promise) » dans la console.
                        });
                    }
                  }}
                >
                  ${labelOf(mode, 'mode_collecte.mode_')}
                </button>`
            )}
          </div>
        `);
      }
    } else {
      // Pas de bouton mort : une phrase qui dit ce qui manque et où. Un
      // bouton grisé laisserait croire à une garde temporaire, comme celui du
      // rafraîchissement — alors qu'ici rien ne viendra sans une version de
      // l'intégration.
      out.push(html`<div class="notice">${ctx.t('mode_collecte.no_control')}</div>`);
    }

    if (ctx.config.show_note !== false) {
      out.push(html`<div class="notice">${ctx.t('mode_collecte.note')}</div>`);
      // Un forçage ne survit PAS à un redémarrage : confirmé par le dépôt de
      // l'intégration, c'est un geste de mise au point et pas un réglage. La
      // phrase n'apparaît que si le contrôle existe — dire d'un forçage qu'il
      // est volatil quand on ne peut pas en poser un n'informe personne.
      if (ctx.status(MODE) === 'ok') {
        out.push(html`<div class="notice">${ctx.t('mode_collecte.note_volatile')}</div>`);
      }
    }

    return html`${out}`;
  },
};
