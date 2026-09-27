import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC, testClock } from '../../src/cards/devoirs';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';
import type { MountableElement } from '../fixtures/mount';
import type { HomeAssistant } from '../../src/core/ha-types';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-devoirs': HTMLElement & MountableElement;
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

const items = [
  { id: 'h1', subject: 'Maths', description: 'Exercices 4 à 7', due: '2026-09-09', done: false },
  {
    id: 'h2',
    subject: 'Anglais',
    description: 'Lire le chapitre 3',
    due: '2026-09-10',
    done: false,
  },
];

const hw = (
  attributes: Record<string, unknown>,
  state = '2',
  extra: Parameters<typeof makeHass>[0] = []
) =>
  makeHass([
    {
      key: 'sensor:homework_todo',
      entity_id: 'sensor.abc_devoirs_a_faire',
      device: 'dev_enfant',
      state,
      attributes,
    },
    ...extra,
  ]);

const withTodoList = (attributes: Record<string, unknown>, features: number) =>
  hw(attributes, '2', [
    {
      key: 'todo:homework',
      entity_id: 'todo.abc_devoirs',
      device: 'dev_enfant',
      state: '2',
      attributes: { supported_features: features },
    },
  ]);

/** Le texte des pastilles de probleme, dans l'ordre du DOM. */
const pastilles = (el: HTMLElement & MountableElement): string[] =>
  Array.from(el.shadowRoot?.querySelectorAll('.chip.problem') ?? []).map(
    (n) => n.textContent?.trim() ?? ''
  );

/** Les fins de ligne, celles qui portent le retard et l'echeance. */
const fins = (el: HTMLElement & MountableElement): string[] =>
  Array.from(el.shadowRoot?.querySelectorAll('.row .trailing') ?? []).map(
    (n) => n.textContent?.trim() ?? ''
  );

/** Les intertitres de groupe. */
const titres = (el: HTMLElement & MountableElement): string[] =>
  Array.from(el.shadowRoot?.querySelectorAll('.title') ?? []).map(
    (n) => n.textContent?.trim() ?? ''
  );

/**
 * La hauteur annoncee, prise sur le `CardSpec` plutot que sur l'element.
 *
 * Le parametre est type explicitement plutot que force depuis un objet de
 * cles libres : `CarnetCardConfig` porte une signature d'index, donc une
 * assertion aurait retreci un type large vers `Config` sans que rien ne
 * verifie les valeurs. Ici `filter` est contraint a ses trois valeurs.
 */
const taille = (options: {
  filter?: 'todo' | 'tomorrow' | 'all';
  limit?: number;
  max_lines?: number;
}): number => {
  const { size } = SPEC;
  if (typeof size !== 'function') throw new Error('size doit etre une fonction');
  return size({ type: 'custom:carnet-scolaire-devoirs', device_id: 'dev_enfant', ...options });
};

/** Un seul devoir, dont on choisit l'enonce. Echeance lointaine : pas de retard. */
const unDevoir = (description_text: string) => [
  { id: 'h1', subject: 'Maths', description_text, due: '2099-01-01', done: false },
];

/**
 * Le bloc repliable de l'enonce, s'il a ete emis.
 *
 * C'etait un `details` dont le `summary` portait tout l'enonce, donc le nom
 * accessible d'un bouton faisait 269 caracteres et deplier ne revelait rien.
 * C'est desormais du texte plus une bascule ; le nom du lecteur ne change
 * pas, pour que les tests qui portent sur le REPLI restent lisibles.
 */
const details = (el: HTMLElement & MountableElement): HTMLElement | null =>
  el.shadowRoot?.querySelector('.enonce') ?? null;

/** La bascule qui deplie l'enonce, s'il y en a une. */
const bascule = (el: HTMLElement & MountableElement): HTMLButtonElement | null => {
  const n = el.shadowRoot?.querySelector('.enonce-bascule');
  return n instanceof HTMLButtonElement ? n : null;
};

/** Le groupe des pieces jointes d'un devoir, s'il a ete emis. */
const piecesJointes = (el: HTMLElement & MountableElement): HTMLElement | null =>
  el.shadowRoot?.querySelector('.devoirs-pieces') ?? null;

/**
 * Le nom accessible du groupe de pieces jointes.
 *
 * Depuis le passage en pastilles, << Pieces jointes >> n'est plus du texte
 * visible : il coutait une ligne entiere pour ce qu'un nom de fichier dans
 * une pastille dit deja. Il vit sur `aria-label`, donc il se lit la et pas
 * dans `textContent` -- et c'est pour ca que ce lecteur existe plutot que
 * de laisser les assertions chercher dans le texte rendu.
 */
const nomGroupePieces = (el: HTMLElement & MountableElement): string | null =>
  piecesJointes(el)?.getAttribute('aria-label') ?? null;

/** Les pastilles du groupe : la pastille est l'idiome visuel du depot. */
const pastillesPieces = (el: HTMLElement & MountableElement): HTMLElement[] =>
  Array.from(el.shadowRoot?.querySelectorAll('.devoirs-piece > .chip') ?? []).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );

/**
 * Un `hass` avec le capteur de retard, dont on choisit les attributs.
 *
 * Les devoirs ont une echeance LOINTAINE : aucune ligne n'est donc en retard
 * d'elle-meme, et toute pastille observee vient du bandeau. Sans ca, une
 * assertion sur le bandeau mesurerait les deux sources melangees.
 */
const avecCapteurRetard = (
  attributes: Record<string, unknown>,
  devoirs: unknown[] = [{ id: 'h1', subject: 'Maths', description_text: 'X', due: '2099-01-01' }]
) =>
  hw({ items: devoirs }, String(devoirs.length), [
    {
      key: 'binary_sensor:homework_overdue',
      entity_id: 'binary_sensor.abc_devoirs_en_retard',
      device: 'dev_enfant',
      state: 'on',
      attributes,
    },
  ]);

/** Les elements de la liste des pieces jointes, dans l'ordre du rendu. */
const elementsPieces = (el: HTMLElement & MountableElement): HTMLElement[] =>
  Array.from(el.shadowRoot?.querySelectorAll('.devoirs-piece[role="listitem"]') ?? []).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );

/** Les liens de la liste des pieces jointes. */
const liensPieces = (el: HTMLElement & MountableElement): HTMLAnchorElement[] =>
  Array.from(el.shadowRoot?.querySelectorAll('.devoirs-piece a') ?? []).filter(
    (n): n is HTMLAnchorElement => n instanceof HTMLAnchorElement
  );

/** Les échéances rendues, groupées sous leur intitulé de matière. */
  const parGroupe = (el: HTMLElement & MountableElement): { titre: string; jours: string[] }[] => {
    const out: { titre: string; jours: string[] }[] = [];
    for (const n of Array.from(el.shadowRoot?.querySelectorAll('.title, .row') ?? [])) {
      if (n.classList.contains('title')) {
        out.push({ titre: (n.textContent ?? '').trim(), jours: [] });
        continue;
      }
      const groupe = out[out.length - 1];
      if (!groupe) continue;
      // L'échéance se lit dans `.primary` et non dans `.trailing` : groupée
      // par matière, c'est elle qui TITRE la ligne, la matière étant déjà
      // dans l'intertitre. La fin de ligne ne porte plus que le retard.
      const tete = n.querySelector('.primary');
      groupe.jours.push((tete?.textContent ?? '').replace(/\s+/g, ' ').trim());
    }
    return out;
  };

/**
 * Le même `hass`, vu depuis un autre fuseau.
 *
 * `config.time_zone` et non `locale.time_zone` : la seconde est une
 * préférence (`'local'` ou `'server'`), pas un identifiant IANA — c'est la
 * forme réelle, et la confondre a déjà vidé deux cartes sur une instance.
 */
const dansLeFuseau = (hass: HomeAssistant, timeZone: string): HomeAssistant => ({
  ...hass,
  config: { ...hass.config, time_zone: timeZone },
});

/** Un devoir dont on choisit les DEUX listes : les noms, et les ouvrables. */
const devoirDeuxListes = (attachments: unknown[], attachment_links: unknown[]) => [
  {
    id: 'h1',
    subject: 'Anglais',
    description_text: 'Acheter le cahier.',
    due: '2099-01-01',
    attachments,
    attachment_links,
  },
];

/** Un devoir dont on choisit les pieces jointes. */
const devoirAvecPieces = (attachments: unknown[]) => [
  {
    id: 'h1',
    subject: 'Maths',
    description_text: 'Exercices 4 a 7.',
    due: '2099-01-01',
    attachments,
  },
];

// `calendar:homework` porte la prochaine échéance telle que le calendrier la
// voit. Elle n'est lue que dans ses ATTRIBUTS : récupérer la liste de ses
// évènements demanderait un appel de service, donc une collecte au rendu.
const withCalendar = (attributes: Record<string, unknown>, calendar: Record<string, unknown>) =>
  hw(attributes, '2', [
    {
      key: 'calendar:homework',
      entity_id: 'calendar.abc_devoirs',
      device: 'dev_enfant',
      state: 'off',
      attributes: calendar,
    },
  ]);

describe('carte devoirs', () => {
  // La forme RÉELLE des attributs d'un calendrier Home Assistant : une heure
  // locale de l'instance, SANS décalage (`strftime('%Y-%m-%d %H:%M:%S')`), et
  // un évènement de devoir couvre la journée entière. L'ancienne fixture
  // écrivait un ISO avec décalage, qu'aucune instance ne publie.
  const nextEvent = {
    message: 'DM de physique',
    all_day: true,
    start_time: '2026-09-15 00:00:00',
    end_time: '2026-09-16 00:00:00',
  };

  it('nomme la prochaine échéance depuis le calendrier, que le filtre masque', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', filter: 'todo' },
      withCalendar({ items }, nextEvent)
    );
    const t = text(el);
    expect(t).toContain('Prochaine échéance');
    expect(t).toContain('DM de physique');
    // Assertion positive : la liste est toujours là, la ligne s'ajoute.
    expect(t).toContain('Maths');
  });

  it('garde la prochaine échéance quand la fenêtre choisie est vide', async () => {
    // Le moment où cette ligne sert le plus : rien à rendre dans la fenêtre
    // demandée, mais une échéance existe plus loin.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', filter: 'todo' },
      withCalendar({ items: [] }, nextEvent)
    );
    const t = text(el);
    expect(t).toContain('Prochaine échéance');
    expect(t).toContain('DM de physique');
  });

  it('tait la prochaine échéance avec le filtre « tous », où la liste montre déjà tout', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', filter: 'all' },
      makeHass([
        {
          key: 'sensor:homework',
          entity_id: 'sensor.abc_devoirs',
          device: 'dev_enfant',
          state: '2',
          attributes: { items },
        },
        {
          key: 'calendar:homework',
          entity_id: 'calendar.abc_devoirs',
          device: 'dev_enfant',
          state: 'off',
          attributes: nextEvent,
        },
      ])
    );
    const t = text(el);
    expect(t).not.toContain('Prochaine échéance');
    expect(t).toContain('Maths');
  });

  it('date la prochaine échéance au jour écrit, quel que soit le fuseau', async () => {
    // Lue par `new Date()`, l'heure locale sans décalage était interprétée
    // dans le fuseau du NAVIGATEUR puis reprojetée dans celui de l'instance :
    // à Honolulu (UTC−10), minuit du 15 devenait le 14.
    const hass = withCalendar({ items }, nextEvent);
    hass.config = { time_zone: 'Pacific/Honolulu' };
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant', filter: 'todo' }, hass);
    const t = text(el);
    expect(t).toContain('Prochaine échéance');
    expect(t).toContain('mardi 15 septembre');
    expect(t).not.toContain('lundi 14 septembre');
  });

  it('ne donne pas pour prochaine échéance un devoir déjà fait, en mode « à faire »', async () => {
    // Le calendrier garde les devoirs faits, préfixés de « ✅ » : ses
    // attributs ne décrivent que le PREMIER évènement, fait ou non.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', filter: 'todo' },
      withCalendar({ items }, { ...nextEvent, message: '✅ DM de physique' })
    );
    const t = text(el);
    expect(t).not.toContain('Prochaine échéance');
    expect(t).toContain('Maths');
  });

  it('ne dit rien quand le calendrier n’a aucun évènement à venir', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', filter: 'todo' },
      withCalendar({ items }, {})
    );
    const t = text(el);
    expect(t).not.toContain('Prochaine échéance');
    expect(t).toContain('Maths');
  });

  it('liste les devoirs avec matière et énoncé', async () => {
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hw({ items }));
    const t = text(el);
    expect(t).toContain('Maths');
    expect(t).toContain('Exercices 4 à 7');
    expect(t).toContain('Anglais');
  });

  it('respecte limit', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', limit: 1 },
      hw({ items })
    );
    const t = text(el);
    expect(t).toContain('Maths');
    expect(t).not.toContain('Anglais');
  });

  it('dit « rien à faire » sur une liste vide', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: [] }, '0')
    );
    const t = text(el);
    expect(t).toContain('Rien à faire');
    expect(t).not.toContain('pas encore collectée');
  });

  it('dit « pas encore collectée » quand l’entité est indisponible', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({}, 'unavailable')
    );
    expect(text(el)).toContain('pas encore collectée');
  });

  it("dit « introuvable » quand l'entité manque", async () => {
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, makeHass([]));
    expect(text(el)).toContain('sensor:homework_todo');
  });

  // --- Critique n°3 : `items` mal formé ne doit jamais faire disparaître la carte. ---

  it("ne casse pas le rendu quand l'attribut items est un objet", async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: {} })
    );
    expect(text(el)).toContain('Rien à faire');
  });

  it("ne casse pas le rendu quand l'attribut items est une chaîne", async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: 'x' })
    );
    expect(text(el)).toContain('Rien à faire');
  });

  it('ignore un élément null dans le tableau items sans lever', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: [null, items[0]] })
    );
    expect(text(el)).toContain('Maths');
  });

  // --- Critique n°1 : le bon bit de supported_features. ---

  it.each([4, 5])(
    'rend la case à cocher quand supported_features=%i porte UPDATE_TODO_ITEM',
    async (features) => {
      const el = await mountCard(
        'carnet-scolaire-devoirs',
        { device_id: 'dev_enfant' },
        withTodoList({ items }, features)
      );
      expect(el.shadowRoot?.querySelectorAll('input').length).toBeGreaterThan(0);
    }
  );

  it('ne rend aucune case quand supported_features=2 (DELETE_TODO_ITEM, pas UPDATE_TODO_ITEM)', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      withTodoList({ items }, 2)
    );
    expect(el.shadowRoot?.querySelector('input')).toBeNull();
    expect(text(el)).toContain('Maths');
  });

  it("ne rend aucune case à cocher si l'écriture n'est pas activée", async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      withTodoList({ items }, 0)
    );
    expect(el.shadowRoot?.querySelector('input')).toBeNull();
    expect(text(el)).toContain('Maths');
  });

  it('garde la case cochée quand la minuterie repeint avant la réponse', async () => {
    // La carte se repeint chaque minute (tickMs) pour passer minuit. Un repeint
    // qui tomberait entre le clic et la mise à jour de l'entité ne doit pas
    // décocher la case : Lit ne repose `.checked` que si la valeur liée a
    // changé, et elle n'a pas changé tant que l'intégration n'a rien publié.
    vi.useFakeTimers();
    try {
      const hass = withTodoList({ items }, 4);
      hass.callService = vi.fn<HomeAssistant['callService']>(() => new Promise(() => {}));
      const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
      const box = el.shadowRoot?.querySelector('input');
      expect(box).not.toBeNull();
      if (box) {
        box.checked = true;
        box.dispatchEvent(new Event('change'));
      }
      vi.advanceTimersByTime(60_000);
      await el.updateComplete;
      expect(el.shadowRoot?.querySelector('input')?.checked).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  // --- Critique n°2 : désignation du devoir par id, pas par énoncé libre. ---

  it("appelle todo.update_item avec l'identifiant du devoir, pas son énoncé", async () => {
    const hass = withTodoList({ items }, 4);
    const spy = vi.fn().mockResolvedValue(undefined);
    hass.callService = spy;
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
    const box = el.shadowRoot?.querySelector('input');
    expect(box).not.toBeNull();
    if (box) {
      box.checked = true;
      box.dispatchEvent(new Event('change'));
    }
    await el.updateComplete;
    expect(spy).toHaveBeenCalledWith(
      'todo',
      'update_item',
      expect.objectContaining({ item: 'h1', status: 'completed' }),
      expect.objectContaining({ entity_id: 'todo.abc_devoirs' })
    );
  });

  it('désigne le bon devoir même quand deux devoirs partagent le même énoncé', async () => {
    const dup = [
      { id: 'h1', subject: 'Maths', description: 'Réviser', due: '2026-09-09', done: false },
      { id: 'h2', subject: 'Anglais', description: 'Réviser', due: '2026-09-09', done: false },
    ];
    const hass = withTodoList({ items: dup }, 4);
    const spy = vi.fn().mockResolvedValue(undefined);
    hass.callService = spy;
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
    const boxes = el.shadowRoot?.querySelectorAll('input');
    expect(boxes?.length).toBe(2);
    const second = boxes?.[1];
    expect(second).toBeTruthy();
    if (second) {
      second.checked = true;
      second.dispatchEvent(new Event('change'));
    }
    await el.updateComplete;
    expect(spy).toHaveBeenCalledWith(
      'todo',
      'update_item',
      expect.objectContaining({ item: 'h2', status: 'completed' }),
      expect.anything()
    );
  });

  // --- Critique n°4 : la case coche/décoche vraiment, et se corrige si l'appel échoue. ---

  it('envoie needs_action en décochant un devoir déjà fait', async () => {
    const done = [{ id: 'h1', subject: 'Maths', description: 'X', due: '2026-09-09', done: true }];
    const hass = withTodoList({ items: done }, 4);
    const spy = vi.fn().mockResolvedValue(undefined);
    hass.callService = spy;
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
    const box = el.shadowRoot?.querySelector('input');
    expect(box?.checked).toBe(true);
    if (box) {
      box.checked = false;
      box.dispatchEvent(new Event('change'));
    }
    await el.updateComplete;
    expect(spy).toHaveBeenCalledWith(
      'todo',
      'update_item',
      expect.objectContaining({ status: 'needs_action' }),
      expect.anything()
    );
  });

  it('ne propose pas de case pour un devoir sans identifiant, plutôt que de le désigner par son énoncé', async () => {
    // L'entité todo nomme un devoir par son `uid` ou par son `summary`, qui
    // est la MATIÈRE : l'énoncé HTML ne désigne rien côté service.
    const sansId = [{ subject: 'Physique', description: '<p>X</p>', due: '2026-09-09', done: false }];
    const hass = withTodoList({ items: sansId }, 4);
    const spy = vi.fn().mockResolvedValue(undefined);
    hass.callService = spy;
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('Physique');
    expect(el.shadowRoot?.querySelector('input[type="checkbox"]')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("restaure la case à cocher si l'appel échoue", async () => {
    const todo = [{ id: 'h1', subject: 'Maths', description: 'X', due: '2026-09-09', done: false }];
    const hass = withTodoList({ items: todo }, 4);
    hass.callService = vi.fn().mockRejectedValue(new Error('échec'));
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
    const box = el.shadowRoot?.querySelector('input');
    expect(box?.checked).toBe(false);
    if (box) {
      box.checked = true;
      box.dispatchEvent(new Event('change'));
    }
    await el.updateComplete;
    // Laisse le `catch` de la promesse rejetée s'exécuter avant d'observer la case.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(box?.checked).toBe(false);
  });

  // --- Important n°5 : pastille « en retard » et lignes en retard marquées. ---

  it('affiche une pastille « en retard » quand homework_overdue est on, et marque les lignes en retard', async () => {
    const overdueItems = [
      { id: 'h1', subject: 'Maths', description: 'Passé', due: '2020-01-01', done: false },
      { id: 'h2', subject: 'Anglais', description: 'Futur', due: '2099-01-01', done: false },
    ];
    const hass = hw({ items: overdueItems }, '2', [
      {
        key: 'binary_sensor:homework_overdue',
        entity_id: 'binary_sensor.abc_devoirs_en_retard',
        device: 'dev_enfant',
        state: 'on',
        attributes: {},
      },
    ]);
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain('en retard');
    // Une pastille pour le bandeau d'en-tête, une pour la ligne en retard.
    expect(el.shadowRoot?.querySelectorAll('.chip.problem').length).toBe(2);
  });

  it('sépare la pastille de BANDEAU, qui suit le capteur, de celle de LIGNE, qui suit la date', async () => {
    // Ce test attendait zéro pastille sur la fixture partagée, et il est tombé
    // à minuit : l'échéance de `items[0]` était « aujourd'hui » le jour où il
    // a été écrit, elle est devenue « hier ». La carte n'a pas changé, le
    // calendrier oui — `isOverdue` compare à `new Date()` et cette carte n'a
    // aucune couture d'horloge, contrairement à la vue journée.
    //
    // Il dit maintenant ce qu'il voulait dire, sur des dates qui ne peuvent
    // plus dériver : le BANDEAU suit `binary_sensor:homework_overdue`, la
    // pastille de LIGNE suit la DATE, et les deux sont indépendantes. La
    // version précédente ne prouvait rien de cette séparation — elle comptait
    // zéro parce qu'aucune des deux ne s'était déclenchée.
    const capteurEteint = [
      {
        key: 'binary_sensor:homework_overdue',
        entity_id: 'binary_sensor.abc_devoirs_en_retard',
        device: 'dev_enfant' as const,
        state: 'off',
        attributes: {},
      },
    ];
    const futur = [
      { id: 'h1', subject: 'Maths', description: 'X', due: '2099-01-01', done: false },
    ];
    const passe = [
      { id: 'h1', subject: 'Maths', description: 'X', due: '2020-01-01', done: false },
    ];

    const rien = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: futur }, '1', capteurEteint)
    );
    expect(rien.shadowRoot?.querySelectorAll('.chip.problem').length).toBe(0);
    // Appariement positif : la carte rend bien sa ligne, elle n'est pas vide.
    expect(text(rien)).toContain('Maths');

    const uneSeule = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: passe }, '1', capteurEteint)
    );
    // Une seule : la ligne. Pas le bandeau, puisque le capteur est éteint.
    expect(uneSeule.shadowRoot?.querySelectorAll('.chip.problem').length).toBe(1);
  });

  // --- Important n°6 : tri par vraie date, affichage via formatDayLabel. ---

  it("trie par échéance réelle (pas par comparaison de chaînes) et rend une date lisible, pas l'ISO brut", async () => {
    const mixed = [
      { id: 'h1', subject: 'Anglais', description: 'B', due: '2026-09-20' },
      { id: 'h2', subject: 'Maths', description: 'A', due: '2026-09-01' },
      { id: 'h3', subject: 'Histoire', description: 'C' },
    ];
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: mixed })
    );
    const primaries = Array.from(el.shadowRoot?.querySelectorAll('.row .primary') ?? []).map(
      (n) => n.textContent ?? ''
    );
    const iMaths = primaries.findIndex((p) => p.includes('Maths'));
    const iAnglais = primaries.findIndex((p) => p.includes('Anglais'));
    const iHistoire = primaries.findIndex((p) => p.includes('Histoire'));
    expect(iMaths).toBeGreaterThanOrEqual(0);
    expect(iMaths).toBeLessThan(iAnglais);
    expect(iAnglais).toBeLessThan(iHistoire);

    const t = text(el);
    expect(t).not.toContain('2026-09-01');
    expect(t).toContain('septembre');
  });

  // --- Important n°7 : group_by groupe vraiment, avec de vrais intitulés. ---

  it('groupe par matière avec de vrais intitulés de groupe, pas seulement un tri', async () => {
    const bySubject = [
      { id: 'h1', subject: 'Maths', description: 'A', due: '2026-09-09' },
      { id: 'h2', subject: 'Anglais', description: 'B', due: '2026-09-09' },
      { id: 'h3', subject: 'Maths', description: 'C', due: '2026-09-10' },
    ];
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', group_by: 'subject' },
      hw({ items: bySubject })
    );
    const titles = Array.from(el.shadowRoot?.querySelectorAll('.title') ?? []).map(
      (n) => n.textContent
    );
    expect(titles).toEqual(['Anglais', 'Maths']);
  });

  it('préfère `description_text` publié par l’intégration au HTML nettoyé ici', async () => {
    // La conversion appartient au module qui SAIT que le champ est du HTML :
    // trois cartes avec trois nettoyeurs donneraient trois réponses au même
    // `&amp;amp;`. Mon nettoyage reste le repli pour une intégration
    // antérieure à ce champ — d'où les deux champs, volontairement
    // divergents, dans cette fixture.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({
        items: [
          {
            id: 'h1',
            subject: 'Anglais',
            description: '<div>Version HTML</div>',
            description_text: 'Version texte de l’intégration',
            due: '2026-09-11',
            done: false,
          },
        ],
      })
    );
    const t = text(el);
    expect(t).toContain('Version texte de l’intégration');
    expect(t).not.toContain('Version HTML');
  });

  it('affiche l’énoncé en texte lisible, pas le balisage que PRONOTE envoie', async () => {
    // Forme réelle : l'intégration recopie le HTML du serveur. La carte
    // affichait les balises et les entités à l'écran.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({
        items: [
          {
            id: 'h1',
            subject: 'Anglais',
            description: '<div>Prenez votre cahier.<br>Pensez à l&#039;acheter !</div>',
            due: '2026-09-11',
            done: false,
          },
        ],
      })
    );
    const t = text(el);
    expect(t).toContain('Prenez votre cahier.');
    expect(t).toContain("Pensez à l'acheter !");
    expect(t).not.toContain('<div>');
    expect(t).not.toContain('&#039;');
  });
});

// Le calendrier ET le capteur de retard, montes ensemble parce que le cas
// `limit: 0` a besoin des deux a la fois -- `withCalendar` ne monte que le
// premier.
const withCalendarEtRetard = (attributes: Record<string, unknown>) =>
  hw(attributes, '2', [
    {
      key: 'calendar:homework',
      entity_id: 'calendar.abc_devoirs',
      device: 'dev_enfant',
      state: 'off',
      attributes: {
        message: 'DM de physique',
        all_day: true,
        start_time: '2026-09-15 00:00:00',
        end_time: '2026-09-16 00:00:00',
      },
    },
    {
      key: 'binary_sensor:homework_overdue',
      entity_id: 'binary_sensor.abc_devoirs_en_retard',
      device: 'dev_enfant',
      state: 'on',
      attributes: {},
    },
  ]);

describe('carte devoirs — le lot du 10 septembre 2026', () => {
  /**
   * Les trois défauts corrigés ici ont été trouvés en mesurant la carte sur
   * une instance, pas en relisant le code : les portes étaient vertes.
   *
   * Ce qu'aucune fixture ne combinait avant, et qui explique que les trois
   * soient passés : une échéance passée AVEC `done: true`, et `limit` à une
   * autre valeur que 1.
   */

  const passeFait = {
    id: 'h1',
    subject: 'Maths',
    description: 'Rendu',
    due: '2020-01-01',
    done: true,
  };
  const passeAFaire = {
    id: 'h2',
    subject: 'Anglais',
    description: 'En souffrance',
    due: '2020-01-01',
    done: false,
  };

  // --- 1. `done` fait partie de la definition du retard. ---

  it('ne dit pas « en retard » d’un devoir fait dont l’échéance est passée', async () => {
    // Le cas NORMAL, pas un cas de coin : on coche après avoir fait, et
    // l'échéance passe ensuite. Aucun capteur de bandeau dans cette fixture,
    // donc toute pastille vient forcément d'une LIGNE.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: [passeFait, passeAFaire] })
    );
    // Appariement positif : les deux devoirs sont bien rendus.
    expect(text(el)).toContain('Rendu');
    expect(text(el)).toContain('En souffrance');
    // Et une seule pastille pour deux échéances également passées.
    expect(pastilles(el)).toEqual(['en retard']);
  });

  it('pose la pastille sur la ligne du devoir non fait, et non sur sa voisine', async () => {
    // Compter les pastilles ne suffit pas : une pastille posée sur la
    // mauvaise ligne donnerait le même compte. On regarde donc OÙ elle est.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: [passeFait, passeAFaire] })
    );
    const lignes = Array.from(el.shadowRoot?.querySelectorAll('.row') ?? []);
    const ligneRendue = lignes.find((r) => r.textContent?.includes('Rendu'));
    const ligneSouffrante = lignes.find((r) => r.textContent?.includes('En souffrance'));
    expect(ligneRendue).toBeDefined();
    expect(ligneSouffrante).toBeDefined();
    expect(ligneRendue?.querySelector('.chip.problem')).toBeNull();
    expect(ligneSouffrante?.querySelector('.chip.problem')).not.toBeNull();
  });

  it('laisse le BANDEAU au capteur, même quand aucune ligne visible n’est en retard', async () => {
    // La séparation des deux sources ne doit pas avoir bougé : le bandeau
    // suit `binary_sensor:homework_overdue`, qui porte le compte de l'élève
    // entier, pas celui de la fenêtre affichée.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: [passeFait] }, '1', [
        {
          key: 'binary_sensor:homework_overdue',
          entity_id: 'binary_sensor.abc_devoirs_en_retard',
          device: 'dev_enfant',
          state: 'on',
          attributes: {},
        },
      ])
    );
    // Une pastille : celle du bandeau. La ligne, elle, n'en porte pas.
    expect(pastilles(el)).toEqual(['en retard']);
    const ligne = Array.from(el.shadowRoot?.querySelectorAll('.row') ?? []).find((r) =>
      r.textContent?.includes('Rendu')
    );
    expect(ligne?.querySelector('.chip.problem')).toBeNull();
  });

  // --- 2. `limit: 0` dit pourquoi il n'y a rien. ---

  it('explique pourquoi rien ne s’affiche quand limit vaut zéro', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', limit: 0 },
      hw({ items })
    );
    const t = text(el);
    // La cause est nommée, et le remède avec elle.
    expect(t).toContain("l'option de limite est à zéro");
    // Et surtout PAS le message d'état vide ordinaire : « rien à faire »
    // au-dessus de devoirs à faire serait faux.
    expect(t).not.toContain('Rien à faire');
    expect(t).not.toContain('Maths');
    expect(t).not.toContain('Anglais');
    expect(titres(el)).toEqual([]);
  });

  it('garde la prochaine échéance et le bandeau sous limit zéro', async () => {
    // Ni l'une ni l'autre ne dépend de la liste affichée, et c'est le moment
    // où elles servent le plus : la carte ne montre aucun devoir, donc tout ce
    // qui reste doit porter.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', limit: 0 },
      withCalendarEtRetard({ items })
    );
    const t = text(el);
    expect(t).toContain('Prochaine échéance');
    expect(t).toContain('DM de physique');
    expect(t).toContain("l'option de limite est à zéro");
    expect(pastilles(el)).toEqual(['en retard']);
  });

  it('distingue limit zéro d’une liste réellement vide', async () => {
    // Les deux rendent zéro devoir ; ils ne disent pas la même chose, et
    // c'est tout l'objet de la correction.
    const zero = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', limit: 0 },
      hw({ items })
    );
    const vide = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: [] }, '0')
    );
    expect(text(zero)).toContain("l'option de limite est à zéro");
    expect(text(vide)).toContain('Rien à faire');
    expect(text(vide)).not.toContain("l'option de limite");
  });

  it('ne déclenche pas la garde pour une limite négative, qui veut dire « tout »', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', limit: -1 },
      hw({ items })
    );
    expect(text(el)).toContain('Maths');
    expect(text(el)).toContain('Anglais');
    expect(text(el)).not.toContain("l'option de limite");
  });

  // --- 3. L'echeance ne se repete plus sous son propre titre. ---

  it('ne répète pas l’échéance en fin de ligne quand elle titre déjà le groupe', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', group_by: 'date' },
      hw({ items })
    );
    // Positif : la date est bien là, une fois, en titre de groupe.
    const t = titres(el);
    expect(t.length).toBe(2);
    expect(t[0]).toContain('septembre');
    // Et nulle part ailleurs.
    expect(fins(el).every((f) => !f.includes('septembre'))).toBe(true);
    expect(text(el)).not.toContain('pour le');
  });

  it('garde l’échéance quand le groupe est une matière, en TÊTE de ligne', async () => {
    /**
     * Le contrepoids : groupée par matière, la date est la seule chose qui
     * situe le devoir. Sans ce cas, retirer l'échéance partout passerait le
     * test précédent — mesuré, il passe.
     *
     * Ce cas assertait la **fin** de ligne jusqu'au 11 septembre 2026. Il a
     * changé de place, pas d'objet : groupée par matière, la ligne redisait
     * l'intertitre — vingt lignes sur vingt sur une instance — et c'est
     * désormais l'échéance qui la titre. Ce qu'il défend reste le même :
     * l'échéance ne disparaît pas.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', group_by: 'subject' },
      hw({ items })
    );
    expect(text(el)).toContain('pour le');
    expect(parGroupe(el).some((g) => g.jours.some((j) => j.includes('septembre')))).toBe(true);
    // Et la fin de ligne ne la reprend pas : elle ne porte plus que le retard.
    expect(fins(el).some((f) => f.includes('septembre'))).toBe(false);
  });

  it('ne redit pas l’intertitre en tête de ligne, dans les deux regroupements', async () => {
    /**
     * La règle, écrite comme règle et non comme cas. Elle avait été posée
     * pour le regroupement par échéance seulement, et le symétrique est
     * resté cassé : le propriétaire a signalé que « le titre dit la matière,
     * puis chaque ligne dit la même matière ». Mesuré sur une instance avant
     * correction : vingt lignes sur vingt, soit la totalité.
     *
     * Le test compare les chaînes rendues, pas les intentions : aucune tête
     * de ligne ne doit être égale à l'intertitre qui la précède.
     */
    // Les deux cartes montées d'abord : un `await` dans la boucle
    // séquentialise deux montages indépendants, et le lint le refuse.
    const montees = await Promise.all(
      (['date', 'subject'] as const).map(async (group_by) => ({
        group_by,
        el: await mountCard(
          'carnet-scolaire-devoirs',
          { device_id: 'dev_enfant', group_by },
          hw({ items })
        ),
      }))
    );
    for (const { group_by, el } of montees) {
      const groupes = parGroupe(el);
      // Appariement positif : il y a bien des groupes et des lignes à
      // comparer. Sans ça, un rendu vide passerait ce test.
      expect(groupes.length).toBeGreaterThan(0);
      expect(groupes.some((g) => g.jours.length > 0)).toBe(true);
      for (const g of groupes) {
        for (const tete of g.jours) {
          expect(tete, 'regroupement ' + group_by).not.toBe(g.titre);
        }
      }
    }
  });

  it('ne pose pas de fin de ligne vide quand il n’y a rien à y mettre', async () => {
    // `listRow` teste la PRÉSENCE de `trailing`, et un gabarit est toujours
    // vrai : groupée par échéance, chaque ligne sans retard aurait posé une
    // boîte vide dans la tête du bloc.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', group_by: 'date' },
      hw(
        {
          items: [{ id: 'h1', subject: 'Maths', description: 'X', due: '2099-01-01', done: false }],
        },
        '1'
      )
    );
    expect(text(el)).toContain('Maths');
    expect(el.shadowRoot?.querySelectorAll('.row .trailing').length).toBe(0);
  });
});

describe('carte devoirs — la hauteur annoncée et l’énoncé repliable', () => {
  /**
   * Les deux bouts du même problème : la carte est haute parce que les
   * énoncés sont longs. `size` doit l'avouer, et `max_lines` permet de la
   * raccourcir sans rien cacher en silence.
   *
   * Ce que ce fichier ne peut PAS mesurer : la coupe elle-même. jsdom
   * n'applique pas `-webkit-line-clamp` et ne peint pas les points de
   * suspension. Cette partie a été mesurée dans Chrome le 10 septembre 2026
   * — 85 pixels sans coupe, 34 à deux lignes, 51 à trois, et les points de
   * suspension vérifiés à la capture. Ici on vérifie la STRUCTURE émise et
   * le nombre de lignes transmis, qui sont ce que la carte contrôle.
   */

  // Plus de 160 caracteres, donc plus de deux lignes a 80 par ligne.
  const ENONCE_LONG =
    'Exercices 12 à 18 page 132, puis relire le chapitre entier et préparer ' +
    'les trois questions de synthèse pour la semaine prochaine sans oublier ' +
    'le matériel demandé en début de cours.';
  const ENONCE_COURT = 'Exercices 4 à 7.';

  // --- 4. la hauteur annoncee dit la verite, a l'ordre de grandeur pres. ---

  it('annonce une hauteur du bon ordre de grandeur, et non plus cinq', async () => {
    // Mesuré le 10 septembre 2026 : 1 376 pixels avec le filtre « à faire »,
    // soit environ 27 unités de 50 pixels. La valeur figée de 5 annonçait
    // 250 pixels — un facteur cinq, et la carte la plus haute des onze se
    // déclarait parmi les plus courtes.
    const parDefaut = taille({});
    expect(parDefaut).toBeGreaterThan(20);
    expect(parDefaut).toBeLessThan(40);
    // Et surtout : plus la valeur qui mentait.
    expect(parDefaut).not.toBe(5);
  });

  it('rend exactement les hauteurs que la documentation publie', async () => {
    /**
     * Les autres cas de ce bloc portent sur des ordres et des bornes,
     * exprès : la formule doit pouvoir être affinée sans casser la suite.
     * Celui-ci fait l'inverse et épingle des valeurs exactes, pour une
     * raison précise : **ces quatre nombres sont écrits dans
     * `docs/tableaux-de-bord.md`**, dans le tableau des hauteurs.
     *
     * Son travail n'est donc pas de figer le code, c'est de tomber le jour
     * où la page devient fausse. Si vous ajustez la formule, ce test vous
     * dira quelle page corriger — ce qu'aucune borne n'aurait fait.
     *
     * Ils ont déjà divergé une fois : la formule était en décimaux et
     * `max_lines: 3` rendait 27 par erreur de représentation, alors que le
     * calcul à la main donne 28. Voir le commentaire de `size`.
     */
    expect(taille({})).toBe(31);
    expect(taille({ filter: 'all' })).toBe(40);
    expect(taille({ filter: 'tomorrow' })).toBe(13);
    expect(taille({ max_lines: 3 })).toBe(28);
  });

  it('classe les trois filtres dans l’ordre de leur hauteur réelle', async () => {
    // C'est le seul usage que Home Assistant fait de `size` : équilibrer des
    // colonnes. Un classement juste vaut donc plus qu'un nombre exact.
    const demain = taille({ filter: 'tomorrow' });
    const aFaire = taille({ filter: 'todo' });
    const tous = taille({ filter: 'all' });
    expect(demain).toBeLessThan(aFaire);
    expect(aFaire).toBeLessThan(tous);
  });

  it('préfère un limit explicite à son estimation par filtre', async () => {
    // Un `limit` est exact, là où les nombres par filtre sont des ordres de
    // grandeur relevés sur une instance.
    const estime = taille({ filter: 'all' });
    const borne = taille({ filter: 'all', limit: 3 });
    expect(borne).toBeLessThan(estime);
  });

  it('tombe au plancher quand la carte ne rend qu’une phrase', async () => {
    // `limit: 0` ne rend que le message, le bandeau et la prochaine
    // échéance : trois unités, pas trente.
    expect(taille({ limit: 0 })).toBe(3);
  });

  it('annonce moins haut quand l’énoncé est replié', async () => {
    const deplie = taille({ filter: 'todo' });
    const replie = taille({ filter: 'todo', max_lines: 2 });
    expect(replie).toBeLessThan(deplie);
  });

  it('ne s’annonce JAMAIS plus haut replié que déplié', async () => {
    // Le piège de la formule : un `max_lines` généreux ne doit pas faire
    // gonfler l'estimation au-delà du cas sans repli, puisque replier ne
    // peut que raccourcir.
    const deplie = taille({ filter: 'todo' });
    for (const max_lines of [2, 3, 5, 12, 20]) {
      expect(taille({ filter: 'todo', max_lines })).toBeLessThanOrEqual(deplie);
    }
  });

  // --- 7. l'enonce se replie, et seulement quand il depasse. ---

  it('n’emballe rien sans l’option : les configurations existantes ne bougent pas', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: unDevoir(ENONCE_LONG) }, '1')
    );
    expect(details(el)).toBeNull();
    // Appariement positif : l'énoncé entier est bien rendu, en clair.
    expect(text(el)).toContain(ENONCE_LONG);
  });

  it('replie un énoncé qui dépasse, et lui transmet le nombre de lignes', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 2 },
      hw({ items: unDevoir(ENONCE_LONG) }, '1')
    );
    const d = details(el);
    expect(d).not.toBeNull();
    expect(d?.getAttribute('style')?.trim()).toBe('--pronote-max-lines: 2');
    // Le repli est fermé au départ : c'est lui qui raccourcit la carte.
    expect(d?.hasAttribute('open')).toBe(false);
  });

  it('garde le texte ENTIER dans le DOM pendant qu’il est replié', async () => {
    // Le point qui rend le dispositif acceptable : un lecteur d'écran et une
    // recherche dans la page trouvent tout. Seule la peinture est coupée.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 2 },
      hw({ items: unDevoir(ENONCE_LONG) }, '1')
    );
    const corps = el.shadowRoot?.querySelector('.enonce > .enonce-corps');
    expect(corps?.textContent).toBe(ENONCE_LONG);
  });

  it('laisse en clair un énoncé qui tient déjà dans les lignes demandées', async () => {
    // L'honnêteté du dispositif : un bloc dépliable sans rien dedans
    // s'annonce à un lecteur d'écran comme du contenu caché, et il irait
    // chercher ce qui n'existe pas.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 3 },
      hw({ items: unDevoir(ENONCE_COURT) }, '1')
    );
    expect(details(el)).toBeNull();
    expect(text(el)).toContain(ENONCE_COURT);
  });

  it('compte les retours à la ligne, pas seulement les caractères', async () => {
    // La forme la plus courante d'un énoncé : une liste courte sur plusieurs
    // lignes. Soixante caractères en six lignes occupent six lignes, et un
    // simple compte de caractères les aurait laissés dépliés.
    const liste = [
      'Be / Have',
      'Il y a',
      'Les couleurs',
      'Les nombres',
      'Les jours',
      'Les mois',
    ].join('\n');
    expect(liste.length).toBeLessThan(80);
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 3 },
      hw({ items: unDevoir(liste) }, '1')
    );
    expect(details(el)).not.toBeNull();
  });

  it('ignore une valeur qui n’est pas un nombre de lignes utilisable', async () => {
    // Montes en parallele plutot qu'un `await` par tour : la regle de lint
    // a raison, rien ici ne depend du tour precedent.
    const montes = await Promise.all(
      ['trois', null, -2, 0].map((max_lines) =>
        mountCard(
          'carnet-scolaire-devoirs',
          { device_id: 'dev_enfant', max_lines },
          hw({ items: unDevoir(ENONCE_LONG) }, '1')
        )
      )
    );
    for (const el of montes) {
      expect(details(el)).toBeNull();
      expect(text(el)).toContain(ENONCE_LONG);
    }
  });

  it('tronque une valeur fractionnaire au lieu de la transmettre telle quelle', async () => {
    // Une fraction dans `-webkit-line-clamp` n'a pas de sens, et le champ
    // vient d'un YAML écrit à la main.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 2.9 },
      hw({ items: unDevoir(ENONCE_LONG) }, '1')
    );
    // Égalité EXACTE, pas `toContain` : la première version de ce test
    // cherchait « 2 » dans l'attribut, et « 2.9 » le contient. Mesuré en
    // retirant le `Math.trunc` : le test passait quand même, donc il ne
    // mesurait rien.
    expect(details(el)?.getAttribute('style')?.trim()).toBe('--pronote-max-lines: 2');
  });

  it('replie chaque devoir séparément, selon SA longueur', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 2 },
      hw(
        {
          items: [
            { id: 'h1', subject: 'Maths', description_text: ENONCE_LONG, due: '2099-01-01' },
            { id: 'h2', subject: 'Anglais', description_text: ENONCE_COURT, due: '2099-01-01' },
          ],
        },
        '2'
      )
    );
    // Un seul repli pour deux devoirs.
    expect(el.shadowRoot?.querySelectorAll('.enonce').length).toBe(1);
    // Et les deux énoncés sont là.
    expect(text(el)).toContain(ENONCE_LONG);
    expect(text(el)).toContain(ENONCE_COURT);
  });
});

describe('carte devoirs — le compte des retards et les pièces jointes', () => {
  /**
   * Deux informations que l'intégration publiait et que la carte jetait.
   * Trouvées en listant les attributs réels plutôt qu'en relisant la carte :
   * `count` sur le capteur de retard, `attachments` sur chaque devoir.
   */

  // --- 5. le bandeau dit COMBIEN. ---

  it('annonce le nombre de devoirs en retard au lieu du seul mot', async () => {
    // Mesuré le 10 septembre 2026 : l'intégration publiait quatre, la carte
    // n'affichait que « en retard ». Le chiffre est le seul élément qui dise
    // s'il faut s'en occuper ce soir.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      avecCapteurRetard({ count: 4 })
    );
    expect(pastilles(el)).toEqual(['4 en retard']);
  });

  it('compte au singulier sans changer de forme', async () => {
    // Les quatre traductions emploient une locution invariable exprès : une
    // seule forme doit servir tous les comptes.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      avecCapteurRetard({ count: 1 })
    );
    expect(pastilles(el)).toEqual(['1 en retard']);
  });

  it('retombe sur le libellé nu quand l’intégration ne publie pas le compte', async () => {
    // Une intégration antérieure à l'attribut ne doit pas perdre le bandeau.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      avecCapteurRetard({})
    );
    expect(pastilles(el)).toEqual(['en retard']);
  });

  it('n’écrit jamais « 0 en retard » sur un bandeau rouge', async () => {
    // Un zéro publié pendant que l'état vaut `on` est une contradiction de
    // l'intégration. La carte n'a pas à la répéter : elle montre le bandeau,
    // qui suit l'état, sans le chiffre qui le démentirait.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      avecCapteurRetard({ count: 0 })
    );
    expect(pastilles(el)).toEqual(['en retard']);
    expect(text(el)).not.toContain('0 en retard');
  });

  it('ignore un compte qui n’est pas un nombre', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      avecCapteurRetard({ count: 'quatre' })
    );
    expect(pastilles(el)).toEqual(['en retard']);
  });

  it('laisse la pastille de LIGNE sans compte : le chiffre est au bandeau', async () => {
    // Le discriminant. « 4 en retard » sur la ligne d'un devoir dirait que
    // CE devoir est en retard de quatre, ce qui ne veut rien dire. Le compte
    // porte sur l'élève, la pastille de ligne sur la date du devoir.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      avecCapteurRetard({ count: 4 }, [
        { id: 'h1', subject: 'Maths', description_text: 'Passé', due: '2020-01-01', done: false },
      ])
    );
    // Deux pastilles : le bandeau chiffré, puis la ligne au libellé nu.
    expect(pastilles(el)).toEqual(['4 en retard', 'en retard']);
  });

  // --- 6. les pieces jointes existent enfin. ---

  const DEUX_PIECES = [
    {
      id: 'h1',
      subject: 'Maths',
      description_text: 'Exercices 4 à 7.',
      due: '2099-01-01',
      attachments: ['fiche-revision.pdf', 'schema.png'],
    },
  ];

  it('nomme les pièces jointes d’un devoir', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: DEUX_PIECES }, '1')
    );
    const ligne = piecesJointes(el);
    expect(ligne).not.toBeNull();
    // Le libellé nomme le groupe pour un lecteur d'écran, il n'est plus
    // écrit à l'écran : deux noms de fichiers dans deux pastilles disent
    // déjà ce qu'une ligne « Pièces jointes : » répétait.
    expect(nomGroupePieces(el)).toContain('Pièces jointes');
    expect(ligne?.textContent).not.toContain('Pièces jointes');
    expect(ligne?.textContent).toContain('fiche-revision.pdf');
    expect(ligne?.textContent).toContain('schema.png');
  });

  it('accorde le libellé au nombre de pièces', async () => {
    const une = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: [{ ...DEUX_PIECES[0], attachments: ['fiche-revision.pdf'] }] }, '1')
    );
    expect(nomGroupePieces(une)).toContain('Pièce jointe');
    expect(nomGroupePieces(une)).not.toContain('Pièces jointes');
  });

  it('n’affiche aucune ligne quand le devoir n’a pas de pièce', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: [
            { id: 'h1', subject: 'Maths', description_text: 'Sans pièce', due: '2099-01-01' },
          ],
        },
        '1'
      )
    );
    expect(piecesJointes(el)).toBeNull();
    // Appariement positif : la ligne du devoir est bien rendue.
    expect(text(el)).toContain('Sans pièce');
  });

  it('écarte ce qui n’est pas un nom utilisable', async () => {
    // Une version future qui passerait à des objets ferait sinon afficher
    // « [object Object] », et une chaîne vide un séparateur solitaire.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        { items: [{ ...DEUX_PIECES[0], attachments: [{ url: 'x' }, '', '   ', 'vrai.pdf'] }] },
        '1'
      )
    );
    const ligne = piecesJointes(el);
    expect(ligne?.textContent).toContain('vrai.pdf');
    expect(ligne?.textContent).not.toContain('object');
    // Une seule pièce retenue, donc le singulier.
    expect(nomGroupePieces(el)).toContain('Pièce jointe');
  });

  it('n’affiche pas de ligne quand aucune pièce n’est utilisable', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: [{ ...DEUX_PIECES[0], attachments: [{ url: 'x' }, ''] }] }, '1')
    );
    expect(piecesJointes(el)).toBeNull();
    expect(text(el)).toContain('Exercices 4 à 7.');
  });

  it('se tait quand show_attachments vaut faux', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', show_attachments: false },
      hw({ items: DEUX_PIECES }, '1')
    );
    expect(piecesJointes(el)).toBeNull();
    expect(text(el)).not.toContain('fiche-revision.pdf');
    // Appariement positif : le devoir est toujours là.
    expect(text(el)).toContain('Exercices 4 à 7.');
  });

  it('garde les pièces jointes VISIBLES quand l’énoncé est replié', async () => {
    // C'est justement le devoir dont on ne lira que les trois premières
    // lignes : s'il porte un document, il doit continuer à le dire. La ligne
    // vit donc hors du bloc dépliable.
    const long = 'Exercices 12 à 18 page 132, puis relire le chapitre entier et préparer '.repeat(
      3
    );
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 2 },
      hw({ items: [{ ...DEUX_PIECES[0], description_text: long }] }, '1')
    );
    expect(details(el)).not.toBeNull();
    const ligne = piecesJointes(el);
    expect(ligne).not.toBeNull();
    // Hors du bloc repliable, et non dedans.
    expect(details(el)?.contains(ligne)).toBe(false);
  });

  it('rend la ligne même quand le devoir n’a pas d’énoncé', async () => {
    // `listRow` teste la présence de `secondary` : un devoir sans énoncé
    // mais avec une pièce ne doit pas la perdre au passage.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        { items: [{ id: 'h1', subject: 'Maths', due: '2099-01-01', attachments: ['seule.pdf'] }] },
        '1'
      )
    );
    expect(piecesJointes(el)?.textContent).toContain('seule.pdf');
  });

  it('ne rend cliquable que ce qui porte une adresse', async () => {
    // Un nom seul ne devient pas un lien. La raison n'est pas une
    // interdiction du projet -- un `href` n'appelle aucun service, et un
    // commentaire d'ici l'a affirmé à tort -- c'est qu'il n'y a rien à
    // ouvrir. Inviter à cliquer sur ce qui ne répond pas est pire que de
    // n'afficher qu'un nom.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: DEUX_PIECES }, '1')
    );
    const ligne = piecesJointes(el);
    expect(ligne?.querySelectorAll('a, button').length).toBe(0);
    expect(ligne?.textContent).toContain('fiche-revision.pdf');
  });

  it('rend chaque pièce en pastille, l’idiome visuel du dépôt', async () => {
    /**
     * La forme a été choisie, pas héritée : le propriétaire a demandé
     * l'intégration adaptée à Home Assistant plutôt que le gabarit du site
     * web de PRONOTE. La pastille est déjà le vocabulaire de quatre cartes
     * d'ici, elle tire ses couleurs des variables du thème, et elle donne une
     * cible de clic — ce qu'un nom précédé d'un tiret n'était pas.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: DEUX_PIECES }, '1')
    );
    const rendues = pastillesPieces(el);
    expect(rendues.length).toBe(2);
    expect(rendues.map((n) => n.textContent?.trim())).toEqual([
      'fiche-revision.pdf',
      'schema.png',
    ]);
    // Sans adresse, la pastille est un span : rien qui invite au clic.
    expect(rendues.every((n) => n.tagName === 'SPAN')).toBe(true);
  });
});

describe('carte devoirs — la liste des pièces jointes et son lien', () => {
  /**
   * Deux demandes du propriétaire le 10 septembre 2026 : une **liste**, pour
   * distinguer plusieurs documents sur un même devoir, et un lien qui
   * s'ouvre dans le navigateur — le nom d'un PDF ne permet pas de lire
   * l'exercice qui est dedans.
   *
   * Ce qui bloque la seconde, et que ces tests ne peuvent pas débloquer :
   * l'intégration publie des **noms seuls**. Mesuré sur une instance, douze
   * pièces sans schéma ni barre oblique, et aucune adresse dans les
   * soixante-sept entités. La carte est donc prête et attend la donnée :
   * c'est exactement ce que les cas « lien » ci-dessous établissent, avec des
   * adresses synthétiques.
   */

  // --- la liste ---

  it('rend une vraie liste, un élément par pièce', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: devoirAvecPieces(['fiche.pdf', 'corrige.pdf']) }, '1')
    );
    // La sémantique de liste, pour qu'un lecteur d'écran annonce « deux
    // éléments » : deux noms mis à la suite sur une ligne ne disaient pas où
    // s'arrêtait le premier.
    expect(el.shadowRoot?.querySelector('[role="list"]')).not.toBeNull();
    const elements = elementsPieces(el);
    expect(elements.length).toBe(2);
    expect(elements.map((n) => n.textContent?.trim())).toEqual(['fiche.pdf', 'corrige.pdf']);
  });

  it('nomme le groupe pour un lecteur d’écran, accordé au nombre', async () => {
    /**
     * Le libellé a quitté l'écran mais pas la carte. Une liste de pastilles
     * sans nom s'annonce « liste, deux éléments, fiche.pdf » : le lecteur
     * saurait qu'il y a une liste sans savoir de quoi. Le nom accessible
     * répond à ça, sans coûter la ligne que le libellé visible coûtait.
     */
    const deux = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: devoirAvecPieces(['a.pdf', 'b.pdf']) }, '1')
    );
    expect(nomGroupePieces(deux)).toContain('Pièces jointes');
    // Et surtout : il ne s'écrit plus, sinon la ligne serait revenue.
    expect(piecesJointes(deux)?.textContent).not.toContain('Pièces jointes');
    const une = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: devoirAvecPieces(['a.pdf']) }, '1')
    );
    expect(nomGroupePieces(une)).toContain('Pièce jointe');
    expect(elementsPieces(une).length).toBe(1);
  });

  it('n’invente aucun lien sur ce que l’intégration publie aujourd’hui', async () => {
    // L'état réel : des noms. Aucun `a` ne doit apparaître, sinon la carte
    // proposerait d'ouvrir ce qu'elle ne peut pas ouvrir.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: devoirAvecPieces(['fiche-revision.pdf', 'chanson.mp3']) }, '1')
    );
    expect(elementsPieces(el).length).toBe(2);
    expect(liensPieces(el).length).toBe(0);
    expect(piecesJointes(el)?.textContent).toContain('chanson.mp3');
  });

  // --- le lien, le jour ou l'adresse arrivera ---

  it('ouvre la pièce quand l’intégration publie son adresse', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirAvecPieces([
            { name: 'chanson.mp3', url: 'https://demo.example.invalid/pj/chanson.mp3' },
          ]),
        },
        '1'
      )
    );
    const liens = liensPieces(el);
    expect(liens.length).toBe(1);
    expect(liens[0]?.getAttribute('href')).toBe('https://demo.example.invalid/pj/chanson.mp3');
    expect(liens[0]?.textContent?.trim()).toBe('chanson.mp3');
    // Le lien EST la pastille, il n'est pas dedans : une ancre qui envelopperait
    // un span serait une cible de clic plus petite que ce qu'elle a l'air d'etre.
    expect(liens[0]?.classList.contains('chip')).toBe(true);
    expect(liens[0]?.classList.contains('chip-lien')).toBe(true);
    // Nouvel onglet, et pas de fuite de l'adresse Home Assistant en
    // référent : le document est sur un serveur tiers.
    expect(liens[0]?.getAttribute('target')).toBe('_blank');
    expect(liens[0]?.getAttribute('rel')).toContain('noreferrer');
  });

  it('accepte une chaîne qui est elle-même une adresse, et la nomme lisiblement', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        { items: devoirAvecPieces(['https://demo.example.invalid/pj/le%20corrig%C3%A9.pdf']) },
        '1'
      )
    );
    const liens = liensPieces(el);
    expect(liens.length).toBe(1);
    // Le dernier segment, décodé : une adresse entière en guise de nom serait
    // illisible sur une ligne de carte.
    expect(liens[0]?.textContent?.trim()).toBe('le corrigé.pdf');
  });

  it('met un libellé générique quand l’adresse ne porte pas de nom de fichier', async () => {
    /**
     * Le cas réel, et il a été trouvé en regardant une adresse que le
     * propriétaire a fournie : une pièce jointe PRONOTE s'atteint par un
     * chemin qui se termine par « link », suivi d'un paramètre de session.
     * Le titre du document n'apparaît nulle part dedans.
     *
     * La première version affichait donc « link » comme nom de document, ce
     * qui est pire que muet. L'adresse ci-dessous est synthétique et porte la
     * même FORME, jamais un vrai jeton — une adresse de pièce jointe ouvre le
     * document sans demander d'identifiant.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirAvecPieces([
            'https://demo.example.invalid/pronote/FichiersExternes/JETON/link?Session=1',
          ]),
        },
        '1'
      )
    );
    const liens = liensPieces(el);
    expect(liens.length).toBe(1);
    expect(liens[0]?.textContent?.trim()).toBe('Ouvrir la pièce jointe');
    // Et surtout pas le dernier segment du chemin.
    expect(liens[0]?.textContent?.trim()).not.toBe('link');
  });

  it('lit les variantes de nom de champ qu’une intégration écrit naturellement', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirAvecPieces([
            { filename: 'par-filename.pdf', href: 'https://demo.example.invalid/a.pdf' },
            { title: 'par-title.pdf', link: 'https://demo.example.invalid/b.pdf' },
          ]),
        },
        '1'
      )
    );
    expect(elementsPieces(el).map((n) => n.textContent?.trim())).toEqual([
      'par-filename.pdf',
      'par-title.pdf',
    ]);
    expect(liensPieces(el).length).toBe(2);
  });

  it('dérive un nom quand l’objet n’en porte pas', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: devoirAvecPieces([{ url: 'https://demo.example.invalid/pj/sujet.pdf' }]) }, '1')
    );
    expect(elementsPieces(el).map((n) => n.textContent?.trim())).toEqual(['sujet.pdf']);
  });

  // --- le filtre de schema ---

  it('refuse tout schéma autre que http et https, et garde le nom en texte', async () => {
    /**
     * Le point le plus important de ce bloc. Cette valeur vient du serveur et
     * atterrit dans un attribut `href` : un `javascript:` y exécuterait du
     * code dans la page Home Assistant de l'utilisateur, un `data:` y
     * servirait un document arbitraire.
     *
     * Le nom, lui, reste affiché : écarter le lien ne doit pas faire
     * disparaître l'information que le devoir porte une pièce.
     *
     * Ce cas portait une troisième ligne, `/pronote/piece.pdf`, et elle a
     * été retirée le 11 septembre 2026 : un chemin enraciné est désormais
     * résolu contre l'origine du tableau de bord, parce que c'est la forme
     * sous laquelle l'intégration publie les pièces qu'elle relaie. Le test
     * qui suit prend le relais et dit ce que ce changement coûte.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirAvecPieces([
            { name: 'piege.pdf', url: 'javascript:alert(1)' },
            { name: 'donnee.pdf', url: 'data:text/html,<script></script>' },
          ]),
        },
        '1'
      )
    );
    expect(liensPieces(el).length).toBe(0);
    expect(elementsPieces(el).map((n) => n.textContent?.trim())).toEqual([
      'piege.pdf',
      'donnee.pdf',
    ]);
    expect(el.shadowRoot?.innerHTML).not.toContain('javascript:');
  });

  it('ouvre un chemin enraciné sans vérifier qu’il mène au relais', async () => {
    /**
     * Le coût assumé de l'élargissement, écrit ici pour qu'on ne le
     * « corrige » pas par erreur. La carte ne compare pas le début du chemin
     * à celui du point d'entrée de l'intégration : un chemin local qui ne
     * mène nulle part donne donc un lien qui rend un 404 de Home Assistant.
     *
     * Pourquoi ne pas exiger le préfixe. Ce ne serait pas une garantie de
     * sécurité — c'est l'égalité d'origine qui en est une — et ça inscrirait
     * dans la carte un chemin dont l'intégration est propriétaire. Le jour
     * où elle le renommerait, toutes les pièces redeviendraient muettes
     * **sans un mot** ; sans préfixe, la panne est un 404, visible et
     * diagnosticable. Une régression bruyante vaut mieux qu'une silencieuse.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: devoirAvecPieces([{ name: 'ailleurs.pdf', url: '/pronote/piece.pdf' }]) }, '1')
    );
    const liens = liensPieces(el);
    expect(liens.length).toBe(1);
    expect(liens[0]?.getAttribute('href')).toBe(
      new URL(makeHass().hassUrl?.() ?? '').origin + '/pronote/piece.pdf'
    );
  });

  it('écarte une pièce qui ne donne ni nom ni adresse utilisable', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirAvecPieces([{ url: 'javascript:alert(1)' }, {}, '', 42, null, 'vraie.pdf']),
        },
        '1'
      )
    );
    expect(elementsPieces(el).map((n) => n.textContent?.trim())).toEqual(['vraie.pdf']);
    expect(nomGroupePieces(el)).toContain('Pièce jointe');
  });
});

describe('carte devoirs — les pièces ouvrables, adressées à part', () => {
  /**
   * L'intégration publie **deux** listes sur chaque devoir : `attachments`,
   * les noms de toutes les pièces, et `attachment_links`, les seules pièces
   * ouvrables sous la forme `{ name, url }`. Le rapprochement se fait par le
   * nom, la même chaîne des deux côtés.
   *
   * Pourquoi deux listes plutôt qu'une adresse ajoutée dans la première :
   * `attachments` porte des chaînes depuis l'origine, et y mettre des objets
   * casserait tout gabarit qui la joint par des virgules — la façon normale
   * d'écrire une notification. Le coût a été pesé contre une ligne de carte.
   *
   * Mesuré sur une instance le 10 septembre 2026 : quatre pièces ouvrables
   * sur douze, sur quatre devoirs de vingt. Les huit autres sont des fichiers,
   * dont l'adresse est un artefact de session que l'intégration ne publie
   * pas. Le cas courant reste donc la pastille muette.
   */

  it('ouvre la pièce dont le nom figure dans la liste des liens', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirDeuxListes(
            ['Lien du cahier', 'corrige.pdf'],
            [{ name: 'Lien du cahier', url: 'https://demo.example.invalid/cahier' }]
          ),
        },
        '1'
      )
    );
    // Les deux pièces sont là, dans l'ordre de `attachments`.
    expect(elementsPieces(el).map((n) => n.textContent?.trim())).toEqual([
      'Lien du cahier',
      'corrige.pdf',
    ]);
    // Une seule s'ouvre, et c'est celle qui a une adresse.
    const liens = liensPieces(el);
    expect(liens.length).toBe(1);
    expect(liens[0]?.textContent?.trim()).toBe('Lien du cahier');
    expect(liens[0]?.getAttribute('href')).toBe('https://demo.example.invalid/cahier');
    expect(liens[0]?.getAttribute('target')).toBe('_blank');
  });

  it('garde l’ordre de la première liste, pas celui des liens', async () => {
    /**
     * Un tri qui remonterait les pièces ouvrables ferait bouger les pastilles
     * d'un devoir à l'autre sans qu'aucun lecteur puisse le prévoir. L'ordre
     * de `attachments` est celui que PRONOTE envoie.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirDeuxListes(
            ['a.pdf', 'ouvrable', 'b.pdf'],
            [{ name: 'ouvrable', url: 'https://demo.example.invalid/x' }]
          ),
        },
        '1'
      )
    );
    expect(elementsPieces(el).map((n) => n.textContent?.trim())).toEqual([
      'a.pdf',
      'ouvrable',
      'b.pdf',
    ]);
    expect(liensPieces(el).length).toBe(1);
  });

  it('n’ouvre rien quand la liste des liens est vide', async () => {
    // Le cas courant, et le seul qui existait avant : une semaine sans lien
    // rend cette liste vide, ce qui n'est pas une panne.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: devoirDeuxListes(['fiche.pdf', 'schema.png'], []) }, '1')
    );
    expect(elementsPieces(el).length).toBe(2);
    expect(liensPieces(el).length).toBe(0);
    expect(nomGroupePieces(el)).toContain('Pièces jointes');
  });

  it('n’oublie pas un lien dont le nom ne figure dans aucun nom', async () => {
    /**
     * Le contrat dit que ça n'arrive pas : le nom est la même chaîne des deux
     * côtés. S'il se rompt, perdre une pièce qui s'ouvre serait le pire des
     * deux résultats — elle est donc ajoutée à la fin plutôt que jetée.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirDeuxListes(
            ['fiche.pdf'],
            [{ name: 'orphelin.pdf', url: 'https://demo.example.invalid/o' }]
          ),
        },
        '1'
      )
    );
    expect(elementsPieces(el).map((n) => n.textContent?.trim())).toEqual([
      'fiche.pdf',
      'orphelin.pdf',
    ]);
    expect(liensPieces(el).map((n) => n.textContent?.trim())).toEqual(['orphelin.pdf']);
  });

  it('filtre le schéma de la liste des liens comme de l’autre', async () => {
    // Cette valeur vient du serveur et atteint un attribut `href`.
    // L'intégration filtre déjà, ce verrou est le second.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirDeuxListes(
            ['piege.pdf'],
            [{ name: 'piege.pdf', url: 'javascript:alert(1)' }]
          ),
        },
        '1'
      )
    );
    expect(liensPieces(el).length).toBe(0);
    // Le nom reste affiché : écarter le lien ne fait pas disparaître la pièce.
    expect(elementsPieces(el).map((n) => n.textContent?.trim())).toEqual(['piege.pdf']);
    expect(el.shadowRoot?.innerHTML).not.toContain('javascript:');
  });

  it('dit UNE FOIS par carte pourquoi certaines pièces ne s’ouvrent pas', async () => {
    /**
     * Répond à une phrase du propriétaire : « les liens sur les fichiers ne
     * fonctionnent pas ». Ils ne fonctionneront jamais — l'adresse d'un
     * fichier PRONOTE est un artefact de session — et une pastille qui se
     * tait laisse croire à une panne de la carte.
     *
     * La phrase était d'abord un `title` sur chaque pastille muette. Elle ne
     * répondait qu'à la souris : pas de survol au doigt, et un `span` n'est
     * pas focalisable. Elle est donc rendue en texte, **une seule fois par
     * carte** — répétée sous chaque devoir porteur elle coûterait plusieurs
     * lignes pour une information qu'on lit une fois.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirDeuxListes(
            ['fichier.pdf', 'Lien'],
            [{ name: 'Lien', url: 'https://demo.example.invalid/x' }]
          ),
        },
        '1'
      )
    );
    const muette = pastillesPieces(el).find((n) => n.tagName === 'SPAN');
    expect(muette?.textContent?.trim()).toBe('fichier.pdf');
    // La note est rendue une fois, et nomme le repere visuel.
    const notes = Array.from(el.shadowRoot?.querySelectorAll('.notice') ?? []);
    expect(notes.length).toBe(1);
    expect(notes[0]?.textContent).toContain('soulign');
    // Aucune infobulle : elle ne repondait qu'a la souris.
    expect(muette?.hasAttribute('title')).toBe(false);
    const ancre = liensPieces(el)[0];
    expect(ancre?.textContent?.trim()).toBe('Lien');
    expect(ancre?.hasAttribute('title')).toBe(false);
  });

  it('ouvre les deux homonymes, et c’est la faiblesse assumée du contrat', async () => {
    /**
     * Signalée par l'intégration plutôt que découverte ici : le
     * rapprochement par le nom ne distingue pas deux pièces homonymes dont une
     * seule est ouvrable. Les deux deviennent des ancres vers la même adresse.
     *
     * Ce cas est épinglé **volontairement** avec le comportement actuel, et
     * non corrigé. N'ouvrir que la première serait un choix arbitraire : rien
     * ne dit que c'est elle. Ce test existe pour que la faiblesse soit connue
     * et que personne ne la « répare » au hasard — le jour où le contrat
     * portera une clé unique, il tombera, et ce sera la bonne nouvelle.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw(
        {
          items: devoirDeuxListes(
            ['meme-nom', 'meme-nom'],
            [{ name: 'meme-nom', url: 'https://demo.example.invalid/un' }]
          ),
        },
        '1'
      )
    );
    expect(elementsPieces(el).length).toBe(2);
    expect(liensPieces(el).length).toBe(2);
  });
});

describe('carte devoirs — l’ordre à l’intérieur d’un groupe de matière', () => {
  /**
   * Groupée par matière, la carte ne triait que sur la matière : à matière
   * égale l'ordre restait celui de l'intégration. Mesuré le 10 septembre 2026
   * sur une instance — dans un groupe de six lignes, les échéances sortaient
   * 4, 7, 8, **21**, 11, 11 septembre.
   *
   * Or c'est le seul mode où la ligne porte sa date, donc le seul où l'ordre
   * chronologique porte de l'information : on ouvre un groupe de matière pour
   * savoir ce qui tombe d'abord.
   *
   * Les fixtures ci-dessous sont **anti-chronologiques à dessein**. Le test
   * qui existait avant ne voyait rien parce que la sienne était déjà dans
   * l'ordre par coïncidence : inverser ses deux dates ne faisait rien tomber.
   * Une fixture qui se trouve juste ne prouve pas que le code trie.
   */

  it('trie par échéance à l’intérieur de chaque matière', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', group_by: 'subject' },
      hw({
        items: [
          { id: 'h1', subject: 'Maths', description: 'A', due: '2026-09-21' },
          { id: 'h2', subject: 'Anglais', description: 'B', due: '2026-09-12' },
          { id: 'h3', subject: 'Maths', description: 'C', due: '2026-09-11' },
          { id: 'h4', subject: 'Maths', description: 'D', due: '2026-09-14' },
        ],
      })
    );
    const groupes = parGroupe(el);
    expect(groupes.map((g) => g.titre)).toEqual(['Anglais', 'Maths']);
    // Le groupe Maths : 11, 14, 21 — et non 21, 11, 14 comme l'intégration
    // les envoie.
    const maths = groupes.find((g) => g.titre === 'Maths');
    expect(maths?.jours).toEqual([
      'pour le vendredi 11 septembre',
      'pour le lundi 14 septembre',
      'pour le lundi 21 septembre',
    ]);
  });

  it('place un devoir sans échéance en dernier dans sa matière', async () => {
    /**
     * `Infinity` et non zéro : un devoir sans échéance n'est pas un devoir dû
     * au premier janvier 1970. Avec zéro il ouvrirait chaque groupe, ce qui
     * est exactement l'inverse de ce qu'on veut voir en premier.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', group_by: 'subject' },
      hw({
        items: [
          { id: 'h1', subject: 'Maths', description: 'Sans échéance' },
          { id: 'h2', subject: 'Maths', description: 'Avec', due: '2026-09-11' },
        ],
      })
    );
    const enonces = Array.from(el.shadowRoot?.querySelectorAll('.row .secondary') ?? []).map(
      (n) => (n.textContent ?? '').trim()
    );
    expect(enonces).toEqual(['Avec', 'Sans échéance']);
  });

  it('range les matières selon la langue de l’instance, pas celle du navigateur', async () => {
    /**
     * `localeCompare` sans argument prend la langue du **moteur** — mesuré à
     * `fr-FR` sur l'instance — donc l'ordre dépendait du réglage de chaque
     * visiteur, et deux habitants de la maison pouvaient voir deux ordres.
     *
     * Le suédois sert de témoin **parce qu'il range autrement** : A-rond et
     * O-tréma s'y placent après le z. Mesuré : en français
     * Åke/Anglais/Örjan/Zoologie, en suédois Anglais/Zoologie/Åke/Örjan.
     *
     * C'est ce qui rend ce test contrefactuel : retirer l'argument de langue
     * rend l'ordre français et le fait tomber. Une langue dont la collation
     * coïncide avec celle du moteur n'aurait rien prouvé — c'est l'erreur que
     * j'ai commise en prenant le suédois sur des chaînes où les deux ordres
     * étaient identiques.
     */
    const matieres = [
      { id: 'h1', subject: 'Åke', description: 'A', due: '2026-09-11' },
      { id: 'h2', subject: 'Zoologie', description: 'B', due: '2026-09-11' },
      { id: 'h3', subject: 'Örjan', description: 'C', due: '2026-09-11' },
      { id: 'h4', subject: 'Anglais', description: 'D', due: '2026-09-11' },
    ];
    const suedois = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', group_by: 'subject' },
      makeHass(
        [
          {
            key: 'sensor:homework_todo',
            entity_id: 'sensor.abc_devoirs_a_faire',
            device: 'dev_enfant',
            state: '4',
            attributes: { items: matieres },
          },
        ],
        'sv'
      )
    );
    expect(parGroupe(suedois).map((g) => g.titre)).toEqual([
      'Anglais',
      'Zoologie',
      'Åke',
      'Örjan',
    ]);

    // Appariement positif : la même liste en français donne l'autre ordre,
    // donc c'est bien la langue qui décide et non un hasard de tri.
    const francais = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', group_by: 'subject' },
      hw({ items: matieres }, '4')
    );
    expect(parGroupe(francais).map((g) => g.titre)).toEqual([
      'Åke',
      'Anglais',
      'Örjan',
      'Zoologie',
    ]);
  });
});

/** Le capteur de retard à `on`, plus un capteur de fenêtre vide. */
const videPlusRetard = (count: number, etat: 'on' | 'off') =>
  hw({ items: [] }, '0', [
    {
      key: 'binary_sensor:homework_overdue',
      entity_id: 'binary_sensor.abc_devoirs_en_retard',
      device: 'dev_enfant',
      state: etat,
      attributes: { count },
    },
    {
      key: 'sensor:homework_tomorrow',
      entity_id: 'sensor.abc_devoirs_demain',
      device: 'dev_enfant',
      state: '0',
      attributes: { items: [] },
    },
  ]);

describe('carte devoirs — la deuxième vague d’audit du 10 septembre 2026', () => {
  // L'horloge figée est une variable de module : la laisser posée fausserait
  // tous les tests suivants, y compris ceux des autres blocs.
  afterEach(() => {
    delete testClock.now;
  });

  /**
   * Cinq défauts trouvés en montant la carte sur des combinaisons de données
   * que la suite ne combinait pas — jamais en relisant le code. Les
   * quatre-vingt-quatre tests d'alors étaient verts pendant les cinq, et le
   * lint et `tsc` aussi. C'est la raison d'être de ce bloc : chaque cas y
   * combine ce qui n'était testé que séparément.
   */

  // --- 1. le bandeau de retard et la liste vide ---

  it('garde le bandeau de retard quand la fenêtre est vide', async () => {
    /**
     * Le pire défaut de la carte, et une **fausse mise en sécurité** : le
     * retour de l'état vide était placé avant le calcul du bandeau, donc avec
     * le filtre « pour demain » la carte affichait « Rien à rendre demain »
     * au-dessus de quatre devoirs en retard. Vendredi soir, week-end, jour
     * férié : le cas le plus fréquent de ce filtre, pas un cas de coin.
     *
     * Deux tests s'en approchaient et manquaient chacun une moitié : l'un
     * montait un calendrier sans capteur de retard, l'autre montait les deux
     * mais sous `limit: 0`, c'est-à-dire le chemin qui gardait le bandeau.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', filter: 'tomorrow' },
      videPlusRetard(4, 'on')
    );
    expect(pastilles(el)).toEqual(['4 en retard']);
    // Et le message de vide reste : les deux disent des choses différentes.
    expect(text(el)).toContain('Rien à rendre demain');
  });

  it('n’invente pas de bandeau quand le capteur de retard est à l’arrêt', async () => {
    // Appariement négatif : le bandeau suit l'état du capteur, il n'est pas
    // une décoration de l'état vide.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', filter: 'tomorrow' },
      videPlusRetard(0, 'off')
    );
    expect(pastilles(el)).toEqual([]);
    expect(text(el)).toContain('Rien à rendre demain');
  });

  // --- 2. un lien sans nom n'est plus jete ---

  it('garde un lien sans nom quand une autre pièce n’a pas de nom non plus', async () => {
    /**
     * Le rapprochement des deux listes se fait par le nom. L'ensemble des
     * noms était construit sur un champ optionnel, donc `undefined` y entrait
     * dès qu'une pièce était anonyme — et la boucle de rattrapage écartait
     * alors **tout** lien sans nom, c'est-à-dire exactement ce que le
     * commentaire de la fonction déclare éviter.
     *
     * Une pièce est anonyme quand son adresse ne porte pas de nom de
     * fichier : le chemin d'une pièce PRONOTE finit sans nom.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({
        items: [
          {
            id: 'h1',
            subject: 'Maths',
            description_text: 'X',
            due: '2099-01-01',
            attachments: ['https://demo.example.invalid/pj/JETON/link?Session=1'],
            attachment_links: [{ url: 'https://demo.example.invalid/autre/link?Session=1' }],
          },
        ],
      })
    );
    expect(elementsPieces(el).length).toBe(2);
    expect(liensPieces(el).map((n) => n.getAttribute('href'))).toContain(
      'https://demo.example.invalid/autre/link?Session=1'
    );
  });

  it('ne double pas une pièce anonyme qui pointe déjà la même adresse', async () => {
    // La contrepartie : garder l'orphelin ne doit pas fabriquer deux
    // pastilles pour un seul document.
    const meme = 'https://demo.example.invalid/pj/JETON/link?Session=1';
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({
        items: [
          {
            id: 'h1',
            subject: 'Maths',
            description_text: 'X',
            due: '2099-01-01',
            attachments: [meme],
            attachment_links: [{ url: meme }],
          },
        ],
      })
    );
    expect(elementsPieces(el).length).toBe(1);
  });

  // --- 3. une echeance est un jour, pas un instant ---

  it('ne décale pas une échéance dans un fuseau à décalage négatif', async () => {
    /**
     * `new Date('2026-09-10')` rend minuit **UTC**. Reprojeté à la Martinique,
     * à Cayenne ou à Tahiti, ce minuit recule d'un jour : l'échéance
     * s'affichait la veille et **tout devoir dû aujourd'hui était déclaré en
     * retard**. Trois territoires français où PRONOTE tourne.
     *
     * Le fuseau se pose sur `config.time_zone` parce que `locale.time_zone`
     * vaut `'server'` dans la fixture — la forme réelle, et non un
     * identifiant IANA.
     */
    const hass = dansLeFuseau(
      hw({
        items: [{ id: 'h1', subject: 'Maths', description_text: 'X', due: '2026-09-10' }],
      }),
      'America/Martinique'
    );
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
    const t = titres(el);
    expect(t.length).toBe(1);
    expect(t[0]).toContain('10');
    expect(t[0]).not.toContain('9 septembre');
  });

  it('ne déclare pas en retard un devoir dû aujourd’hui, fuseau négatif compris', async () => {
    /**
     * Le cœur du défaut, et ce que mon premier test ne couvrait pas : il
     * n'assérait que l'intitulé de groupe, qui passe par la mise en forme,
     * alors que « en retard » passe par la comparaison de jours. Retirer le
     * court-circuit de date seule ne le faisait donc pas tomber.
     *
     * L'horloge est figée : midi UTC le 10 vaut huit heures du matin le 10 à
     * la Martinique. Un devoir dû le 10 n'est donc pas en retard — alors que
     * `new Date('2026-09-10')` reprojeté là-bas donnait le 9, strictement
     * antérieur, donc **en retard**.
     */
    testClock.now = '2026-09-10T12:00:00Z';
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      dansLeFuseau(
        hw({
          items: [
            { id: 'h1', subject: 'Maths', description_text: 'Pour aujourd hui', due: '2026-09-10' },
          ],
        }),
        'America/Martinique'
      )
    );
    expect(pastilles(el)).toEqual([]);
    // Appariement positif : la ligne est bien rendue, elle n'est simplement
    // pas en retard.
    expect(text(el)).toContain('Pour aujourd hui');
  });

  it('déclare bien en retard la veille, dans le même fuseau', async () => {
    // Le contrepoids du précédent : la correction ne doit pas avoir éteint la
    // notion de retard, seulement l'avoir recalée d'un jour.
    testClock.now = '2026-09-10T12:00:00Z';
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      dansLeFuseau(
        hw({
          items: [{ id: 'h1', subject: 'Maths', description_text: 'La veille', due: '2026-09-09' }],
        }),
        'America/Martinique'
      )
    );
    expect(pastilles(el)).toEqual(['en retard']);
  });

  it('respecte le fuseau quand l’échéance porte une heure', async () => {
    // Appariement : une valeur qui EST un instant doit suivre le fuseau
    // d'affichage. Le correctif ne doit pas figer tout en UTC.
    const hass = dansLeFuseau(
      hw({
        items: [
          {
            id: 'h1',
            subject: 'Maths',
            description_text: 'X',
            // 00h30 UTC le 11 vaut le 10 à la Martinique.
            due: '2026-09-11T00:30:00Z',
          },
        ],
      }),
      'America/Martinique'
    );
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
    expect(titres(el)[0]).toContain('10');
  });

  // --- 4. la frontiere du repli ---

  it('ne replie pas un énoncé qui occupe EXACTEMENT le nombre de lignes demandé', async () => {
    /**
     * La borne n'avait aucune garde : passer `>` en `>=` dans la condition de
     * repli ne faisait tomber aucun des quatre-vingt-quatre tests, parce
     * qu'aucune fixture n'atteignait jamais l'égalité — 3 contre 2, 1 contre
     * 3, 6 contre 3, 1 contre 2. Sous la mutation, un énoncé entier se
     * repliait quand même : un bloc dépliable sans rien à déplier, et sans
     * points de suspension pour le dire.
     */
    const troisLignes = 'Un.\nDeux.\nTrois.';
    const juste = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 3 },
      hw({ items: [{ id: 'h1', subject: 'Maths', description_text: troisLignes }] })
    );
    expect(details(juste)).toBeNull();
    // Appariement positif : le texte est bien rendu, non replié.
    expect(text(juste)).toContain('Trois.');

    const uneDePlus = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 3 },
      hw({
        items: [{ id: 'h1', subject: 'Maths', description_text: troisLignes + '\nQuatre.' }],
      })
    );
    expect(details(uneDePlus)).not.toBeNull();
  });

  // --- 5. le repli ne se fait plus passer pour un contenu cache ---

  it('sort l’énoncé du contrôle et donne à la bascule un libellé court', async () => {
    /**
     * L'énoncé vivait dans le `summary` d'un `details` : mesuré sur
     * l'instance, **269 caractères de nom accessible** et **zéro** caractère
     * hors du `summary`. Un lecteur d'écran entendait donc l'énoncé entier
     * comme un libellé de bouton, puis se voyait proposer de déplier quelque
     * chose de vide.
     */
    const long = 'Phrase de vingt caractères et quelques, répétée. '.repeat(12);
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 2 },
      hw({ items: [{ id: 'h1', subject: 'Maths', description_text: long }] })
    );
    const b = bascule(el);
    expect(b).not.toBeNull();
    // Le libellé du bouton est court, et ce n'est pas l'énoncé.
    const nom = (b?.textContent ?? '').trim();
    expect(nom.length).toBeLessThan(40);
    expect(nom).not.toContain('répétée');
    // L'énoncé est du texte, hors du bouton.
    const corps = el.shadowRoot?.querySelector('.enonce > .enonce-corps');
    expect(corps?.textContent).toContain('répétée');
    expect(b?.contains(corps ?? null)).toBe(false);
    expect(b?.getAttribute('aria-expanded')).toBe('false');
  });

  it('n’émet aucune bascule quand rien n’est replié', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', max_lines: 5 },
      hw({ items: [{ id: 'h1', subject: 'Maths', description_text: 'Court.' }] })
    );
    expect(bascule(el)).toBeNull();
    expect(text(el)).toContain('Court.');
  });

  // --- 6. les intertitres sont des titres ---

  it('donne aux intertitres de groupe une sémantique de titre', async () => {
    /**
     * Sept intertitres, zéro titre : un lecteur d'écran ne pouvait pas sauter
     * d'un jour au suivant et traversait les vingt énoncés en linéaire.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({
        items: [
          { id: 'h1', subject: 'Maths', description_text: 'A', due: '2026-09-09' },
          { id: 'h2', subject: 'Anglais', description_text: 'B', due: '2026-09-10' },
        ],
      })
    );
    const entetes = Array.from(el.shadowRoot?.querySelectorAll('[role="heading"]') ?? []);
    expect(entetes.length).toBe(2);
    expect(entetes.every((n) => n.getAttribute('aria-level') === '3')).toBe(true);
    // Appariement : ce sont bien les intertitres, pas autre chose.
    expect(entetes.every((n) => n.classList.contains('title'))).toBe(true);
  });

  // --- 7. un enonce publie vide retombe sur le HTML ---

  it('retombe sur le HTML quand `description_text` est vide', async () => {
    /**
     * `??` ne se replie que sur l'absence, alors que `plainText` traite déjà
     * la chaîne vide comme une absence. Un devoir publiant les deux champs,
     * le premier vide, rendait la matière et **rien** en dessous — alors que
     * l'énoncé existait et était lisible.
     */
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({
        items: [
          {
            id: 'h1',
            subject: 'Maths',
            description_text: '   ',
            description: '<div>Exercice 12 page 40</div>',
          },
        ],
      })
    );
    expect(text(el)).toContain('Exercice 12 page 40');
  });

  // --- 8. la note des fichiers, une fois par carte ---

  it('ne rend la note des fichiers qu’une fois, même sur plusieurs devoirs', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({
        items: [
          { id: 'h1', subject: 'Maths', description_text: 'A', attachments: ['a.pdf'] },
          { id: 'h2', subject: 'Anglais', description_text: 'B', attachments: ['b.pdf'] },
          { id: 'h3', subject: 'Histoire', description_text: 'C', attachments: ['c.pdf'] },
        ],
      })
    );
    expect(el.shadowRoot?.querySelectorAll('.notice').length).toBe(1);
  });

  it('se tait quand toutes les pièces s’ouvrent', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({
        items: [
          {
            id: 'h1',
            subject: 'Maths',
            description_text: 'A',
            attachments: ['a.pdf'],
            attachment_links: [{ name: 'a.pdf', url: 'https://demo.example.invalid/a.pdf' }],
          },
        ],
      })
    );
    expect(el.shadowRoot?.querySelectorAll('.notice').length).toBe(0);
    // Appariement positif : la pièce est bien rendue, et ouvrable.
    expect(liensPieces(el).length).toBe(1);
  });
});

const avecAdresse = async (url: unknown, nom = 'sujet.pdf') =>
  mountCard(
    'carnet-scolaire-devoirs',
    { device_id: 'dev_enfant' },
    hw({ items: devoirDeuxListes([nom], [{ name: nom, url }]) }, '1')
  );

/**
 * Le tableau d'entrées hostiles, figé. Chaque ligne a été **mesurée** dans un
 * navigateur avant d'être écrite ici, et deux d'entre elles ont changé la
 * forme du filtre.
 *
 * L'origine attendue est celle de l'**instance**, que la fixture publie par
 * `hassUrl` — et elle ne coïncide pas avec celle du document, exprès. C'est
 * ce qui rend le cas Cast mesurable ici : une carte qui résoudrait contre la
 * page produirait une adresse vers `localhost`, et les assertions ci-dessous
 * tomberaient.
 *
 * Aucun hôte n'est écrit en dur, et pas seulement par propreté : l'hôte d'une
 * instance réelle n'a rien à faire dans un dépôt public. La garde des hôtes
 * autorisées de `test/guards.test.ts` a d'ailleurs refusé la première version
 * de ce commentaire, qui citait l'origine de l'environnement de test.
 */
describe('carte devoirs — l’élargissement du filtre d’adresses', () => {
  /**
   * La forme que l'intégration publie pour une pièce qu'elle relaie
   * elle-même : un chemin **enraciné**, une empreinte, une signature.
   *
   * Entièrement synthétique, et la précaution n'est pas rhétorique — une
   * adresse de pièce jointe ouvre le document **sans demander d'identifiant**.
   * Seule la FORME est réelle.
   */
  const SIGNATURE =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJwYXRoIjoiL2FwaS9zeW50aGV0aXF1ZSIsImlhdCI6MTc4OTAwMDAwMCwiZXhwIjoxNzg5MDQzMjAwfQ' +
    '.bGFfc2lnbmF0dXJlX2NpX2Rlc3NvdXNfZXN0X3N5bnRoZXRpcXVlX3Bhc191bmVfdnJhaWU';
  const CHEMIN_SIGNE =
    '/api/carnet_scolaire/attachment/0123456789abcdef/a1b2c3d4e5f60718?authSig=' + SIGNATURE;

  /** L'origine de l'instance telle que la fixture la publie. */
  const ORIGINE_INSTANCE = new URL(makeHass().hassUrl?.() ?? '').origin;

  it('ouvre la pièce que l’intégration relaie sur sa propre origine', async () => {
    /**
     * Le défaut que cet élargissement corrige, et il n'était pas théorique :
     * mesuré le 10 septembre 2026 sur une instance, seize des vingt-trois
     * pièces jointes portent cette forme, et la carte les écartait toutes —
     * `new URL` sans base lève sur un chemin enraciné.
     */
    const el = await avecAdresse(CHEMIN_SIGNE);
    const liens = liensPieces(el);
    expect(liens.length).toBe(1);
    expect(liens[0]?.getAttribute('href')).toBe(ORIGINE_INSTANCE + CHEMIN_SIGNE);
    expect(liens[0]?.textContent?.trim()).toBe('sujet.pdf');
  });

  it('rend la signature caractère pour caractère', async () => {
    /**
     * Une signature abîmée donnerait un 401, donc une pièce qui a l'air
     * ouvrable et ne s'ouvre pas. `new URL(chemin, origine).href` ne
     * réécrit ni le point, ni le tiret bas, ni les caractères base64url.
     */
    const el = await avecAdresse(CHEMIN_SIGNE);
    const href = liensPieces(el)[0]?.getAttribute('href') ?? '';
    expect(new URL(href).search).toBe('?authSig=' + SIGNATURE);
    expect(href.length).toBe(ORIGINE_INSTANCE.length + CHEMIN_SIGNE.length);
  });

  it('laisse intacte une adresse absolue chez un tiers', async () => {
    const el = await avecAdresse('https://demo.example.invalid/pj/a.pdf?v=2#page=3');
    expect(liensPieces(el)[0]?.getAttribute('href')).toBe(
      'https://demo.example.invalid/pj/a.pdf?v=2#page=3'
    );
  });

  it('garde le fragment d’un chemin enraciné sans sortir du chemin', async () => {
    // Un fragment n'est pas un segment de chemin : les deux points ne
    // remontent nulle part.
    const el = await avecAdresse('/api/carnet_scolaire/attachment/abc#/../..');
    const href = liensPieces(el)[0]?.getAttribute('href') ?? '';
    expect(new URL(href).pathname).toBe('/api/carnet_scolaire/attachment/abc');
    expect(new URL(href).origin).toBe(ORIGINE_INSTANCE);
  });

  it('résout contre l’instance et non contre la page', async () => {
    /**
     * Le défaut que la session de l'intégration a signalé, et il ne se voit
     * pas sur une instance ordinaire où les deux origines coïncident.
     *
     * Le tableau de bord **Cast** est servi depuis une origine tierce et
     * parle à Home Assistant par WebSocket. Résoudre un chemin enraciné
     * contre le document y fabriquerait une adresse vers ce tiers : le lien
     * est mort, **et** la signature part chez lui dans l'adresse demandée.
     * Un `rel="noreferrer"` n'y change rien — le jeton n'est pas dans le
     * référent, il est dans l'adresse.
     *
     * Ce test est le seul de ce fichier qui distingue les deux bases, et
     * c'est la fixture qui le permet en les faisant volontairement différer.
     */
    const el = await avecAdresse(CHEMIN_SIGNE);
    const href = liensPieces(el)[0]?.getAttribute('href') ?? '';
    expect(new URL(href).origin).toBe(ORIGINE_INSTANCE);
    expect(new URL(href).origin).not.toBe(window.location.origin);
  });

  it('refuse le chemin enraciné quand l’instance est inconnue', async () => {
    /**
     * Le repli, et il est volontairement sévère. Sans `hassUrl`, la carte ne
     * sait pas contre quoi résoudre — et deviner, c'est précisément envoyer
     * la signature ailleurs. Une pastille muette est le moindre mal.
     */
    const sansUrl: HomeAssistant = {
      ...hw({ items: devoirDeuxListes(['sujet.pdf'], [{ name: 'sujet.pdf', url: CHEMIN_SIGNE }]) }, '1'),
      hassUrl: undefined,
    };
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, sansUrl);
    expect(liensPieces(el).length).toBe(0);
    // Appariement positif : la pièce est rendue, et la carte dit pourquoi.
    expect(pastillesPieces(el).length).toBe(1);
    expect(el.shadowRoot?.querySelectorAll('.notice').length).toBe(1);
  });

  it('accepte encore une adresse absolue quand l’instance est inconnue', async () => {
    // Le contrepoids : l'absence de `hassUrl` ne doit éteindre QUE le chemin
    // enraciné. Une adresse absolue n'a pas besoin de base.
    const sansUrl: HomeAssistant = {
      ...hw(
        {
          items: devoirDeuxListes(
            ['sujet.pdf'],
            [{ name: 'sujet.pdf', url: 'https://demo.example.invalid/pj/sujet.pdf' }]
          ),
        },
        '1'
      ),
      hassUrl: undefined,
    };
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, sansUrl);
    expect(liensPieces(el).length).toBe(1);
  });

  /**
   * Ce qui doit rester refusé, et pourquoi chaque ligne y est.
   *
   * La troisième est celle qui a décidé de la forme du filtre. Une barre
   * oblique suivie d'une barre oblique **inverse** satisfait « commence par
   * une seule barre oblique », et l'analyseur d'URL la normalise pourtant en
   * autorité : le nom qui suit devient l'hôte. Un test de préfixe l'aurait
   * laissée passer ; seule l'égalité d'origine **après** analyse l'attrape.
   */
  const REFUSEES: [string, string][] = [
    ['//evil.example/x', 'une autorité déguisée en chemin'],
    ['/' + String.fromCharCode(92) + 'evil.example/x', 'la barre oblique inverse normalisée'],
    ['api/carnet_scolaire/attachment/abc', 'sans barre oblique initiale : quelle base ?'],
    ['javascript:alert(1)', 'exécution dans la page de l’utilisateur'],
    ['JaVaScRiPt:alert(1)', 'le schéma est insensible à la casse'],
    ['java' + String.fromCharCode(9) + 'script:alert(1)', 'la tabulation est ôtée du schéma'],
    ['data:text/html,pas%20un%20document', 'un document arbitraire'],
    ['vbscript:msgbox', 'le même exécutable, autre nom'],
    ['file:///etc/passwd', 'le disque du lecteur'],
    ['', 'vide'],
  ];

  for (const [entree, raison] of REFUSEES) {
    it('refuse ' + raison, async () => {
      const el = await avecAdresse(entree, 'piece');
      expect(liensPieces(el).length).toBe(0);
      // Appariement positif : la pièce est bien rendue, simplement muette.
      // Sans ça, un rendu entièrement cassé passerait ce test.
      expect(pastillesPieces(el).length).toBe(1);
      expect(pastillesPieces(el)[0]?.textContent?.trim()).toBe('piece');
    });
  }

  it('n’annonce plus l’impossibilité quand tout s’ouvre', async () => {
    // La note de bas de carte porte sur les pièces SANS adresse. Un chemin
    // enraciné en est une : la note doit disparaître.
    const el = await avecAdresse(CHEMIN_SIGNE);
    expect(el.shadowRoot?.querySelectorAll('.notice').length).toBe(0);
    expect(liensPieces(el).length).toBe(1);
  });

  it('annonce encore l’impossibilité pour une pièce sans adresse', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant' },
      hw({ items: devoirDeuxListes(['a.pdf', 'b.pdf'], [{ name: 'a.pdf', url: CHEMIN_SIGNE }]) }, '1')
    );
    expect(el.shadowRoot?.querySelectorAll('.notice').length).toBe(1);
    expect(liensPieces(el).length).toBe(1);
    // Deux pastilles, dont une seule est muette : l'ancre porte elle aussi la
    // classe `chip`, parce que le lien EST la pastille.
    expect(pastillesPieces(el).length).toBe(2);
    expect(pastillesPieces(el).filter((n) => !n.classList.contains('chip-lien')).length).toBe(1);
  });
});

describe('carte devoirs — l’état et l’échéance, deux filtres indépendants', () => {
  /**
   * Le filtre unique mêlait deux questions, et on ne pouvait pas demander
   * « à faire, pour demain ». Horloge figée au jeudi 10 septembre 2026 : les
   * libellés de chaque devoir disent sa place par rapport à ce jour.
   */
  const AUJOURDHUI = '2026-09-10';
  const DEVOIRS = [
    { id: 'r', subject: 'Maths', description_text: 'devoir-en-retard', due: '2026-09-08', done: false },
    { id: 'a', subject: 'Maths', description_text: 'devoir-aujourdhui', due: AUJOURDHUI, done: false },
    { id: 'df', subject: 'Anglais', description_text: 'devoir-demain-fait', due: '2026-09-11', done: true },
    { id: 'da', subject: 'Anglais', description_text: 'devoir-demain-a-faire', due: '2026-09-11', done: false },
    { id: 'j6', subject: 'Histoire', description_text: 'devoir-j-plus-6', due: '2026-09-16', done: false },
    { id: 'j7', subject: 'Histoire', description_text: 'devoir-j-plus-7', due: '2026-09-17', done: false },
    { id: 'sd', subject: 'Histoire', description_text: 'devoir-sans-date', done: false },
  ];
  const TOUS_LES_LIBELLES = DEVOIRS.map((d) => d.description_text);

  /**
   * Les trois capteurs, remplis comme l'intégration les remplit : « tous »
   * porte tout l'horizon, « à faire » les non faits, « pour demain » les
   * devoirs du lendemain, faits compris.
   */
  const troisCapteurs = () =>
    makeHass([
      {
        key: 'sensor:homework',
        entity_id: 'sensor.abc_devoirs',
        device: 'dev_enfant',
        state: String(DEVOIRS.length),
        attributes: { items: DEVOIRS },
      },
      {
        key: 'sensor:homework_todo',
        entity_id: 'sensor.abc_devoirs_a_faire',
        device: 'dev_enfant',
        state: '6',
        attributes: { items: DEVOIRS.filter((d) => !d.done) },
      },
      {
        key: 'sensor:homework_tomorrow',
        entity_id: 'sensor.abc_devoirs_demain',
        device: 'dev_enfant',
        state: '2',
        attributes: { items: DEVOIRS.filter((d) => d.due === '2026-09-11') },
      },
    ]);

  /** Les libellés visibles, dans l'ordre de `DEVOIRS`. */
  const visibles = async (config: Record<string, unknown>): Promise<string[]> => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', ...config },
      troisCapteurs()
    );
    const contenu = text(el);
    return TOUS_LES_LIBELLES.filter((libelle) => contenu.includes(libelle));
  };

  beforeEach(() => {
    testClock.now = `${AUJOURDHUI}T12:00:00Z`;
  });
  afterEach(() => {
    delete testClock.now;
  });

  it('passe minuit tout seul sur un tableau de bord laissé ouvert', async () => {
    // L'objectif est un tableau de bord permanent. La nuit, aucune collecte
    // n'a lieu, donc aucun état d'entité ne change : seule l'horloge avance.
    // Sans minuterie déclarative (tickMs), le devoir « de demain » restait
    // affiché comme tel au réveil, alors qu'il est dû aujourd'hui.
    vi.useFakeTimers();
    try {
      const el = await mountCard(
        'carnet-scolaire-devoirs',
        { device_id: 'dev_enfant', status: 'todo', period: 'from_tomorrow' },
        troisCapteurs()
      );
      expect(text(el)).toContain('devoir-demain-a-faire');

      testClock.now = '2026-09-11T12:00:00Z';
      vi.advanceTimersByTime(60_000);
      await el.updateComplete;

      expect(text(el)).not.toContain('devoir-demain-a-faire');
      expect(text(el)).toContain('devoir-j-plus-6');
    } finally {
      vi.useRealTimers();
    }
  });

  it('à faire, pour demain : la combinaison que l’ancien filtre ne permettait pas', async () => {
    expect(await visibles({ status: 'todo', period: 'tomorrow' })).toEqual([
      'devoir-demain-a-faire',
    ]);
  });

  it('tous, pour demain : le fait compris', async () => {
    expect(await visibles({ status: 'all', period: 'tomorrow' })).toEqual([
      'devoir-demain-fait',
      'devoir-demain-a-faire',
    ]);
  });

  it('à faire, demain et après : ni le retard, ni aujourd’hui, ni le fait', async () => {
    expect(await visibles({ status: 'todo', period: 'from_tomorrow' })).toEqual([
      'devoir-demain-a-faire',
      'devoir-j-plus-6',
      'devoir-j-plus-7',
    ]);
  });

  it('tous, aujourd’hui et après : le retard et le sans-date en sont exclus', async () => {
    expect(await visibles({ status: 'all', period: 'from_today' })).toEqual([
      'devoir-aujourdhui',
      'devoir-demain-fait',
      'devoir-demain-a-faire',
      'devoir-j-plus-6',
      'devoir-j-plus-7',
    ]);
  });

  it('les 7 prochains jours : aujourd’hui compris, le septième jour après exclu', async () => {
    expect(await visibles({ status: 'todo', period: 'week' })).toEqual([
      'devoir-aujourdhui',
      'devoir-demain-a-faire',
      'devoir-j-plus-6',
    ]);
  });

  it('à faire, toutes les échéances : le retard et le sans-date restent', async () => {
    expect(await visibles({ status: 'todo', period: 'all' })).toEqual([
      'devoir-en-retard',
      'devoir-aujourdhui',
      'devoir-demain-a-faire',
      'devoir-j-plus-6',
      'devoir-j-plus-7',
      'devoir-sans-date',
    ]);
  });

  it.each([
    ['sans filtre', {}, { status: 'todo', period: 'all' }],
    ['filter: todo', { filter: 'todo' }, { status: 'todo', period: 'all' }],
    ['filter: tomorrow', { filter: 'tomorrow' }, { status: 'all', period: 'tomorrow' }],
    ['filter: all', { filter: 'all' }, { status: 'all', period: 'all' }],
  ])('un YAML existant (%s) garde exactement son aspect', async (_nom, ancien, nouveau) => {
    // Aucun tableau de bord ne doit changer d'aspect parce que le formulaire
    // a changé : l'ancien réglage et sa traduction montrent la même chose.
    const avant = await visibles(ancien);
    expect(avant.length).toBeGreaterThan(0);
    expect(avant).toEqual(await visibles(nouveau));
  });

  it('les nouveaux champs priment sur l’ancien, chacun pour lui-même', async () => {
    // `filter: tomorrow` voulait dire « tous, pour demain » ; `status` n'en
    // remplace que la moitié.
    expect(await visibles({ filter: 'tomorrow', status: 'todo' })).toEqual([
      'devoir-demain-a-faire',
    ]);
  });

  it('une période inconnue retombe sur l’ancien filtre, sans rien casser', async () => {
    expect(await visibles({ filter: 'tomorrow', period: 'demain_peut_etre' })).toEqual([
      'devoir-demain-fait',
      'devoir-demain-a-faire',
    ]);
  });

  it('dit « aucun devoir sur cette période » quand la période est vide', async () => {
    testClock.now = '2026-12-24T12:00:00Z';
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', status: 'all', period: 'week' },
      troisCapteurs()
    );
    expect(text(el)).toContain('Aucun devoir sur cette période.');
    // Contrepoids : la carte est bien montée et a lu ses capteurs.
    expect(text(el)).not.toContain('devoir-aujourdhui');
    expect(el.shadowRoot?.querySelector('ha-card')).not.toBeNull();
  });

  it('propose les deux filtres dans le formulaire, et plus l’ancien', () => {
    const noms = SPEC.schema({ type: 'custom:carnet-scolaire-devoirs' }).map((champ) => champ.name);
    expect(noms).toContain('status');
    expect(noms).toContain('period');
    expect(noms).not.toContain('filter');
  });
});

const devoirAvecRefs = (attachment_refs: unknown[], attachment_links?: unknown[]) => [
  {
    id: 'h1',
    subject: 'Anglais',
    description_text: 'Lire le document.',
    due: '2099-01-01',
    attachments: ['sujet.pdf'],
    attachment_refs,
    ...(attachment_links === undefined ? {} : { attachment_links }),
  },
];


/** Un onglet factice : ce que `window.open` rend, réduit à ce que la carte touche. */
const faireOnglet = () => ({
  opener: {} as unknown,
  location: { replace: vi.fn() },
  close: vi.fn(),
});

/**
 * Espionne `window.open` et lui fait rendre `onglet`.
 *
 * La conversion est la seule du fichier : jsdom n'ouvre pas de fenêtre, et
 * fabriquer un `Window` complet pour trois propriétés ne testerait rien de
 * plus. La carte ne touche que `opener`, `location.replace` et `close`.
 */
const espionnerOuverture = (onglet: ReturnType<typeof faireOnglet> | null) =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- un onglet factice réduit aux trois membres que la carte emploie ; jsdom n'ouvre aucune fenêtre réelle à rendre à la place.
  vi.spyOn(window, 'open').mockReturnValue(onglet as unknown as Window);


const boutonPiece = (el: HTMLElement & MountableElement): HTMLButtonElement | null => {
  const n = el.shadowRoot?.querySelector('.devoirs-piece button');
  return n instanceof HTMLButtonElement ? n : null;
};


const etatPieces = (el: HTMLElement & MountableElement): string =>
  (el.shadowRoot?.querySelector('.devoirs-piece-etat')?.textContent ?? '').trim();


const monter = async (
  refs: unknown[],
  service: HomeAssistant['callService'],
  links?: unknown[]
): Promise<HTMLElement & MountableElement> => {
  const hass = hw({ items: devoirAvecRefs(refs, links) }, '1');
  hass.callService = service;
  return mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
};

describe('carte devoirs — l’adresse d’un fichier se demande au clic', () => {
  /**
   * L'intégration ne publie plus l'adresse signée d'un fichier dans un
   * attribut : elle publie son empreinte, et la carte demande l'adresse au
   * service `get_attachment_url` au moment du clic. Tout ce qui suit est
   * synthétique — l'empreinte comme le chemin ; seule la FORME est réelle.
   */
  const CLE = '0123456789abcdef';
  const CHEMIN =
    '/api/carnet_scolaire/attachment/entree_synthetique/' + CLE + '?authSig=jeton.synthetique';
  const ORIGINE_INSTANCE = new URL(makeHass().hassUrl?.() ?? '').origin;

  const LOCALE = [{ name: 'sujet.pdf', kind: 'local', key: CLE }];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rend un bouton pour un fichier, et n’appelle AUCUN service à l’affichage', async () => {
    // Le cœur de la règle du projet : une carte ne déclenche rien en
    // s'affichant. Le bouton existe, le service n'a pas été touché.
    const service = vi.fn<HomeAssistant['callService']>().mockResolvedValue({ response: { url: CHEMIN } });
    const el = await monter(LOCALE, service);
    const bouton = boutonPiece(el);
    expect(bouton?.textContent?.trim()).toBe('sujet.pdf');
    expect(bouton?.classList.contains('chip-lien')).toBe(true);
    expect(liensPieces(el).length).toBe(0);
    expect(service).not.toHaveBeenCalled();
    // Ouvrable : la note des pièces muettes ne s'affiche pas.
    expect(text(el)).not.toContain('ne peuvent pas être ouvertes');
  });

  it('ouvre l’onglet AVANT de demander l’adresse, puis l’y dirige', async () => {
    const onglet = faireOnglet();
    const ouvrir = espionnerOuverture(onglet);
    const service = vi.fn<HomeAssistant['callService']>().mockResolvedValue({
      context: {},
      response: { url: CHEMIN, expires_at: '2099-01-01T00:05:00Z' },
    });
    const el = await monter(LOCALE, service);
    boutonPiece(el)?.click();
    await vi.waitFor(() => {
      expect(onglet.location.replace).toHaveBeenCalled();
    });

    expect(service).toHaveBeenCalledWith(
      'carnet_scolaire',
      'get_attachment_url',
      { device_id: 'dev_enfant', key: CLE },
      undefined,
      false,
      true
    );
    expect(service).toHaveBeenCalledTimes(1);
    expect(ouvrir).toHaveBeenCalledWith('', '_blank');
    // L'ordre est ce qui compte : un `window.open` après l'`await` n'est plus
    // rattaché au geste de l'utilisateur, et Safari le bloque.
    expect(ouvrir.mock.invocationCallOrder[0]).toBeLessThan(
      service.mock.invocationCallOrder[0] ?? 0
    );
    expect(onglet.opener).toBeNull();
    expect(onglet.location.replace).toHaveBeenCalledWith(ORIGINE_INSTANCE + CHEMIN);
    expect(onglet.close).not.toHaveBeenCalled();
    expect(etatPieces(el)).toBe('');
  });

  it.each([
    ['protocole-relatif', '//evil.example/x'],
    ['javascript:', 'javascript:alert(1)'],
    ['sans schéma', 'evil.example/x'],
    ['absente', undefined],
  ])('refuse une adresse de service %s, ferme l’onglet et le dit', async (_nom, url) => {
    const onglet = faireOnglet();
    espionnerOuverture(onglet);
    const service = vi.fn<HomeAssistant['callService']>().mockResolvedValue({ response: { url } });
    const el = await monter(LOCALE, service);
    boutonPiece(el)?.click();
    await vi.waitFor(() => {
      expect(onglet.close).toHaveBeenCalled();
    });
    expect(onglet.location.replace).not.toHaveBeenCalled();
    expect(etatPieces(el)).toBe('La pièce n’a pas pu être ouverte.');
  });

  it.each([
    ['attachment_not_collected', 'la collecte des devoirs n’a pas encore eu lieu'],
    ['attachment_unknown', 'Rafraîchissez la page'],
    ['autre_chose', 'La pièce n’a pas pu être ouverte.'],
  ])('traduit le refus « %s » en une phrase qui dit quoi faire', async (translation_key, attendu) => {
    const onglet = faireOnglet();
    espionnerOuverture(onglet);
    const service = vi
      .fn()
      .mockRejectedValue({ code: 'service_validation_error', message: 'x', translation_key });
    const el = await monter(LOCALE, service);
    boutonPiece(el)?.click();
    await vi.waitFor(() => {
      expect(etatPieces(el)).toContain(attendu);
    });
    expect(onglet.close).toHaveBeenCalled();
    expect(boutonPiece(el)?.disabled).toBe(false);
  });

  it('dit que le navigateur a bloqué l’onglet, au lieu de se taire', async () => {
    espionnerOuverture(null);
    const service = vi.fn<HomeAssistant['callService']>().mockResolvedValue({ response: { url: CHEMIN } });
    const el = await monter(LOCALE, service);
    boutonPiece(el)?.click();
    await vi.waitFor(() => {
      expect(etatPieces(el)).toContain('bloqué');
    });
  });

  it('ouvre directement un lien externe absolu, sans passer par le service', async () => {
    const service = vi.fn<HomeAssistant['callService']>();
    const el = await monter(
      [{ name: 'video', kind: 'external', url: 'https://demo.example.invalid/video/1' }],
      service
    );
    expect(liensPieces(el).map((a) => a.getAttribute('href'))).toEqual([
      'https://demo.example.invalid/video/1',
    ]);
    expect(boutonPiece(el)).toBeNull();
    expect(service).not.toHaveBeenCalled();
  });

  it.each([
    ['un externe enraciné', { name: 'sujet.pdf', kind: 'external', url: CHEMIN }],
    ['un genre inconnu', { name: 'sujet.pdf', kind: 'futur', key: CLE }],
    ['une empreinte mal formée', { name: 'sujet.pdf', kind: 'local', key: 'ABC' }],
    ['un externe javascript:', { name: 'sujet.pdf', kind: 'external', url: 'javascript:alert(1)' }],
  ])('rend muet %s, et affiche la note', async (_nom, ref) => {
    const el = await monter([ref], vi.fn<HomeAssistant['callService']>());
    // Contrepoids positif : la pastille est bien là, seulement muette.
    expect(pastillesPieces(el).map((n) => n.textContent?.trim())).toEqual(['sujet.pdf']);
    expect(liensPieces(el).length).toBe(0);
    expect(boutonPiece(el)).toBeNull();
    expect(text(el)).toContain('ne peuvent pas être ouvertes');
  });

  it('garde muette une pièce que l’intégration exclut de attachment_refs', async () => {
    // L'intégration retire des refs une pièce OPAQUE (non ouvrable) et ne la
    // nomme plus que dans `attachments`. Lire les refs seules faisait oublier
    // au devoir qu'il portait un document.
    const el = await monter([], vi.fn<HomeAssistant['callService']>());
    expect(pastillesPieces(el).map((n) => n.textContent?.trim())).toEqual(['sujet.pdf']);
    expect(liensPieces(el).length).toBe(0);
    expect(text(el)).toContain('ne peuvent pas être ouvertes');
  });

  it('ne double pas une pièce nommée à la fois dans attachments et dans attachment_refs', async () => {
    const el = await monter(
      [{ name: 'sujet.pdf', kind: 'local', key: CLE }],
      vi.fn<HomeAssistant['callService']>()
    );
    expect(pastillesPieces(el).map((n) => n.textContent?.trim())).toEqual(['sujet.pdf']);
    expect(boutonPiece(el)?.textContent?.trim()).toBe('sujet.pdf');
  });

  it('ignore attachment_links dès que attachment_refs est publié', async () => {
    // Pendant sa version de dépréciation, l'intégration publie encore les
    // deux. La carte ne doit plus lire l'ancienne : c'est elle qui porte le
    // jeton qu'on retire des attributs.
    const el = await monter(LOCALE, vi.fn<HomeAssistant['callService']>(), [{ name: 'sujet.pdf', url: CHEMIN }]);
    expect(liensPieces(el).length).toBe(0);
    expect(boutonPiece(el)?.textContent?.trim()).toBe('sujet.pdf');
  });

  it('retombe sur attachment_links quand attachment_refs est absent', async () => {
    // Le décalage de versions dans l'autre sens : une intégration antérieure.
    const hass = hw(
      { items: devoirDeuxListes(['sujet.pdf'], [{ name: 'sujet.pdf', url: CHEMIN }]) },
      '1'
    );
    const el = await mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant' }, hass);
    expect(liensPieces(el).map((a) => a.getAttribute('href'))).toEqual([
      ORIGINE_INSTANCE + CHEMIN,
    ]);
  });
});
