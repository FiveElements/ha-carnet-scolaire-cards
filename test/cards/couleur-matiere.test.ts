import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC as EDT } from '../../src/cards/emploi-du-temps';
import { SPEC as DEVOIRS, testClock } from '../../src/cards/devoirs';
import { SPEC as NOTES } from '../../src/cards/notes';
import { SPEC as PROCHAIN } from '../../src/cards/prochain-cours';
import { SPEC as EVALUATIONS } from '../../src/cards/evaluations';
import { makeHass } from '../fixtures/hass';
import { mountCard } from '../fixtures/mount';

/**
 * Le code couleur des matières, sur les trois familles qui en portent un.
 *
 * Ce fichier est transverse plutôt que rangé par carte, parce que la propriété
 * testée est transverse : la même couleur de matière doit se **résoudre** de
 * la même façon sur l'emploi du temps, les devoirs et les moyennes. Trois
 * tests dispersés dans trois fichiers auraient laissé la divergence passer.
 *
 * Le **placement** est transverse sur les cinq cartes montées ici : elles
 * bordent la ligne du même côté, avec la même variable CSS. Mais « la
 * gouttière à gauche, partout » n'est plus vrai du dépôt entier — la vue
 * journée, qui n'est pas montée dans ce fichier, pose son filet ENTRE l'heure
 * et la matière depuis la version 0.0.20. Elle n'appelle pas `listRow`, donc
 * aucun test d'ici ne la contraint, et ce commentaire a affirmé le contraire
 * pendant une version.
 *
 * Ce qui reste réellement partagé par les six, c'est la **résolution** : la
 * valeur passe partout par `subjectAccent` puis par la propriété
 * personnalisée `--pronote-subject-color`. C'est le filtrage qui est
 * l'invariant, pas le placement.
 *
 * Ce fichier a aussi porté l'exigence inverse pour les devoirs — un filet
 * séparateur posé APRES l'intitulé — et les tests qui l'affirmaient ont été
 * renversés plutôt que supprimés, pour que la trace de la décision reste
 * lisible.
 *
 * **Les couleurs de ces fixtures sont inventées**, comme toutes les valeurs du
 * dépôt. Un établissement réel choisit les siennes.
 *
 * Ce que ces tests ne peuvent pas vérifier : que l'intégration publie
 * réellement `background_color`. Elle le publie depuis sa version 0.0.13 —
 * mesuré sur une instance, 27 créneaux sur 27 et 12 devoirs sur 12, voir
 * `test/fixtures/FORMES.md` — mais aucun test de ce dépôt ne peut l'établir :
 * une fixture qui pose le champ prouve seulement que la carte le lit.
 *
 * D'où l'intérêt du test « sans couleur », qui n'est **plus** le cas réel
 * d'une installation sur ces deux paliers. Il l'est encore sur le prochain
 * cours et les évaluations, que l'intégration ne colore pas.
 */

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-emploi-du-temps': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
    'carnet-scolaire-devoirs': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
    'carnet-scolaire-notes': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
    'carnet-scolaire-prochain-cours': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
    'carnet-scolaire-evaluations': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
  }
}

beforeAll(() => {
  defineCard(EDT);
  defineCard(DEVOIRS);
  defineCard(NOTES);
  defineCard(PROCHAIN);
  defineCard(EVALUATIONS);
});

/**
 * L'horloge de la carte devoirs, figée au 11 septembre 2026.
 *
 * Sans elle, `isOverdue` comparait à `new Date()` alors que `deuxDevoirs()`
 * porte des échéances en dur : « le devoir d'histoire est à rendre, pas en
 * retard » était vrai le 10 septembre, jour où la CI est passée au vert, et
 * faux dès le 11. Le fichier est devenu rouge sur toutes les branches à une
 * date que personne n'avait choisie — une bombe à retardement, pas une
 * régression : ni la carte ni le test n'avaient changé.
 *
 * Le 11 est le SEUL jour qui rend vraies les deux phrases que le test mesure
 * sur ces échéances : maths (le 10) échu, histoire (le 11) pas encore.
 * Déplacer l'un des deux devoirs sans déplacer cette date annule la
 * distinction, et le test passerait alors en ne comparant plus rien.
 *
 * Posée à chaque test plutôt qu'une fois pour toutes : `testClock` est une
 * variable de MODULE, qu'un test peut écraser sans que le suivant le sache.
 * Les autres cartes de ce fichier n'en ont pas besoin — elles ne lisent pas
 * l'heure — mais la poser pour elles ne coûte rien et évite qu'un futur test
 * de devoirs, ajouté dans un autre `describe`, la retrouve absente.
 */
beforeEach(() => {
  testClock.now = '2026-09-11T12:00:00+02:00';
});

/** Les gouttières colorées d'une carte, dans l'ordre du rendu. */
const accents = (el: HTMLElement): (string | null)[] =>
  [...(el.shadowRoot?.querySelectorAll('.row.accented') ?? [])].map((row) =>
    row instanceof HTMLElement
      ? row.style.getPropertyValue('--pronote-subject-color').trim() || null
      : null
  );

/**
 * Le nombre de filets séparateurs encore rendus, tous placements confondus.
 *
 * Zéro partout, désormais : le filet pleine hauteur entre la matière et
 * l'énoncé a été annulé au profit de la gouttière. Ce compteur reste parce
 * qu'une classe CSS retirée de la feuille de styles mais toujours émise par
 * une carte ne se voit **pas** — l'élément est simplement invisible, et rien
 * ne le signale.
 */
const separateurs = (el: HTMLElement): number =>
  el.shadowRoot?.querySelectorAll('.filet-matiere').length ?? 0;

/**
 * La structure d'un bloc de devoir : les rangs du titre et de l'énoncé parmi
 * les enfants **directs** de la ligne, et où se trouve chaque partie. Rend -1
 * pour ce qui manque.
 *
 * On part de la ligne en bloc (`.row.empile`) et on lit ses `children` — donc
 * les éléments dans leur ordre réel. Une version antérieure de ce test lisait
 * `lastElementChild` : mesuré en déplaçant l'élément au mauvais endroit, les
 * treize tests du fichier passaient toujours, parce que `lastElementChild`
 * ignore les nœuds texte et rendait le même élément dans les deux ordres. Un
 * test de position qui ignore l'ordre réel ne teste aucune position.
 */
const structure = (
  el: HTMLElement
): {
  tete: number;
  enonce: number;
  primaireDansTete: boolean;
  finDansTete: boolean;
  enonceHorsTete: boolean;
} => {
  const ligne = el.shadowRoot?.querySelector('.row.empile');
  const enfants = [...(ligne?.children ?? [])];
  const rangDe = (classe: string): number => enfants.findIndex((n) => n.classList.contains(classe));
  const tete = ligne?.querySelector('.empile-tete');
  return {
    tete: rangDe('empile-tete'),
    enonce: rangDe('secondary'),
    // Nommés d'après ce qu'ils LISENT, pas d'après ce qu'on croit y trouver.
    // Ils s'appelaient `matiereDansTete` et `echeanceDansTete` : depuis que
    // la tête de ligne suit le regroupement, `.primary` porte l'échéance
    // quand le bloc est groupé par matière, et `.trailing` ne porte plus que
    // le retard. Un nom de lecteur qui promet un contenu fait croire à une
    // assertion qu'on n'a pas écrite.
    primaireDansTete: tete?.querySelector('.primary') != null,
    finDansTete: tete?.querySelector('.trailing') != null,
    // L'énoncé enfant DIRECT de la ligne, et non descendant du titre : c'est
    // ce qui lui donne toute la largeur de la carte.
    enonceHorsTete: tete?.querySelector('.secondary') == null,
  };
};

/** Le nombre de lignes qui ne réservent PAS de gouttière. */
const plainRows = (el: HTMLElement): number =>
  el.shadowRoot?.querySelectorAll('.row:not(.accented)').length ?? 0;

/** Un `hass` portant les seuls cours du jour. */
const withLessons = (lessons: unknown[]) =>
  makeHass([
    {
      key: 'sensor:lessons_today',
      entity_id: 'sensor.abc_cours_du_jour',
      device: 'dev_enfant',
      state: String(lessons.length),
      attributes: { lessons },
    },
  ]);

/** Deux devoirs : le premier coloré par le serveur, le second sans couleur. */
const deuxDevoirs = (): ReturnType<typeof makeHass> =>
  makeHass([
    {
      key: 'sensor:homework_todo',
      entity_id: 'sensor.abc_devoirs_a_faire',
      device: 'dev_enfant',
      state: '2',
      attributes: {
        items: [
          {
            subject: 'Maths',
            description_text: 'Exercices 3 à 7',
            due: '2026-09-10T00:00:00+02:00',
            background_color: '#1e88e5',
          },
          {
            subject: 'Histoire',
            description_text: 'Lire le chapitre 2',
            due: '2026-09-11T00:00:00+02:00',
          },
        ],
      },
    },
  ]);

const monter = async (): Promise<HTMLElement> =>
  mountCard('carnet-scolaire-devoirs', { device_id: 'dev_enfant', filter: 'todo' }, deuxDevoirs());

describe('code couleur des matières — emploi du temps', () => {
  it('reprend la couleur de chaque créneau', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', range: 'today' },
      withLessons([
        {
          subject: 'Maths',
          start: '2026-09-08T08:00:00+02:00',
          end: '2026-09-08T09:00:00+02:00',
          background_color: '#1e88e5',
        },
        {
          subject: 'Histoire',
          start: '2026-09-08T09:00:00+02:00',
          end: '2026-09-08T10:00:00+02:00',
          background_color: '#43a047',
        },
      ])
    );

    // Positif ET dans l'ordre : une assertion sur le seul nombre de
    // gouttières passerait même si les deux couleurs étaient échangées.
    expect(accents(el)).toEqual(['#1e88e5', '#43a047']);
  });

  it('réserve la gouttière sans la colorer quand le créneau n’a pas de couleur', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', range: 'today' },
      withLessons([
        {
          subject: 'Maths',
          start: '2026-09-08T08:00:00+02:00',
          end: '2026-09-08T09:00:00+02:00',
          background_color: '#1e88e5',
        },
        {
          subject: 'Permanence',
          start: '2026-09-08T09:00:00+02:00',
          end: '2026-09-08T10:00:00+02:00',
        },
      ])
    );

    // La propriété qui compte : les deux lignes portent la classe, donc le
    // même retrait. Une gouttière absente sur la seconde décalerait le texte
    // de trois pixels — ce qu'on lit comme un défaut d'affichage et non comme
    // une matière sans couleur.
    expect(accents(el)).toEqual(['#1e88e5', null]);
    expect(plainRows(el)).toBe(0);
  });

  it('ignore une couleur que le serveur n’a pas écrite en hexadécimal', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', range: 'today' },
      withLessons([
        {
          subject: 'Maths',
          start: '2026-09-08T08:00:00+02:00',
          end: '2026-09-08T09:00:00+02:00',
          // Une injection par point-virgule : la valeur est interpolée dans
          // un attribut `style`, et sans filtre elle ajouterait une propriété
          // CSS arbitraire à la règle de la ligne.
          background_color: '#fff; position: fixed; inset: 0',
        },
      ])
    );

    expect(accents(el)).toEqual([null]);
    // Et la ligne s'affiche quand même : refuser la couleur ne coûte rien
    // d'autre que la couleur.
    expect(el.shadowRoot?.textContent).toContain('Maths');
  });
});

describe('code couleur des matières — devoirs', () => {
  it('reprend la couleur de chaque devoir', async () => {
    const el = await monter();

    // La fixture porte un devoir coloré et un devoir sans couleur, dans cet
    // ordre. Le second réserve sa gouttière sans la peindre.
    expect(accents(el)).toEqual(['#1e88e5', null]);
    expect(el.shadowRoot?.textContent).toContain('Exercices 3 à 7');
  });

  /**
   * Le RENVERSEMENT n°1. Ce test affirmait l'inverse : « sépare l'intitulé de
   * l'énoncé par le filet », et vérifiait que le filet se rendait entre les
   * deux, dans cet ordre.
   *
   * Pourquoi il est renversé : mise en colonne à côté de la matière, la
   * largeur laissée à l'énoncé tombait à 132 pixels sur une carte de 420, et
   * l'énoncé EST ce que la carte a à dire — c'est le devoir à faire. Ce qui a
   * changé n'est pas l'argument du séparateur, qui tenait, c'est l'arbitrage
   * entre l'alignement de la colonne et la largeur du contenu.
   */
  it('titre le bloc par la matière et donne toute la largeur à l’énoncé', async () => {
    // Groupé par MATIÈRE ici, et non par échéance comme le reste du fichier.
    //
    // Ce test mesure OÙ les choses se placent : la tête du bloc, puis
    // l'énoncé hors de la tête, ce qui lui donne la largeur de la carte. Le
    // placement ne dépend pas du regroupement ; ce qui en dépend, c'est
    // quelle information atterrit où — voir `titreLigne` dans `devoirs.ts`.
    // Groupée par matière, la matière titre le BLOC et l'échéance titre la
    // LIGNE : redire la matière à chaque ligne la disait deux fois, vingt
    // fois sur vingt sur une instance.
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', filter: 'todo', group_by: 'subject' },
      deuxDevoirs()
    );

    const { tete, enonce, primaireDansTete, finDansTete, enonceHorsTete } = structure(el);
    // Les deux bornes d'abord : sans elles, deux -1 se compareraient
    // sereinement et le test passerait sur une ligne vide.
    expect(tete).toBeGreaterThanOrEqual(0);
    expect(enonce).toBeGreaterThanOrEqual(0);
    // L'ordre du DOM est l'ordre visuel : le titre, PUIS l'énoncé.
    expect(tete).toBeLessThan(enonce);
    // Le titre de ligne dans la tête, l'énoncé en dehors : c'est ce dernier
    // point qui lui donne la largeur de la carte.
    expect(primaireDansTete).toBe(true);
    expect(enonceHorsTete).toBe(true);
    // Groupée par matière, ce titre de ligne est l'échéance — et la matière
    // est dans l'intertitre, une seule fois pour le bloc.
    const teteTexte = el.shadowRoot?.querySelector('.row.empile .primary')?.textContent ?? '';
    expect(teteTexte).toContain('pour le');
    expect(teteTexte).not.toContain('Histoire');
    expect(el.shadowRoot?.querySelector('.title')?.textContent).toContain('Histoire');
    // La première ligne n'a PAS de fin : elle ne porterait qu'un retard, et
    // le devoir d'histoire est à rendre, pas en retard.
    expect(finDansTete).toBe(false);
    // Le placement de la fin, mesuré là où il y en a une : le devoir de
    // maths est échu. Elle doit être DANS la tête du bloc, pas après
    // l'énoncé.
    const fin = el.shadowRoot?.querySelector('.row.empile .trailing');
    expect(fin).not.toBeNull();
    expect(fin?.closest('.empile-tete')).not.toBeNull();
    // Et plus aucun filet séparateur nulle part.
    expect(separateurs(el)).toBe(0);
  });

  it('garde les retours à la ligne de l’énoncé', async () => {
    // `plainText()` pose de vrais retours dans l'énoncé : sans
    // `white-space: pre-line`, deux phrases se collent. La règle vit sur
    // `.row .secondary`, un sélecteur de DESCENDANT — le bloc a intercalé un
    // élément de titre entre la ligne et ses parties, et un sélecteur
    // d'enfant direct aurait été rompu par là sans un mot.
    const el = await monter();
    const enonce = el.shadowRoot?.querySelector('.row.empile > .secondary');
    expect(enonce).not.toBeNull();
    if (!(enonce instanceof HTMLElement)) throw new Error('énoncé absent');
    expect(globalThis.getComputedStyle(enonce).whiteSpace).toBe('pre-line');
  });

  /**
   * Le RENVERSEMENT n°2. Ce test affirmait « groupe les lignes d'un même jour
   * pour aligner leurs colonnes », et vérifiait l'enveloppe `.devoirs-groupe`
   * qui portait la sous-grille.
   *
   * Il n'y a plus de colonne de matière à aligner : la matière titre son
   * bloc. L'enveloppe n'avait plus d'autre raison d'être, et une enveloppe
   * sans raison finit par recevoir une règle CSS qu'on ne saura plus
   * expliquer. Le regroupement par jour, lui, RESTE — ce sont les intertitres
   * `.title`, que ce test vérifie donc à la place.
   */
  it('ne groupe plus les lignes d’un même jour dans une enveloppe', async () => {
    const el = await monter();

    expect(el.shadowRoot?.querySelectorAll('.devoirs-groupe').length).toBe(0);
    // Appariée à un positif : les deux lignes sont bien là, et les deux
    // intertitres de jour aussi — le regroupement n'a pas disparu avec
    // l'enveloppe, seule l'enveloppe a disparu.
    const lignes = [...(el.shadowRoot?.querySelectorAll('.row') ?? [])];
    expect(lignes).toHaveLength(2);
    expect(el.shadowRoot?.querySelectorAll('.title').length).toBe(2);
  });

  /**
   * Le RENVERSEMENT n°3. Ce test s'appelait « ne réserve aucune gouttière à
   * gauche » et c'était la contrepartie du filet séparateur : la ligne étant
   * un flux, il n'y avait rien à réserver.
   *
   * La gouttière est désormais le placement de toutes les cartes qui portent
   * une matière, devoirs comprises, et la réservation redevient nécessaire —
   * une ligne sans gouttière se décale de neuf pixels (bordure de trois plus
   * marge de six) par rapport à sa voisine colorée, ce qui se lit comme un
   * défaut d'affichage et non comme une matière sans couleur.
   */
  it('réserve la gouttière à gauche comme les cinq autres cartes', async () => {
    const el = await monter();

    // Aucune ligne hors gouttière : ni les devoirs, ni la ligne de prochaine
    // échéance, ni la bannière « en retard » quand elle est là.
    expect(plainRows(el)).toBe(0);
    expect(accents(el)).toEqual(['#1e88e5', null]);
  });
});

describe('code couleur des matières — moyennes par matière', () => {
  it('colore les moyennes et laisse les autres lignes alignées', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['average', 'subjects'] },
      makeHass([
        {
          key: 'sensor:overall_average',
          entity_id: 'sensor.abc_moyenne_generale',
          device: 'dev_enfant',
          state: '13.5',
          attributes: { out_of: 20 },
        },
        {
          key: 'sensor:averages',
          entity_id: 'sensor.abc_moyennes_par_matiere',
          device: 'dev_enfant',
          state: '2',
          attributes: {
            items: [
              { subject: 'Maths', student: 14.2, out_of: 20, background_color: '#1e88e5' },
              { subject: 'Histoire', student: 12, out_of: 20 },
            ],
          },
        },
      ])
    );

    // La ligne « Élève » d'abord — elle ne porte pas de matière et n'a donc
    // pas de couleur, mais elle réserve la gouttière : sans intertitre entre
    // les deux sections, un retrait différent se verrait immédiatement.
    expect(accents(el)).toEqual([null, '#1e88e5', null]);
    expect(plainRows(el)).toBe(0);
    expect(el.shadowRoot?.textContent).toContain('14,2');
  });
});

describe('code couleur des matières — la table de l’utilisateur', () => {
  /**
   * Le deuxième rang, et aujourd'hui le seul qui produise quelque chose :
   * l'intégration décode la couleur de matière et ne la publie sur aucune
   * entité. Sans cette table, toutes les gouttières du tableau de bord d'une
   * installation réelle sont transparentes.
   *
   * Une table par carte plutôt qu'un réglage global : chaque carte se
   * configure seule dans Home Assistant, et un réglage transverse n'aurait eu
   * nulle part où vivre — sauf dans une entité, ce qui aurait fait d'un choix
   * d'affichage une donnée de l'intégration.
   */
  const TABLE = { MATHEMATIQUES: '#1e88e5', 'histoire-geographie': '#43a047' };

  const COURS = [
    {
      subject: 'MATHEMATIQUES',
      start: '2026-09-08T08:00:00+02:00',
      end: '2026-09-08T09:00:00+02:00',
    },
    {
      subject: 'Histoire-Géographie',
      start: '2026-09-08T09:00:00+02:00',
      end: '2026-09-08T10:00:00+02:00',
    },
    {
      subject: 'Permanence',
      start: '2026-09-08T10:00:00+02:00',
      end: '2026-09-08T11:00:00+02:00',
    },
  ];

  it('colore l’emploi du temps depuis la table, sans casse ni accents', async () => {
    // Les deux directions sur une seule fixture : « MATHEMATIQUES » écrit en
    // capitales des deux côtés, et « histoire-geographie » sans accents dans
    // la table contre « Histoire-Géographie » côté serveur. Sans le repli des
    // accents, la seconde ligne reste grise SANS un mot — et rien ne
    // distinguerait « j'ai mal écrit la matière » de « cette matière n'a pas
    // de couleur ».
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', range: 'today', subject_colors: TABLE },
      withLessons(COURS)
    );
    expect(accents(el)).toEqual(['#1e88e5', '#43a047', null]);
  });

  it('colore aussi quand ce sont les ACCENTS qui sont dans la table', async () => {
    // Le repli marche dans les deux sens : une table écrite avec les accents
    // de PRONOTE contre un libellé que le serveur enverrait sans.
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      {
        device_id: 'dev_enfant',
        range: 'today',
        subject_colors: { 'Histoire-Géographie': '#43a047' },
      },
      withLessons([{ ...COURS[1], subject: 'HISTOIRE-GEOGRAPHIE' }])
    );
    expect(accents(el)).toEqual(['#43a047']);
  });

  it('laisse la couleur du serveur primer sur la table', async () => {
    // Le rang 1 gagne, et il doit gagner : le jour où l'intégration publiera
    // ses couleurs, la table de l'utilisateur ne doit pas les recouvrir. Elle
    // reste le repli des matières que le serveur ne colore pas — donc rien à
    // supprimer ce jour-là.
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', range: 'today', subject_colors: TABLE },
      withLessons([{ ...COURS[0], background_color: '#fb8c00' }])
    );
    expect(accents(el)).toEqual(['#fb8c00']);
  });

  it('filtre les couleurs de la table comme celles du serveur', async () => {
    // L'origine d'une valeur ne dit rien de son innocuité : une chaîne de
    // configuration atteint le même attribut `style`. « red » est un nom CSS
    // valide et se voit quand même refuser -- accepter une famille de
    // syntaxes prendrait tout l'analyseur CSS comme frontière de confiance.
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      {
        device_id: 'dev_enfant',
        range: 'today',
        subject_colors: { MATHEMATIQUES: 'red; position: fixed' },
      },
      withLessons([COURS[0]])
    );
    expect(accents(el)).toEqual([null]);
    expect(el.shadowRoot?.textContent).toContain('MATHEMATIQUES');
  });

  it('colore les devoirs depuis la table', async () => {
    const el = await mountCard(
      'carnet-scolaire-devoirs',
      { device_id: 'dev_enfant', filter: 'todo', subject_colors: TABLE },
      makeHass([
        {
          key: 'sensor:homework_todo',
          entity_id: 'sensor.abc_devoirs_a_faire',
          device: 'dev_enfant',
          state: '2',
          attributes: {
            items: [
              {
                subject: 'MATHEMATIQUES',
                description_text: 'Exercices 3 à 7',
                due: '2026-09-10T00:00:00+02:00',
              },
              {
                subject: 'Permanence',
                description_text: 'Rien',
                due: '2026-09-11T00:00:00+02:00',
              },
            ],
          },
        },
      ])
    );
    expect(accents(el)).toEqual(['#1e88e5', null]);
    expect(el.shadowRoot?.textContent).toContain('Exercices 3 à 7');
  });

  it('colore chaque note de la couleur de la moyenne de sa matière', async () => {
    // Le protocole ne donne aucune couleur aux notes : elles l'empruntent à la
    // moyenne, rapprochée par la matière sans casse ni accents. Une note dont
    // la matière n'a pas de moyenne publiée reste alignée, sans couleur.
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['latest'] },
      makeHass([
        {
          key: 'sensor:grades',
          entity_id: 'sensor.abc_notes',
          device: 'dev_enfant',
          state: '2',
          attributes: {
            items: [
              { subject: 'MATHÉMATIQUES', value: 15, out_of: 20, date: '2026-09-06' },
              { subject: 'Histoire', value: 11, out_of: 20, date: '2026-09-05' },
            ],
          },
        },
        {
          key: 'sensor:averages',
          entity_id: 'sensor.abc_moyennes_par_matiere',
          device: 'dev_enfant',
          state: '1',
          attributes: {
            items: [
              { subject: 'Mathematiques', student: 15, out_of: 20, background_color: '#1e88e5' },
            ],
          },
        },
      ])
    );
    expect(accents(el)).toEqual(['#1e88e5', null]);
    expect(el.shadowRoot?.textContent).toContain('15/20');
  });

  it('colore les moyennes par matière depuis la table', async () => {
    const el = await mountCard(
      'carnet-scolaire-notes',
      { device_id: 'dev_enfant', sections: ['subjects'], subject_colors: TABLE },
      makeHass([
        {
          key: 'sensor:averages',
          entity_id: 'sensor.abc_moyennes_par_matiere',
          device: 'dev_enfant',
          state: '2',
          attributes: {
            items: [
              { subject: 'MATHEMATIQUES', student: 14.5, out_of: 20 },
              { subject: 'Permanence', student: 12, out_of: 20 },
            ],
          },
        },
      ])
    );
    expect(accents(el)).toEqual(['#1e88e5', null]);
    expect(el.shadowRoot?.textContent).toContain('MATHEMATIQUES');
  });
});

/**
 * Les fixtures des trois blocs qui suivent, au niveau module. Déclarées ici
 * plutôt que réutilisées depuis le bloc de la table : celui-là garde les
 * siennes dans sa propre portée, et les hisser aurait élargi une portée pour
 * une commodité.
 */
const PALETTE = { MATHEMATIQUES: '#1e88e5', 'histoire-geographie': '#43a047' };

const UN_COURS = [
  {
    subject: 'MATHEMATIQUES',
    start: '2026-09-08T08:00:00+02:00',
    end: '2026-09-08T09:00:00+02:00',
  },
];

const prochain = (attributes: Record<string, unknown>): ReturnType<typeof makeHass> =>
  makeHass([
    {
      key: 'sensor:next_lesson',
      entity_id: 'sensor.abc_prochain_cours',
      device: 'dev_enfant',
      state: '2026-09-10T08:00:00+02:00',
      attributes,
    },
  ]);

const troisEvaluations = (): ReturnType<typeof makeHass> =>
  makeHass([
    {
      key: 'sensor:evaluations',
      entity_id: 'sensor.abc_evaluations',
      device: 'dev_enfant',
      state: '2',
      attributes: {
        items: [
          {
            subject: 'MATHEMATIQUES',
            name: 'Théorème de Pythagore',
            date: '2026-09-08T08:00:00+02:00',
            acquisitions: [{ name: 'Calculer une longueur', level: 'Bonne maîtrise' }],
          },
          {
            subject: 'Permanence',
            name: 'Sans matière connue',
            date: '2026-09-07T08:00:00+02:00',
          },
        ],
      },
    },
  ]);

/**
 * Le prochain cours ne montre qu'UNE matière, mais plusieurs lignes : la
 * salle, les professeurs, le réveil, la fin de journée, le prochain contrôle.
 * Aucune de celles-là n'est une matière, et toutes réservent pourtant la
 * gouttière — sinon la ligne de matière colorée serait décalée de trois pixels
 * par rapport à ses voisines, ce qui se lit comme un défaut d'affichage plutôt
 * que comme une absence de donnée.
 *
 * Les noms d'attributs viennent de la source de la carte et de la forme
 * mesurée sur instance : `classroom` et non `room`, et `teachers` est une
 * liste. Une première version de ces fixtures inventait `room: 'B12'` et
 * `teachers: 'M. X'` — le test l'a attrapé, ce qui est exactement ce qu'on
 * attend d'une fixture qui ne répète pas l'hypothèse du code.
 */
describe('code couleur des matières — prochain cours', () => {
  it('reprend la couleur publiée par le serveur', async () => {
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant' },
      prochain({ subject: 'Maths', classroom: 'B12', background_color: '#1e88e5' })
    );

    expect(accents(el)).toContain('#1e88e5');
    expect(el.shadowRoot?.textContent).toContain('Maths');
  });

  it('colore depuis la table, sans casse ni accents', async () => {
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant', subject_colors: PALETTE },
      prochain({ subject: 'mathematiques' })
    );

    expect(accents(el)).toContain('#1e88e5');
  });

  it('réserve la gouttière des lignes qui ne portent pas de matière', async () => {
    const el = await mountCard(
      'carnet-scolaire-prochain-cours',
      { device_id: 'dev_enfant', subject_colors: PALETTE },
      prochain({ subject: 'MATHEMATIQUES', classroom: 'B12', teachers: ['M. X'] })
    );

    // La matière colorée, puis la salle et les professeurs réservés : c'est
    // l'ordre qui prouve l'alignement, pas le simple décompte.
    expect(accents(el)).toEqual(['#1e88e5', null, null]);
    // Appariée à un positif : sans elle, un rendu entièrement cassé passerait.
    expect(plainRows(el)).toBe(0);
  });
});

describe('code couleur des matières — évaluations', () => {
  it('colore la matière et réserve la gouttière des compétences', async () => {
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant', subject_colors: PALETTE },
      troisEvaluations()
    );

    // Matière colorée, sa compétence réservée, puis la seconde matière sans
    // couleur : une compétence n'est pas une matière, mais elle doit rester
    // alignée sous la ligne qui l'est.
    expect(accents(el)).toEqual(['#1e88e5', null, null]);
    expect(el.shadowRoot?.textContent).toContain('Théorème de Pythagore');
  });

  it('reprend la couleur du serveur quand elle existe', async () => {
    const el = await mountCard(
      'carnet-scolaire-evaluations',
      { device_id: 'dev_enfant', show_acquisitions: false },
      makeHass([
        {
          key: 'sensor:evaluations',
          entity_id: 'sensor.abc_evaluations',
          device: 'dev_enfant',
          state: '1',
          attributes: {
            items: [
              {
                subject: 'Maths',
                name: 'Fractions',
                date: '2026-09-08T08:00:00+02:00',
                background_color: '#43a047',
              },
            ],
          },
        },
      ])
    );

    expect(accents(el)).toEqual(['#43a047']);
    expect(el.shadowRoot?.textContent).toContain('Fractions');
  });
});

describe('code couleur des matières — le dièse facultatif', () => {
  it('accepte une couleur écrite sans dièse et la rend avec', async () => {
    // Sans cette tolérance, une table écrite « 1e88e5 » laissait la ligne
    // grise SANS un mot : le navigateur ignore silencieusement une couleur
    // invalide dans un attribut `style`, et rien ne distinguait l'oubli du
    // dièse d'une matière sans couleur.
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', range: 'today', subject_colors: { MATHEMATIQUES: '1e88e5' } },
      withLessons(UN_COURS)
    );
    expect(accents(el)).toEqual(['#1e88e5']);
  });

  it('accepte aussi la forme courte sans dièse', async () => {
    const el = await mountCard(
      'carnet-scolaire-emploi-du-temps',
      { device_id: 'dev_enfant', range: 'today', subject_colors: { MATHEMATIQUES: 'f80' } },
      withLessons(UN_COURS)
    );
    expect(accents(el)).toEqual(['#f80']);
  });

  it('refuse toujours ce qui n’est pas de l’hexadécimal, dièse ou pas', async () => {
    // Les ancres tiennent : ce qui est refusé l'est parce que la LONGUEUR est
    // ancrée des deux côtés, et rendre le dièse facultatif n'y touche pas.
    const invalides = ['red', 'rgb(30,136,229)', '1e88e5 (bleu)', '#336699 (rouge)', 'abcd'];
    const rendus = await Promise.all(
      invalides.map(async (invalide) =>
        mountCard(
          'carnet-scolaire-emploi-du-temps',
          { device_id: 'dev_enfant', range: 'today', subject_colors: { MATHEMATIQUES: invalide } },
          withLessons(UN_COURS)
        )
      )
    );
    // Toutes les valeurs sont éprouvées avant d'assérer : une assertion posée
    // dans la boucle s'arrêterait à la première fautive et cacherait les
    // suivantes, ce qui transforme une correction en va-et-vient.
    expect(rendus.map((el) => accents(el))).toEqual(invalides.map(() => [null]));
  });
});
