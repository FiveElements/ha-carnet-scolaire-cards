import { beforeAll, describe, expect, it } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC } from '../../src/cards/notes';
import { makeHass } from '../fixtures/hass';
import { mountCard, text, type MountableElement } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-notes': HTMLElement & MountableElement;
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

const grades = [
  // `value`, `student` : les noms que l'integration publie reellement
  // (`_grade_dict`, `_average_dict`). Les anciennes fixtures ecrivaient
  // `grade` et `average`, qui n'existent pas — et la carte, qui les lisait,
  // affichait donc « — » a la place de chaque note sur une vraie instance.
  { subject: 'Maths', value: 14.5, out_of: 20, coefficient: 2, date: '2026-09-05' },
  { subject: 'Anglais', value: 12, out_of: 20, coefficient: 1, date: '2026-09-06' },
];

const base = () =>
  makeHass([
    {
      key: 'sensor:overall_average',
      entity_id: 'sensor.abc_moyenne_generale',
      device: 'dev_enfant',
      // Home Assistant publie `str(13.5)` côté Python : un point, jamais une
      // virgule. Une fixture en virgule ferait passer `Number(...)` par NaN
      // et laisserait `formatGrade` rendre la chaîne telle quelle — le test
      // serait vert sans jamais exercer la conversion vers le séparateur
      // localisé.
      state: '13.5',
      attributes: { out_of: 20 },
    },
    {
      key: 'sensor:grades',
      entity_id: 'sensor.abc_notes',
      device: 'dev_enfant',
      state: '2',
      attributes: { items: grades },
    },
    {
      key: 'sensor:averages',
      entity_id: 'sensor.abc_moyennes_par_matiere',
      device: 'dev_enfant',
      state: '2',
      attributes: {
        items: [{ subject: 'Maths', student: 14.2, class_average: 12.1, out_of: 20 }],
      },
    },
  ]);

describe('carte notes', () => {
  it('affiche la moyenne générale, les dernières notes et les moyennes par matière', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['average', 'latest', 'subjects'] },
      base()
    );
    const t = text(el);
    expect(t).toContain('13,5');
    expect(t).toContain('Maths');
    expect(t).toContain('14,5/20');
    expect(t).toContain('12,1');
  });

  it('affiche les moyennes par matière même si la liste des dernières notes est vide', async () => {
    // Régression : un retour anticipé dans le bloc « dernières notes »
    // sortait de `render` avant le bloc « par matière » et jetait les
    // moyennes déjà résolues (sensor:averages) au profit du message vide.
    const hass = makeHass([
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
      {
        key: 'sensor:averages',
        entity_id: 'sensor.abc_moyennes_par_matiere',
        device: 'dev_enfant',
        state: '1',
        attributes: {
          items: [{ subject: 'Maths', student: 14.2, class_average: 12.1, out_of: 20 }],
        },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest', 'subjects'] },
      hass
    );
    const t = text(el);
    expect(t).toContain('Maths');
    expect(t).toContain('14,2');
    expect(t).not.toContain('Aucune note');
  });

  it('dit « aucune moyenne » sur une carte limitée à la section « par matière »', async () => {
    const hass = makeHass([
      {
        key: 'sensor:averages',
        entity_id: 'sensor.abc_moyennes_par_matiere',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['subjects'] },
      hass
    );
    expect(text(el)).toContain('Aucune moyenne');
  });

  it.each([
    ['un objet', {}],
    ['une chaîne', 'x'],
    ['un tableau à trous', [null]],
  ])(
    'ignore un attribut `items` qui est %s plutôt qu’un tableau, sans faire disparaître la carte',
    async (_label, malformed) => {
      const hass = makeHass([
        {
          key: 'sensor:grades',
          entity_id: 'sensor.abc_notes',
          device: 'dev_enfant',
          state: '1',
          attributes: { items: malformed },
        },
      ]);
      const el = await mountCard(
        'carnet-scolaire-notes',
        { device_id: 'dev_enfant', sections: ['latest'] },
        hass
      );
      // Ni exception (qui effacerait la carte), ni écran vide muet : le
      // message « aucune note » reste affiché.
      expect(text(el)).toContain('Aucune note');
    }
  );

  it('affiche le motif quand la dernière note est une sentinelle', async () => {
    const hass = makeHass([
      {
        key: 'sensor:latest_grade',
        entity_id: 'sensor.abc_derniere_note',
        device: 'dev_enfant',
        state: 'unknown',
        attributes: { subject: 'Maths', status: 'Absent' },
      },
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'] },
      hass
    );
    expect(text(el)).toContain('Absent');
  });

  it('dit « aucune note » sur une liste vide', async () => {
    const hass = makeHass([
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'] },
      hass
    );
    const t = text(el);
    expect(t).toContain('Aucune note');
    expect(t).not.toContain('pas encore collectée');
  });

  it('montre les notes les plus récentes par date, quel que soit l’ordre reçu', async () => {
    // L'intégration garde l'ordre du serveur (`listeDevoirs`), qui n'est pas
    // chronologique : `latestFirst` seul aurait pris la dernière reçue.
    const hass = makeHass([
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: '2',
        attributes: {
          items: [
            { subject: 'Anglais', value: 12, out_of: 20, date: '2026-09-06' },
            { subject: 'Maths', value: 14.5, out_of: 20, date: '2026-09-02' },
          ],
        },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'], limit: 1 },
      hass
    );
    const t = text(el);
    expect(t).toContain('Anglais');
    expect(t).not.toContain('Maths');
  });

  it('dit « pas encore collectée », pas « aucune note », quand la section voulue n’est pas collectée', async () => {
    // Une seule ancre exploitable suffit au socle pour rendre la carte : ici
    // les moyennes par matière. La section « dernières notes » dépend des
    // notes, qui ne sont pas encore collectées : le vide serait un mensonge.
    const hass = makeHass([
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: 'unknown',
        attributes: {},
      },
      {
        key: 'sensor:averages',
        entity_id: 'sensor.abc_moyennes_par_matiere',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'] },
      hass
    );
    const t = text(el);
    expect(t).toContain('pas encore collectée');
    expect(t).not.toContain('Aucune note');
  });

  it('dit « introuvable » quand la section voulue n’a pas d’entité au registre', async () => {
    const hass = makeHass([
      {
        key: 'sensor:averages',
        entity_id: 'sensor.abc_moyennes_par_matiere',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'] },
      hass
    );
    const t = text(el);
    expect(t).toContain('sensor:grades');
    expect(t).not.toContain('Aucune note');
  });

  it('dit « pas encore collectée » quand tout est indisponible', async () => {
    const hass = makeHass([
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: 'unavailable',
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'] },
      hass
    );
    expect(text(el)).toContain('pas encore collectée');
  });

  it("dit « introuvable » quand aucune des clés requiresAny n'existe", async () => {
    const el = await mountCard('carnet-scolaire-notes', { device_id: 'dev_enfant' }, makeHass([]));
    expect(text(el)).toContain('introuvable');
  });

  it("n'expose aucune option de période", () => {
    // La résolution ne sait pas distinguer deux périodes closes (spec §4.1).
    // Ce test échoue si quelqu'un réintroduit l'option sans traiter le fond.
    expect(SPEC.schema({ type: 'x' }).map((f) => f.name)).not.toContain('period');
  });

  it('affiche la période en cours quand elle est résolue', async () => {
    const hass = makeHass([
      {
        key: 'sensor:overall_average',
        entity_id: 'sensor.abc_moyenne_generale',
        device: 'dev_enfant',
        state: '13.5',
        attributes: { out_of: 20 },
      },
      {
        key: 'sensor:current_period',
        entity_id: 'sensor.abc_periode',
        device: 'dev_enfant',
        state: 'Trimestre 1',
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['average'] },
      hass
    );
    const t = text(el);
    expect(t).toContain('Trimestre 1');
    expect(t).toContain('13,5');
  });

  it('ne montre rien pour la période quand `sensor:current_period` est indisponible', async () => {
    // La spec (§5.1) est explicite : la période devient *indisponible*
    // plutôt que fausse quand l'intégration ne peut pas la déterminer —
    // aucun repli ne doit se glisser à sa place.
    const hass = makeHass([
      {
        key: 'sensor:overall_average',
        entity_id: 'sensor.abc_moyenne_generale',
        device: 'dev_enfant',
        state: '13.5',
        attributes: { out_of: 20 },
      },
      {
        key: 'sensor:current_period',
        entity_id: 'sensor.abc_periode',
        device: 'dev_enfant',
        state: 'unavailable',
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['average'] },
      hass
    );
    const t = text(el);
    expect(t).not.toContain('Période');
    // Assertion positive : le reste de la carte s'affiche normalement.
    expect(t).toContain('13,5');
  });

  it('affiche le bulletin quand la section est explicitement choisie', async () => {
    const hass = makeHass([
      // `sensor:report_card` est optionnelle : au moins une des clés
      // `requiresAny` doit être résolue pour que la carte rende quoi que ce
      // soit, bulletin compris.
      {
        key: 'sensor:overall_average',
        entity_id: 'sensor.abc_moyenne_generale',
        device: 'dev_enfant',
        state: '13.5',
        attributes: { out_of: 20 },
      },
      {
        key: 'sensor:report_card',
        entity_id: 'sensor.abc_bulletin',
        device: 'dev_enfant',
        // L'état vaut le nombre de matières du bulletin.
        state: '2',
        // Forme confirmée sur `_report_attributes` : c'est `subjects[]` qui
        // porte les moyennes, et `comments` l'appréciation générale.
        attributes: {
          period: 'Trimestre 1',
          comments: ['Trimestre satisfaisant.'],
          subjects: [
            {
              name: 'Mathématiques',
              student_average: 14.5,
              class_average: 12.1,
              coefficient: 2,
              comments: ['Des progrès à confirmer.'],
            },
            { name: 'Anglais', student_average: 16 },
          ],
        },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['report_card'] },
      hass
    );
    const t = text(el);
    expect(t).toContain('Bulletin');
    // Les matières et leurs moyennes, et non le seul état du capteur — la
    // carte se contentait de ce dernier faute de connaître la forme.
    expect(t).toContain('Mathématiques');
    expect(t).toContain('14,5');
    expect(t).toContain('Anglais');
    expect(t).toContain('16');
    // L'appréciation générale et celle du professeur, telles qu'écrites.
    expect(t).toContain('Trimestre satisfaisant.');
    expect(t).toContain('Des progrès à confirmer.');
  });

  it('ne montre pas le bulletin dans les sections par défaut', async () => {
    const hass = makeHass([
      {
        key: 'sensor:overall_average',
        entity_id: 'sensor.abc_moyenne_generale',
        device: 'dev_enfant',
        state: '13.5',
        attributes: { out_of: 20 },
      },
      {
        key: 'sensor:report_card',
        entity_id: 'sensor.abc_bulletin',
        device: 'dev_enfant',
        state: 'Publié',
      },
    ]);
    // Aucune section précisée : `sectionsOf` retombe sur les trois valeurs
    // par défaut, qui n'incluent pas le bulletin.
    const el = await mountCard('carnet-scolaire-notes', { device_id: 'dev_enfant' }, hass);
    const t = text(el);
    expect(t).not.toContain('Bulletin');
    // Assertion positive : les sections par défaut restent bien rendues.
    expect(t).toContain('13,5');
  });

  it('nomme la ligne du motif « Dernière note » quand la matière est absente', async () => {
    // Régression : cette ligne retombait sur `notes.name` (« Notes »), le nom
    // de la carte — un libellé trompeur plutôt qu'un motif de note.
    const hass = makeHass([
      {
        key: 'sensor:latest_grade',
        entity_id: 'sensor.abc_derniere_note',
        device: 'dev_enfant',
        state: 'unknown',
        attributes: { status: 'Non rendu' },
      },
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: '0',
        attributes: { items: [] },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'] },
      hass
    );
    const t = text(el);
    expect(t).toContain('Dernière note');
    expect(t).toContain('Non rendu');
  });
});

describe('carte notes — la date des notes et le filtre par matière', () => {
  // Les deux notes de `grades` : Maths le 5 septembre 2026 (un samedi),
  // Anglais le 6 (un dimanche). `date` est une date SEULE, comme
  // l'intégration la publie.
  it('affiche la date de chaque note quand show_date est activé', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'], show_date: true },
      base()
    );
    const t = text(el);
    expect(t).toContain('samedi 5 septembre');
    expect(t).toContain('dimanche 6 septembre');
    // Le coefficient reste, la date s'y ajoute.
    expect(t).toContain('coef. 2');
  });

  it('n’affiche pas la date par défaut, pour ne rien changer aux cartes existantes', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'] },
      base()
    );
    const t = text(el);
    expect(t).toContain('14,5/20');
    expect(t).not.toContain('5 septembre');
  });

  it('date la note au jour écrit, même dans un fuseau à décalage négatif', async () => {
    const hass = base();
    hass.config = { time_zone: 'America/Martinique' };
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'], show_date: true },
      hass
    );
    const t = text(el);
    expect(t).toContain('samedi 5 septembre');
    expect(t).not.toContain('vendredi 4 septembre');
  });

  it('affiche l’intitulé du devoir et la moyenne de la classe sous chaque note', async () => {
    const hass = makeHass([
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: '1',
        attributes: {
          items: [
            {
              subject: 'Maths',
              value: 17,
              out_of: 20,
              coefficient: 2,
              date: '2026-09-05',
              class_average: 13.04,
              comment: 'Contrôle n° 1 (chapitre 1)',
            },
          ],
        },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'], show_date: true },
      hass
    );
    const t = text(el);
    expect(t).toContain('17/20');
    expect(t).toContain('Contrôle n° 1 (chapitre 1)');
    expect(t).toContain('Classe 13,04/20');
    // L'intitulé passe avant les faits chiffrés, sur sa propre ligne.
    const secondary = el.shadowRoot?.querySelector('.row .secondary')?.textContent ?? '';
    expect(secondary.trim()).toBe(
      'Contrôle n° 1 (chapitre 1)\ncoef. 2 · samedi 5 septembre · Classe 13,04/20'
    );
  });

  it('n’ajoute pas de ligne vide quand la note n’a ni intitulé ni moyenne de classe', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'] },
      base()
    );
    const secondary = el.shadowRoot?.querySelector('.row .secondary')?.textContent ?? '';
    expect(secondary.trim()).toBe('coef. 1');
  });

  it('ne montre que les matières choisies, dans les notes comme dans les moyennes', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      {
        device_id: 'dev_enfant',
        sections: ['average', 'latest', 'subjects'],
        subjects: ['Anglais'],
      },
      base()
    );
    const t = text(el);
    expect(t).toContain('Anglais');
    expect(t).toContain('12/20');
    expect(t).not.toContain('Maths');
    // La moyenne générale n'est pas une matière : le filtre ne la touche pas.
    expect(t).toContain('13,5');
  });

  it('compare les matières sans casse, sans accents ni espaces de bord', async () => {
    // PRONOTE écrit souvent les matières en capitales et avec accents :
    // personne ne devrait avoir à recopier « MATHÉMATIQUES » à l'identique.
    const hass = makeHass([
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: '2',
        attributes: {
          items: [
            { subject: 'MATHÉMATIQUES', value: 16, out_of: 20, date: '2026-09-11' },
            { subject: 'ANGLAIS LV1', value: 7, out_of: 10, date: '2026-09-15' },
          ],
        },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'], subjects: ['  mathematiques '] },
      hass
    );
    const t = text(el);
    expect(t).toContain('MATHÉMATIQUES');
    expect(t).not.toContain('ANGLAIS');
  });

  it('filtre aussi le bulletin', async () => {
    const hass = makeHass([
      {
        key: 'sensor:overall_average',
        entity_id: 'sensor.abc_moyenne_generale',
        device: 'dev_enfant',
        state: '13.5',
        attributes: { out_of: 20 },
      },
      {
        key: 'sensor:report_card',
        entity_id: 'sensor.abc_bulletin',
        device: 'dev_enfant',
        state: '2',
        attributes: {
          subjects: [
            { name: 'Mathématiques', student_average: 14.5 },
            { name: 'Anglais', student_average: 16 },
          ],
        },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['report_card'], subjects: ['anglais'] },
      hass
    );
    const t = text(el);
    expect(t).toContain('Anglais');
    expect(t).not.toContain('Mathématiques');
  });

  it('place la moyenne de la matière au-dessus de ses notes quand un filtre est actif', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest', 'subjects'], subjects: ['Maths'] },
      base()
    );
    const t = text(el);
    // 14,2 : la moyenne de l'élève ; 12,1 : celle de la classe ; 14,5 : la note.
    expect(t).toContain('14,5/20');
    expect(t.indexOf('12,1')).toBeGreaterThanOrEqual(0);
    expect(t.indexOf('14,2')).toBeLessThan(t.indexOf('14,5'));
    expect(t.indexOf('12,1')).toBeLessThan(t.indexOf('14,5'));
    // La moyenne est un en-tête, la note une ligne ordinaire.
    const entetes = [...(el.shadowRoot?.querySelectorAll('.row.entete') ?? [])];
    expect(entetes.map((r) => r.textContent?.includes('14,2'))).toEqual([true]);
  });

  it('range les notes sous l’en-tête de leur matière quand plusieurs matières sont filtrées', async () => {
    const hass = makeHass([
      {
        key: 'sensor:grades',
        entity_id: 'sensor.abc_notes',
        device: 'dev_enfant',
        state: '4',
        attributes: {
          // Chronologie entremêlée : Anglais, Maths, Anglais, Histoire.
          items: [
            { subject: 'Anglais', value: 11, out_of: 20, date: '2026-09-08' },
            { subject: 'Maths', value: 16, out_of: 20, date: '2026-09-07' },
            { subject: 'Anglais', value: 13, out_of: 20, date: '2026-09-06' },
            { subject: 'Histoire', value: 9, out_of: 20, date: '2026-09-05' },
          ],
        },
      },
      {
        key: 'sensor:averages',
        entity_id: 'sensor.abc_moyennes_par_matiere',
        device: 'dev_enfant',
        state: '2',
        attributes: {
          items: [
            { subject: 'Maths', student: 16, class_average: 12.5, out_of: 20 },
            { subject: 'Anglais', student: 12, class_average: 10.5, out_of: 20 },
          ],
        },
      },
    ]);
    const el = await mountCard(
      'carnet-scolaire-notes',
      {
        device_id: 'dev_enfant',
        sections: ['latest', 'subjects'],
        subjects: ['Maths', 'Anglais', 'Histoire'],
      },
      hass
    );
    const rows = [...(el.shadowRoot?.querySelectorAll('.row') ?? [])].map(
      (r) => `${r.classList.contains('entete') ? '# ' : ''}${r.querySelector('.trailing')?.textContent?.trim()}`
    );
    // Histoire n'a pas de moyenne publiée : sa note suit les groupes, sans en-tête.
    expect(rows).toEqual(['# 16/20', '16/20', '# 12/20', '11/20', '13/20', '9/20']);
    // Sous un en-tête, la date remplace la matière ; Histoire, sans en-tête,
    // garde la sienne.
    const primaries = [...(el.shadowRoot?.querySelectorAll('.row .primary') ?? [])].map((p) =>
      p.textContent?.trim()
    );
    expect(primaries).toEqual([
      'Maths',
      'lundi 7 septembre',
      'Anglais',
      'mardi 8 septembre',
      'dimanche 6 septembre',
      'Histoire',
    ]);
  });

  it('ne répète pas la date dans le détail quand elle remplace la matière', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      {
        device_id: 'dev_enfant',
        sections: ['latest', 'subjects'],
        subjects: ['Maths'],
        show_date: true,
      },
      base()
    );
    const note = [...(el.shadowRoot?.querySelectorAll('.row:not(.entete)') ?? [])].find((r) =>
      r.textContent?.includes('14,5/20')
    );
    expect(note?.querySelector('.primary')?.textContent?.trim()).toBe('samedi 5 septembre');
    expect(note?.querySelector('.secondary')?.textContent?.trim()).toBe('coef. 2');
  });

  it('ne pose aucun en-tête sur une carte sans filtre', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest', 'subjects'] },
      base()
    );
    expect(text(el)).toContain('14,2');
    expect(el.shadowRoot?.querySelectorAll('.row.entete').length).toBe(0);
  });

  it('garde les notes avant les moyennes sans filtre, pour ne rien changer aux cartes existantes', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest', 'subjects'] },
      base()
    );
    const t = text(el);
    expect(t).toContain('14,2');
    expect(t.indexOf('14,5')).toBeGreaterThanOrEqual(0);
    expect(t.indexOf('14,5')).toBeLessThan(t.indexOf('14,2'));
  });

  it('dit que le filtre écarte tout, plutôt que « aucune note »', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'], subjects: ['Physique'] },
      base()
    );
    const t = text(el);
    expect(t).toContain('Aucune note pour les matières choisies');
    expect(t).not.toContain('Aucune note pour cette période');
  });

  it('traite une liste de matières vide comme « toutes les matières »', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'], subjects: [] },
      base()
    );
    const t = text(el);
    expect(t).toContain('Maths');
    expect(t).toContain('Anglais');
  });

  it('propose les deux options dans l’éditeur', () => {
    const noms = SPEC.schema({ type: 'x' }).map((f) => f.name);
    expect(noms).toContain('show_date');
    expect(noms).toContain('subjects');
  });
});
