import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC } from '../../src/cards/mode-collecte';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-mode-collecte': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

/**
 * La carte de mode de collecte, en deux moitiés inégales.
 *
 * La **lecture** de l'état marche aujourd'hui : `sensor:limiter_state` publie
 * `quiet_hours` parmi ses six valeurs. L'**écriture** attend une entité que
 * l'intégration ne publie pas encore, `select:collection_mode`.
 *
 * Ces tests couvrent donc deux mondes : celui d'aujourd'hui, où la carte doit
 * dire honnêtement qu'elle ne peut rien basculer, et celui d'après, où le
 * contrôle doit apparaître **sans qu'on touche au tableau de bord**. Le
 * second n'est pas de la spéculation : c'est un contrat, et un contrat sans
 * test ne tient pas.
 *
 * Toutes les valeurs sont synthétiques.
 */

const compte = (key: string, entity_id: string, state: string, attributes = {}) => ({
  key,
  entity_id,
  device: 'dev_compte' as const,
  state,
  attributes,
});

/** L'état seul : le monde d'aujourd'hui, sans sélecteur. */
const sansSelecteur = (etat = 'quiet_hours') =>
  makeHass([compte('sensor:limiter_state', 'sensor.cpt_etat', etat)]);

/** L'état et le sélecteur : le monde d'après. */
const avecSelecteur = (courant = 'normal', options: unknown = ['normal', 'quiet_hours']) =>
  makeHass([
    compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
    compte('select:collection_mode', 'select.cpt_mode', courant, { options }),
  ]);

const boutons = (el: HTMLElement) =>
  [...(el.shadowRoot?.querySelectorAll('button') ?? [])].map((b) => ({
    libelle: b.textContent?.trim() ?? '',
    eteint: b.disabled,
    enfonce: b.getAttribute('aria-pressed'),
  }));

const monter = (config: Record<string, unknown>, hass: unknown) =>
  mountCard('carnet-scolaire-mode-collecte', { device_id: 'dev_enfant', ...config }, hass);

describe('carte mode de collecte — la lecture, qui marche déjà', () => {
  it("résout l'entité de compte depuis le device_id de l'enfant", async () => {
    // Le point le plus déroutant de l'intégration : les entités de diagnostic
    // vivent sur l'appareil de COMPTE, et l'utilisateur configure quand même
    // l'appareil de l'enfant. `scope: 'account'` remonte par via_device_id.
    const el = await monter({}, sansSelecteur());
    expect(text(el)).toContain('Heures calmes');
  });

  it('traduit les six états sous la racine de la carte limiteur', async () => {
    // La carte réutilise `limiteur.state_*` plutôt que de recopier six
    // chaînes dans quatre catalogues : ce sont les valeurs de l'intégration,
    // elles n'appartiennent à aucune des deux cartes. Deux états suffisent à
    // mesurer que la racine est la bonne ; six ne mesureraient rien de plus.
    //
    // Le libellé attendu est celui que l’INTÉGRATION donne à l’état, et pas
    // une reformulation de carte. Trois des six divergeaient — celui-ci
    // disait « En retrait » — et le propriétaire l’a vu de la seule façon
    // dont ça se voit : il a lu un état sur une carte, l’a cherché dans la
    // documentation du socle, et ne l’a pas trouvé. L’historique et la boîte
    // de dialogue d’entité portent toujours le libellé de l’entité ; une
    // carte qui en invente un autre rend le même incident illisible d’un
    // écran à l’autre.
    expect(text(await monter({}, sansSelecteur('nominal')))).toContain('Nominal');
    expect(text(await monter({}, sansSelecteur('backoff')))).toContain('Temporisation');
  });

  it("affiche un état que le catalogue ne connaît pas tel que l'intégration l'envoie", async () => {
    // Une clé absente rend le chemin lui-même : sans le repli, la carte
    // afficherait « limiteur.state_mode_inconnu » au milieu d'une ligne. Un
    // état inventé demain par l'intégration doit rester lisible.
    const el = await monter({}, sansSelecteur('mode_inconnu'));
    expect(text(el)).toContain('mode_inconnu');
    expect(text(el)).not.toContain('limiteur.state_');
  });
});

describe('carte mode de collecte — sans le sélecteur, elle le dit', () => {
  it('affiche une phrase et AUCUN bouton', async () => {
    // C'est la moitié qui compte aujourd'hui. Un bouton grisé laisserait
    // croire à une garde temporaire, comme celui du rafraîchissement, alors
    // que rien ne viendra sans une version de l'intégration.
    const el = await monter({}, sansSelecteur());
    expect(boutons(el)).toHaveLength(0);
    expect(text(el)).toContain('ne propose pas encore de bascule manuelle');
    // Appariement positif : l'état est bien rendu, la carte n'est pas vide.
    expect(text(el)).toContain('Heures calmes');
  });

  it('dit la même chose quand le sélecteur est au registre sans être chargé', async () => {
    // `unloaded` : au registre, absent de hass.states. Le socle rend alors
    // 'unavailable' et non 'missing' — deux causes, une seule conséquence
    // pour cette carte, et surtout pas un bouton qui n'appellerait rien.
    const hass = makeHass([
      compte('sensor:limiter_state', 'sensor.cpt_etat', 'nominal'),
      { ...compte('select:collection_mode', 'select.cpt_mode', 'normal'), unloaded: true },
    ]);
    const el = await monter({}, hass);
    expect(boutons(el)).toHaveLength(0);
    expect(text(el)).toContain('ne propose pas encore de bascule manuelle');
  });
});

describe('carte mode de collecte — avec le sélecteur, le contrat', () => {
  it('rend un bouton par mode, le mode courant éteint et marqué', async () => {
    // Une interface qui laisse cliquer sans effet est une interface qui ment :
    // le mode déjà en vigueur ne se re-sélectionne pas. `aria-pressed` dit la
    // même chose au lecteur d'écran, que le grisé seul ne dirait pas.
    const el = await monter({}, avecSelecteur('normal'));
    expect(boutons(el)).toEqual([
      { libelle: 'Normal', eteint: true, enfonce: 'true' },
      { libelle: 'Heures calmes', eteint: false, enfonce: 'false' },
    ]);
    // Et la phrase d'indisponibilité a disparu.
    expect(text(el)).not.toContain('ne propose pas encore');
  });

  it('prend la liste des modes sur ENTITÉ et non dans une constante de carte', async () => {
    // C'est l'intégration qui décide quels modes existent. Une liste écrite
    // dans la carte afficherait un mode qu'elle aurait retiré.
    //
    // `futur` est un mode que personne ne prévoit, et c'est volontaire. Ce cas
    // nommait d'abord `suspendu` — or l'intégration a explicitement **refusé**
    // ce mode-là. Une fixture qui nomme une piste écartée finit par se lire
    // comme une feuille de route ; ce que le test mesure est qu'un mode
    // inconnu du catalogue passe quand même, pas lequel.
    const el = await monter({}, avecSelecteur('normal', ['normal', 'futur']));
    expect(boutons(el).map((b) => b.libelle)).toEqual(['Normal', 'futur']);
  });

  it('appelle select.select_option sur clic, et jamais au montage', async () => {
    const hass = avecSelecteur('normal');
    const spy = vi.fn().mockResolvedValue(undefined);
    hass.callService = spy;
    const el = await monter({}, hass);
    expect(spy).not.toHaveBeenCalled();

    const cible = [...(el.shadowRoot?.querySelectorAll('button') ?? [])][1];
    cible?.click();
    await el.updateComplete;

    // La cible vient de la RÉSOLUTION, jamais d'un identifiant écrit dans la
    // carte : c'est l'invariant porteur du projet.
    expect(spy).toHaveBeenCalledWith(
      'select',
      'select_option',
      { option: 'quiet_hours' },
      { entity_id: 'select.cpt_mode' }
    );
  });

  it('absorbe l’échec de la bascule sans rejet non géré, et garde le mode réel', async () => {
    // Home Assistant affiche déjà son bandeau d'erreur ; la promesse rejetée,
    // lancée avec `void`, finissait en « Uncaught (in promise) ».
    const hass = avecSelecteur('normal');
    hass.callService = vi.fn().mockRejectedValue(new Error('refusé'));
    const rejets: unknown[] = [];
    const surRejet = (raison: unknown): void => {
      rejets.push(raison);
    };
    process.on('unhandledRejection', surRejet);
    try {
      const el = await monter({}, hass);
      [...(el.shadowRoot?.querySelectorAll('button') ?? [])][1]?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;
      expect(rejets).toEqual([]);
      // Le bouton pressé reste celui du mode que l'entité publie.
      const presse = el.shadowRoot?.querySelector('button[aria-pressed="true"]');
      expect(presse?.textContent?.trim()).toBe('Normal');
    } finally {
      process.off('unhandledRejection', surRejet);
    }
  });

  it('signale un sélecteur qui ne propose aucun mode', async () => {
    // L'entité est là mais son attribut `options` est vide ou d'une autre
    // forme. Se taire laisserait une carte qui affiche un état et rien
    // d'autre, sans qu'on sache si c'est normal.
    const vide = await monter({}, avecSelecteur('normal', []));
    expect(text(vide)).toContain('ne propose aucun mode');
    expect(boutons(vide)).toHaveLength(0);

    const pasUnTableau = await monter({}, avecSelecteur('normal', 'normal,quiet_hours'));
    expect(text(pasUnTableau)).toContain('ne propose aucun mode');
  });

  it('écarte une entrée de liste qui n’est pas une chaîne', async () => {
    // `options` vient du serveur d'états : rien ne garantit sa forme. Un
    // nombre y produirait un bouton dont le libellé serait « 3 » et l'appel
    // un `option: 3` que l'intégration refuserait sans un mot.
    const el = await monter({}, avecSelecteur('normal', ['normal', 3, null, 'quiet_hours']));
    expect(boutons(el).map((b) => b.libelle)).toEqual(['Normal', 'Heures calmes']);
  });
});

describe('carte mode de collecte — l’avertissement', () => {
  it('est affiché par défaut', async () => {
    // Il dit que repasser en mode normal peut faire repartir la collecte. Sur
    // une carte qui touche au budget de requêtes, c'est l'information la plus
    // utile de la carte.
    expect(text(await monter({}, avecSelecteur()))).toContain('faire repartir la collecte');
  });

  it("dit qu'un forçage ne survit pas à un redémarrage, et seulement s'il y a un forçage", async () => {
    // Confirmé par le dépôt de l'intégration : le forçage est un geste de mise
    // au point, il ne persiste pas. La phrase n'a de sens que là où le
    // contrôle existe — sans lui, elle parlerait d'un forçage qu'on ne peut
    // pas poser.
    expect(text(await monter({}, avecSelecteur()))).toContain('ne survit pas à un redémarrage');
    const sans = await monter({}, sansSelecteur());
    expect(text(sans)).not.toContain('ne survit pas à un redémarrage');
    // Appariement positif : l'autre note, elle, est bien là.
    expect(text(sans)).toContain('faire repartir la collecte');
  });

  it('se coupe par configuration', async () => {
    const el = await monter({ show_note: false }, avecSelecteur());
    expect(text(el)).not.toContain('faire repartir la collecte');
    expect(text(el)).not.toContain('ne survit pas à un redémarrage');
    // Appariement positif : les boutons restent, seules les notes disparaissent.
    expect(boutons(el)).toHaveLength(2);
  });
});
