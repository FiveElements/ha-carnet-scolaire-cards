import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC, testClock } from '../../src/cards/emploi-du-temps';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-emploi-du-temps': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

// Réinitialisé avant chaque test : `testClock` est une variable de module
// partagée entre tous les tests de ce fichier — sans cette remise à zéro, un
// test qui ne fixe pas `now` hériterait de la valeur laissée par le test
// précédent.
beforeEach(() => {
  testClock.now = undefined;
});

const lessons = [
  // Volontairement dans le désordre : un tri qui recevrait des cours déjà
  // triés en entrée passerait même sans aucun `sort`.
  {
    subject: 'Histoire',
    start: '2026-09-08T10:00:00+02:00',
    end: '2026-09-08T11:00:00+02:00',
    test: true,
  },
  {
    subject: 'Maths',
    start: '2026-09-08T08:00:00+02:00',
    end: '2026-09-08T09:00:00+02:00',
    classroom: 'B204',
    teachers: ['M. Dupont'],
    canceled: false,
  },
  {
    subject: 'Anglais',
    start: '2026-09-08T09:00:00+02:00',
    end: '2026-09-08T10:00:00+02:00',
    classroom: 'A101',
    canceled: true,
  },
];

const day = (attributes: Record<string, unknown>, state = '3') =>
  makeHass([
    {
      key: 'sensor:lessons_today',
      entity_id: 'sensor.abc_cours_du_jour',
      device: 'dev_enfant',
      state,
      attributes,
    },
  ]);

// `binary_sensor:in_class` a un droit de veto sur le surlignage, jamais
// celui de désigner un créneau : le capteur sait SI un cours a lieu, les
// horodatages savent LEQUEL.
const dayWithInClass = (state: string) =>
  makeHass([
    {
      key: 'sensor:lessons_today',
      entity_id: 'sensor.abc_cours_du_jour',
      device: 'dev_enfant',
      state: '3',
      attributes: { lessons },
    },
    {
      key: 'binary_sensor:in_class',
      entity_id: 'binary_sensor.abc_en_cours',
      device: 'dev_enfant',
      state,
    },
  ]);

describe('carte emploi-du-temps', () => {
  it('liste les cours par ordre chronologique avec heure et salle, quel que soit leur ordre en entrée', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', show_rooms: true },
      day({ lessons })
    );
    const t = text(el);
    expect(t).toContain('08:00');
    expect(t).toContain('Maths');
    expect(t).toContain('B204');
    expect(t.indexOf('Maths')).toBeLessThan(t.indexOf('Anglais'));
    expect(t.indexOf('Anglais')).toBeLessThan(t.indexOf('Histoire'));
  });

  it('trie sur l’instant réel, pas sur la chaîne, quand deux créneaux mêlent des décalages horaires', async () => {
    const mixed = [
      // Exprimé en Z : le premier chiffre d'heure ('07') semble « petit »,
      // alors que l'instant réel (07:00 UTC = 09:00 heure de Paris) est le
      // plus tardif des deux.
      {
        subject: 'Anglais',
        start: '2026-09-08T07:00:00Z',
        end: '2026-09-08T08:00:00Z',
      },
      // Exprimé avec son décalage : chaîne lexicographiquement « plus
      // grande » ('08'), pourtant l'instant le plus tôt (06:00 UTC).
      {
        subject: 'Maths',
        start: '2026-09-08T08:00:00+02:00',
        end: '2026-09-08T09:00:00+02:00',
      },
    ];
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({ lessons: mixed })
    );
    const t = text(el);
    expect(t.indexOf('Maths')).toBeLessThan(t.indexOf('Anglais'));
  });

  it('barre un cours annulé sans le retirer', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({ lessons })
    );
    expect(text(el)).toContain('Anglais');
    expect(el.shadowRoot?.querySelector('.canceled')).not.toBeNull();
  });

  it('signale un cours annulé via `status` même sans `canceled`', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({
        lessons: [
          {
            subject: 'SVT',
            start: '2026-09-08T08:00:00+02:00',
            end: '2026-09-08T09:00:00+02:00',
            status: 'Cours annulé',
          },
        ],
      })
    );
    const t = text(el);
    expect(t).toContain('SVT');
    expect(t).toContain('annulé');
    expect(el.shadowRoot?.querySelector('.canceled')).not.toBeNull();
  });

  it("affiche le `status` d'un cours qui n'est PAS annulé", async () => {
    // Relevé sur une instance réelle : sur 27 créneaux d'une semaine, deux
    // portent `status: 'Cours modifié'` avec `canceled: false`. La carte les
    // rendait comme des cours parfaitement ordinaires — elle masquait
    // l'information au lieu de la signaler.
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({
        lessons: [
          {
            subject: 'SVT',
            start: '2026-09-08T08:00:00+02:00',
            end: '2026-09-08T09:00:00+02:00',
            canceled: false,
            status: 'Cours modifié',
          },
        ],
      })
    );
    const t = text(el);
    expect(t).toContain('SVT');
    expect(t).toContain('Cours modifié');
    // Modifié n'est pas annulé : la ligne ne doit pas être barrée.
    expect(el.shadowRoot?.querySelector('.canceled')).toBeNull();
  });

  it("garde le motif d'annulation quand `status` en dit plus que « annulé »", async () => {
    // Relevé réel : `canceled: true` avec `status: 'Prof. absent'`. Le
    // drapeau et le motif ne disent pas la même chose, et le motif est ce
    // qu'un parent veut lire.
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({
        lessons: [
          {
            subject: 'SVT',
            start: '2026-09-08T08:00:00+02:00',
            end: '2026-09-08T09:00:00+02:00',
            canceled: true,
            status: 'Prof. absent',
          },
        ],
      })
    );
    const t = text(el);
    expect(t).toContain('annulé');
    expect(t).toContain('Prof. absent');
    expect(el.shadowRoot?.querySelector('.canceled')).not.toBeNull();
  });

  it('ne dit pas deux fois « annulé » quand `status` ne dit rien de plus', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({
        lessons: [
          {
            subject: 'SVT',
            start: '2026-09-08T08:00:00+02:00',
            end: '2026-09-08T09:00:00+02:00',
            canceled: true,
            status: 'Cours annulé',
          },
        ],
      })
    );
    const t = text(el);
    expect(t).toContain('annulé');
    // Une seule mention : le libellé du serveur ne se répète pas à côté de la
    // pastille qui dit déjà la même chose.
    expect(t).not.toContain('Cours annulé');
  });

  it('signale les contrôles', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({ lessons })
    );
    expect(text(el)).toContain('contrôle');
  });

  // Les créneaux ci-dessous ne portent volontairement ni `test` ni `outing` :
  // la carte pose déjà une pastille par créneau à partir de ces champs (voir
  // le test « signale les contrôles » ci-dessus), et ce n'est pas ce que ces
  // quatre tests visent. Ici, on vérifie la pastille de tête de journée,
  // posée depuis les capteurs binaires optionnels `test_today`/`outing_today`
  // — un signal distinct, qui porte sur la journée entière et non sur un
  // créneau précis.
  const plainLessons = [
    {
      subject: 'Maths',
      start: '2026-09-08T08:00:00+02:00',
      end: '2026-09-08T09:00:00+02:00',
    },
  ];

  const dayWithFlags = (flags: { test?: string; outing?: string }) =>
    makeHass([
      {
        key: 'sensor:lessons_today',
        entity_id: 'sensor.abc_cours_du_jour',
        device: 'dev_enfant',
        state: '1',
        attributes: { lessons: plainLessons },
      },
      ...(flags.test === undefined
        ? []
        : [
            {
              key: 'binary_sensor:test_today',
              entity_id: 'binary_sensor.abc_controle_du_jour',
              device: 'dev_enfant' as const,
              state: flags.test,
            },
          ]),
      ...(flags.outing === undefined
        ? []
        : [
            {
              key: 'binary_sensor:outing_today',
              entity_id: 'binary_sensor.abc_sortie_du_jour',
              device: 'dev_enfant' as const,
              state: flags.outing,
            },
          ]),
    ]);

  it('n’affiche aucune pastille de tête de journée quand `test_today` et `outing_today` sont absents, mais affiche bien la journée', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      dayWithFlags({})
    );
    const t = text(el);
    expect(t).not.toContain('contrôle');
    expect(t).not.toContain('sortie');
    // Assertion positive : la journée s'affiche toujours, ce n'est pas
    // l'absence des deux capteurs qui efface la carte.
    expect(t).toContain('Maths');
    expect(t).toContain('08:00');
  });

  it('signale un contrôle en tête de journée quand `test_today` vaut `on`', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      dayWithFlags({ test: 'on' })
    );
    const t = text(el);
    expect(t).toContain('contrôle');
    expect(t).toContain('Maths');
  });

  it('signale une sortie en tête de journée quand `outing_today` vaut `on`', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      dayWithFlags({ outing: 'on' })
    );
    const t = text(el);
    expect(t).toContain('sortie');
    expect(t).toContain('Maths');
  });

  it('n’affiche aucune pastille de tête de journée quand les deux capteurs valent `off`', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      dayWithFlags({ test: 'off', outing: 'off' })
    );
    const t = text(el);
    expect(t).not.toContain('contrôle');
    expect(t).not.toContain('sortie');
    expect(t).toContain('Maths');
  });

  it('ne pose aucune pastille de tête en mode semaine, même avec `test_today` à `on`', async () => {
    // `test_today` ne décrit qu'aujourd'hui. Posée en tête d'une semaine, la
    // pastille affirmerait sans dire quel jour ; posée en tête d'une vue
    // « demain », elle décrirait carrément le mauvais jour. Les créneaux
    // portent déjà leurs propres attributs `test` et `outing`, qui situent
    // l'information au bon endroit dans tous les modes.
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', range: 'week' },
      makeHass([
        {
          key: 'sensor:timetable_week',
          entity_id: 'sensor.abc_emploi_du_temps_de_la_semaine',
          device: 'dev_enfant',
          state: '1',
          attributes: { lessons: plainLessons },
        },
        {
          key: 'binary_sensor:test_today',
          entity_id: 'binary_sensor.abc_controle_du_jour',
          device: 'dev_enfant',
          state: 'on',
        },
      ])
    );
    const t = text(el);
    expect(t).not.toContain('contrôle');
    // Assertion positive : c'est bien la pastille qui disparaît, pas la carte.
    expect(t).toContain('Maths');
  });

  it('dit « aucun cours » sur une liste vide', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({ lessons: [] }, '0')
    );
    const t = text(el);
    expect(t).toContain('Aucun cours');
    expect(t).not.toContain('pas encore collectée');
  });

  it.each([
    ['un objet', {}],
    ['un tableau à trous', [null]],
  ])(
    'ignore un attribut `lessons` qui est %s plutôt qu’un tableau exploitable, sans faire disparaître la carte',
    async (_label, malformed) => {
      const el = await mountCard(
        'carnet-scolaire-emploi-du-temps',
        { device_id: 'dev_enfant' },
        day({ lessons: malformed }, '1')
      );
      // Ni exception (qui effacerait la carte), ni écran vide muet : le
      // message « aucun cours » reste affiché.
      expect(text(el)).toContain('Aucun cours');
    }
  );

  it('dit « pas encore collectée » quand l’entité est indisponible', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({}, 'unavailable')
    );
    expect(text(el)).toContain('pas encore collectée');
  });

  it("dit « introuvable » quand l'entité manque", async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      makeHass([])
    );
    expect(text(el)).toContain('sensor:lessons_today');
  });

  it('annonce une hauteur plus grande en mode semaine qu’en mode journée', () => {
    // `size` est une fonction depuis que le socle l'accepte : une semaine rend
    // trente à quarante lignes là où une journée en rend une poignée, et un
    // nombre figé faisait empiler les colonnes de travers.
    const size = SPEC.size;
    expect(typeof size).toBe('function');
    if (typeof size !== 'function') return;
    expect(size({ type: 'x', range: 'week' })).toBeGreaterThan(size({ type: 'x' }));
    expect(size({ type: 'x', range: 'today' })).toBe(size({ type: 'x' }));
  });

  it('marque « en cours » le créneau qui contient l’instant donné', async () => {
    testClock.now = '2026-09-08T08:30:00+02:00';
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({ lessons })
    );
    expect(text(el)).toContain('en cours');
  });

  it('dit « dispensé » sur un créneau dont l’élève est dispensé, sans le dire « en cours »', async () => {
    testClock.now = '2026-09-08T08:30:00+02:00';
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({ lessons: lessons.map((l) => (l.subject === 'Maths' ? { ...l, exempted: true } : l)) })
    );
    const t = text(el);
    expect(t).toContain('Maths');
    expect(t).toContain('dispensé');
    expect(t).not.toContain('en cours');
  });

  it('ne surligne aucun créneau quand `in_class` vaut `off`, même à une heure de cours', async () => {
    testClock.now = '2026-09-08T08:30:00+02:00';
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      dayWithInClass('off')
    );
    const t = text(el);
    expect(t).not.toContain('en cours');
    // Assertion positive : c'est le surlignage qui tombe, pas la journée.
    expect(t).toContain('Maths');
  });

  it('surligne normalement quand `in_class` vaut `on`', async () => {
    testClock.now = '2026-09-08T08:30:00+02:00';
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      dayWithInClass('on')
    );
    const t = text(el);
    expect(t).toContain('en cours');
    expect(t).toContain('Maths');
  });

  it('ne fabrique aucun surlignage quand `in_class` vaut `on` hors de tout créneau', async () => {
    testClock.now = '2026-09-08T18:00:00+02:00';
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      dayWithInClass('on')
    );
    const t = text(el);
    // Le capteur dit qu'un cours a lieu, mais aucun créneau ne le porte : la
    // carte se tait plutôt que de désigner au hasard.
    expect(t).not.toContain('en cours');
    expect(t).toContain('Maths');
  });

  it('ne marque aucun créneau hors des heures de cours, tout en affichant bien les cours du jour', async () => {
    testClock.now = '2026-09-08T18:00:00+02:00';
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant' },
      day({ lessons })
    );
    const t = text(el);
    expect(t).not.toContain('en cours');
    // Assertion positive : un rendu entièrement cassé (liste vide, carte
    // disparue) passerait aussi le test s'il ne portait que sur l'absence.
    expect(t).toContain('Maths');
    expect(t).toContain('Histoire');
  });

  it('change de clé selon range', async () => {
    const hass = makeHass([
      {
        key: 'sensor:timetable_week',
        entity_id: 'sensor.abc_edt_semaine',
        device: 'dev_enfant',
        state: '1',
        attributes: { lessons: [lessons[1]] },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', range: 'week' },
      hass
    );
    expect(text(el)).toContain('Maths');
  });
});
