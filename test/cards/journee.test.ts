import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineCard } from '../../src/core/registry';
import { SPEC, testClock } from '../../src/cards/journee';
import { makeHass } from '../fixtures/hass';
import { mountCard, text } from '../fixtures/mount';

declare global {
  interface HTMLElementTagNameMap {
    'carnet-scolaire-journee': HTMLElement & {
      setConfig(c: unknown): void;
      hass: unknown;
      readonly updateComplete: Promise<unknown>;
    };
  }
}

beforeAll(() => {
  defineCard(SPEC);
});

beforeEach(() => {
  testClock.now = undefined;
});

/**
 * Les cinq éléments du seuil d'acceptation, nommés par l'utilisateur : heure
 * de début ET de fin, filet de couleur, intitulé de matière, barré plus
 * pastille sur un cours annulé, zone repas. Ce fichier les couvre un par un,
 * puis les pièges.
 *
 * Toutes les valeurs sont synthétiques. Les matières inventées ne
 * correspondent à aucun établissement.
 */

/** Une journée à trou méridien : deux cours le matin, un l'après-midi. */
const JOURNEE = [
  {
    subject: 'Maths',
    start: '2026-09-09T08:00:00+02:00',
    end: '2026-09-09T09:00:00+02:00',
    classroom: '2.14',
  },
  {
    subject: 'Histoire',
    start: '2026-09-09T09:00:00+02:00',
    end: '2026-09-09T10:00:00+02:00',
  },
  {
    subject: 'Anglais',
    start: '2026-09-09T13:30:00+02:00',
    end: '2026-09-09T14:30:00+02:00',
  },
];

const jour = (lessons: unknown[], language = 'fr') =>
  makeHass(
    [
      {
        key: 'sensor:lessons_today',
        entity_id: 'sensor.abc_cours_du_jour',
        device: 'dev_enfant',
        state: String(lessons.length),
        attributes: { lessons },
      },
    ],
    language
  );

const monter = (config: Record<string, unknown>, lessons: unknown[] = JOURNEE) =>
  mountCard('carnet-scolaire-journee', { device_id: 'dev_enfant', ...config }, jour(lessons));

/** Les lignes de la grille, dans l'ordre du rendu. */
const lignes = (el: HTMLElement) =>
  [...(el.shadowRoot?.querySelectorAll('.jour-ligne') ?? [])].map((l) => {
    const filet = l.querySelector('.jour-filet');
    return {
      repas: l.classList.contains('jour-repas'),
      courant: l.classList.contains('jour-courant'),
      heures: [...l.querySelectorAll('.jour-heures span')].map((s) => s.textContent?.trim() ?? ''),
      // Les infobulles des deux horaires. Depuis le retrait du « ≈ », c'est
      // la SEULE trace qu'une heure de fin est calculée et non donnée : les
      // deux cas rendent désormais le même texte, et un test qui ne lirait
      // que `heures` ne distinguerait plus rien.
      infobulles: [...l.querySelectorAll('.jour-heures span')].map(
        (s) => s.getAttribute('title') ?? ''
      ),
      matiere: l.querySelector('.jour-matiere')?.textContent?.trim() ?? '',
      titreMatiere: l.querySelector('.jour-matiere')?.getAttribute('title') ?? '',
      barre: l.querySelector('.jour-matiere')?.classList.contains('canceled') ?? false,
      // La couleur telle que la carte la POSE : une propriété personnalisée,
      // la même que la gouttière des cinq autres cartes. La carte écrivait
      // auparavant un fond en style en ligne ; ce test lisait donc
      // `style.background`. Le rendu, lui, n'a pas changé — voir le test
      // « le filet peint la même couleur qu'avant ».
      couleur:
        filet instanceof HTMLElement
          ? filet.style.getPropertyValue('--pronote-subject-color').trim() || null
          : null,
      // Ce que le filet PEINT réellement, variables résolues. C'est la seule
      // lecture qui ne dépende pas du mécanisme employé pour y arriver.
      peint:
        filet instanceof HTMLElement ? globalThis.getComputedStyle(filet).background.trim() : '',
      // Le rang du filet parmi les enfants de la ligne. Sur cette carte il
      // SEPARE l'heure de la matière, donc il vient APRES les horaires — la
      // seule des six où la couleur n'est pas une gouttière.
      rangFilet: [...l.children].findIndex((n) => n.classList.contains('jour-filet')),
      rangHeures: [...l.children].findIndex((n) => n.classList.contains('jour-heures')),
      neutre: filet?.classList.contains('jour-filet-neutre') ?? false,
      pastilles: [...l.querySelectorAll('.chip')].map((c) => c.textContent?.trim() ?? ''),
      detail: l.querySelector('.jour-detail')?.textContent?.trim() ?? '',
    };
  });

/** L'en-tete : la date et les bornes de la journee. */
const entete = (el: HTMLElement) => {
  const e = el.shadowRoot?.querySelector('.jour-entete');
  return e
    ? {
        date: e.querySelector('.jour-date')?.textContent?.trim() ?? '',
        bornes: e.querySelector('.jour-bornes')?.textContent?.trim() ?? '',
        infobulle: e.querySelector('.jour-bornes')?.getAttribute('title') ?? '',
      }
    : undefined;
};

/** Un `hass` avec les bornes de journee publiees, comme l'integration le fait. */
const jourAvecBornes = (lessons: unknown[], first?: string, last?: string) =>
  makeHass([
    {
      key: 'sensor:lessons_today',
      entity_id: 'sensor.abc_cours_du_jour',
      device: 'dev_enfant',
      state: String(lessons.length),
      attributes: { lessons, first_start: first, last_end: last },
    },
  ]);

/* ---- La navigation d'un jour à l'autre ---------------------------------

   Toute la semaine collectée vit dans l'attribut `lessons` de
   `sensor:timetable_week` : changer de jour est un filtre sur une liste déjà
   en mémoire, jamais une collecte. Les fixtures ci-dessous le reproduisent.

   Les horaires sont tous en milieu de journée, délibérément : un créneau à
   23:00+02:00 changerait de jour civil selon le fuseau où tourne la suite de
   tests, et les tests mesureraient alors le fuseau de la machine. */

const cours = (
  jourDuMois: string,
  subject: string,
  from: string,
  to: string,
  extra: Record<string, unknown> = {}
) => ({
  subject,
  start: `2026-09-${jourDuMois}T${from}:00+02:00`,
  end: `2026-09-${jourDuMois}T${to}:00+02:00`,
  ...extra,
});

const LUNDI = [cours('07', 'Français', '08:00', '09:00')];
const MARDI = [
  cours('08', 'SVT', '10:00', '11:00'),
  // Fin déduite : l'en-tête d'un autre jour doit porter l'infobulle aussi.
  cours('08', 'Sport', '14:00', '16:00', { end_inferred: true }),
];
const JEUDI = [cours('10', 'Physique', '09:00', '10:00')];

/** Lundi 7 au jeudi 10 septembre 2026. Pas de vendredi : c'est la borne. */
const SEMAINE = [...LUNDI, ...MARDI, ...JOURNEE, ...JEUDI];

/**
 * Le `hass` de la semaine, extrait du montage.
 *
 * Separe pour qu'un test puisse en reposer un NOUVEAU sur une carte deja
 * montee : c'est ce que fait Home Assistant a chaque collecte, et c'est la
 * seule facon de mesurer ce qu'une carte laissee ouverte devient.
 */
const hassSemaine = (jourCourant: unknown[] = JOURNEE, semaine: unknown[] = SEMAINE) =>
  makeHass([
    {
      key: 'sensor:lessons_today',
      entity_id: 'sensor.abc_cours_du_jour',
      device: 'dev_enfant',
      state: String(jourCourant.length),
      attributes: { lessons: jourCourant },
    },
    {
      key: 'sensor:timetable_week',
      entity_id: 'sensor.abc_emploi_du_temps_de_la_semaine',
      device: 'dev_enfant',
      state: String(semaine.length),
      attributes: { lessons: semaine },
    },
  ]);

const monterSemaine = (
  config: Record<string, unknown> = {},
  jourCourant: unknown[] = JOURNEE,
  semaine: unknown[] = SEMAINE
) =>
  mountCard(
    'carnet-scolaire-journee',
    { device_id: 'dev_enfant', ...config },
    hassSemaine(jourCourant, semaine)
  );

const fleches = (el: HTMLElement) =>
  [...(el.shadowRoot?.querySelectorAll('.jour-fleche') ?? [])].map((b) => ({
    libelle: b.getAttribute('aria-label') ?? '',
    eteinte: b instanceof HTMLButtonElement ? b.disabled : false,
  }));

/**
 * Clique une flèche et attend le repeint.
 *
 * `click()` sur un bouton désactivé ne déclenche rien, par le navigateur
 * lui-même : un test qui clique une flèche éteinte et constate que rien n'a
 * bougé mesure donc bien le `disabled`, pas une coïncidence.
 */
type Carte = HTMLElementTagNameMap['carnet-scolaire-journee'];

const cliquer = async (el: Carte, index: number) => {
  const boutons = [...(el.shadowRoot?.querySelectorAll('.jour-fleche') ?? [])];
  const b = boutons[index];
  if (!(b instanceof HTMLButtonElement)) throw new Error(`flèche absente : ${index}`);
  b.click();
  await el.updateComplete;
};

const revenir = async (el: Carte) => {
  const b = el.shadowRoot?.querySelector('.jour-retour');
  if (!(b instanceof HTMLButtonElement)) throw new Error('bouton « aujourd’hui » absent');
  b.click();
  await el.updateComplete;
};

describe('carte vue journée — les cinq éléments requis', () => {
  it('affiche l’heure de début ET de fin, en colonne à deux lignes', async () => {
    const el = await monter({});
    const l = lignes(el);
    // Trois cours plus la zone repas.
    expect(l).toHaveLength(4);
    expect(l[0]?.heures).toEqual(['08:00', '09:00']);
    expect(l[1]?.heures).toEqual(['09:00', '10:00']);
  });

  it('affiche l’intitulé de matière', async () => {
    const el = await monter({});
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Maths', 'Histoire', 'Repas', 'Anglais']);
  });

  it('pose le filet à la couleur déclarée par l’utilisateur', async () => {
    // Le rang 2 de la couleur, et aujourd'hui le seul qui produise quelque
    // chose : l'intégration ne publie pas encore `background_color`.
    const el = await monter({ subject_colors: { maths: '#1e88e5' } });
    const l = lignes(el);
    // happy-dom rend la valeur telle qu'elle a été posée ; un navigateur la
    // normalise en `rgb(30, 136, 229)`, ce qui a été vérifié sur instance.
    // C'est la valeur POSÉE qu'on teste ici, pas la normalisation du moteur.
    expect(l[0]?.couleur).toBe('#1e88e5');
    expect(l[0]?.neutre).toBe(false);
    // Et la matière sans couleur déclarée garde l'accent neutre du thème.
    expect(l[1]?.couleur).toBeNull();
    expect(l[1]?.neutre).toBe(true);
  });

  it('pose le filet en SEPARATEUR, entre les horaires et la matière', async () => {
    // Ce test a affirmé l'inverse pendant une version, et le renversement est
    // celui du propriétaire, pas une correction de défaut. Il a demandé les
    // deux placements l'un après l'autre : d'abord « la gouttière à gauche,
    // partout », puis, en le voyant rendu, « la ligne de couleur doit séparer
    // l'heure et la matière ».
    //
    // Ce que la seconde version dit de plus, et qui vaut d'être gardé : sur
    // cette carte la colonne d'horaires se lit seule — « il est où, là ? » —
    // et un filet posé à sa gauche colorait l'heure autant que la matière,
    // alors que la couleur ne qualifie que la seconde. Entre les deux, il dit
    // à quoi la couleur appartient.
    //
    // L'uniformité des six cartes n'est donc pas totale, et c'est assumé. Ne
    // ramenez pas ce filet à gauche pour aligner les cartes entre elles : ça
    // a été fait, puis défait.
    const el = await monter({ subject_colors: { maths: '#1e88e5' } });
    const l = lignes(el);
    // Le rang, et non `firstElementChild` : celui-ci ignore les nœuds texte
    // et rendrait le même élément quel que soit l'ordre réel des deux
    // premiers enfants. C'est la correction d'un test creux mesuré la veille.
    expect(l[0]?.rangHeures).toBe(0);
    expect(l[0]?.rangFilet).toBe(1);
    // Sur toutes les lignes, la zone repas comprise : le filet du repas doit
    // suivre le même ordre, sinon les deux sortes de lignes ne s'alignent
    // plus dans les colonnes de la grille.
    expect(l.map((x) => x.rangHeures)).toEqual(l.map(() => 0));
    expect(l.map((x) => x.rangFilet)).toEqual(l.map(() => 1));
    // Appariée à un positif : les horaires sont bien rendus, la ligne n'est
    // pas vide.
    expect(l[0]?.heures).toEqual(['08:00', '09:00']);
  });

  it('peint la même couleur qu’avant le passage à la propriété personnalisée', async () => {
    // Le changement de mécanisme — un fond en style en ligne remplacé par la
    // variable `--pronote-subject-color` que les cinq autres cartes emploient
    // — devait être sans effet visuel. Mesuré, pas supposé : ce sont les
    // valeurs relevées AVANT la modification, variables résolues.
    //
    // Le vide des lignes sans couleur n'est pas un défaut du test : c'est
    // `var(--divider-color)` non résolue, faute de thème Home Assistant dans
    // happy-dom, et c'était déjà sa valeur avant.
    const el = await monter({ subject_colors: { maths: '#1e88e5' } });
    expect(lignes(el).map((x) => x.peint)).toEqual([
      '#1e88e5',
      '',
      'repeating-linear-gradient(to bottom, 0 4px, transparent 4px 8px)',
      '',
    ]);
  });

  it('préfère la couleur publiée par le serveur à celle de l’utilisateur', async () => {
    // Rang 1 devant rang 2 : le jour où l'intégration publie le champ, il
    // prend le dessus sans que la table de l'utilisateur soit à supprimer.
    const el = await monter({ subject_colors: { maths: '#000000' } }, [
      { ...JOURNEE[0], background_color: '#1e88e5' },
    ]);
    expect(lignes(el)[0]?.couleur).toBe('#1e88e5');
  });

  it('ignore une couleur déclarée qui n’est pas un hexadécimal strict', async () => {
    // Même filtre que pour la couleur du serveur : la valeur atteint un
    // attribut `style`, et une table de tableau de bord est du texte libre.
    const el = await monter({ subject_colors: { maths: 'red; position: fixed' } });
    const l = lignes(el);
    expect(l[0]?.couleur).toBeNull();
    expect(l[0]?.neutre).toBe(true);
    expect(l[0]?.matiere).toBe('Maths');
  });

  it('dit « dispensé » sur un cours dont l’élève est dispensé, et ne le surligne jamais', async () => {
    // L'intégration publie `exempted` sur chaque créneau et l'exclut déjà de
    // ses propres calculs (prochain cours, fin de journée) : la carte le
    // montrait comme un cours ordinaire, « en cours » compris.
    testClock.now = '2026-09-09T08:30:00+02:00';
    const el = await monter({}, [{ ...JOURNEE[0], exempted: true }, JOURNEE[1]]);
    const l = lignes(el);
    expect(l[0]?.pastilles).toContain('dispensé');
    expect(l[0]?.courant).toBe(false);
    expect(l[0]?.matiere).toBe('Maths');
    expect(l[1]?.pastilles).not.toContain('dispensé');
  });

  it('barre un cours annulé ET lui pose sa pastille', async () => {
    const el = await monter({}, [{ ...JOURNEE[0], canceled: true }]);
    const l = lignes(el);
    expect(l[0]?.barre).toBe(true);
    expect(l[0]?.pastilles).toContain('annulé');
    // Le cours reste visible : le retirer donnerait l'illusion qu'il n'a
    // jamais existé.
    expect(l[0]?.matiere).toBe('Maths');
  });

  it('reconnaît une annulation portée par le seul libellé de statut', async () => {
    const el = await monter({}, [{ ...JOURNEE[0], status: 'Cours annulé' }]);
    const l = lignes(el);
    expect(l[0]?.barre).toBe(true);
    // Et le libellé ne double PAS la pastille qu'il a déclenchée.
    expect(l[0]?.pastilles).toEqual(['annulé']);
  });

  it('rend le motif du serveur tel quel, sans le classer', async () => {
    const el = await monter({}, [{ ...JOURNEE[0], status: 'Prof. absent' }]);
    expect(lignes(el)[0]?.pastilles).toEqual(['Prof. absent']);
  });

  it('insère une zone repas dans le trou méridien', async () => {
    const el = await monter({});
    const repas = lignes(el).filter((x) => x.repas);
    expect(repas).toHaveLength(1);
    expect(repas[0]?.matiere).toBe('Repas');
    // Aux bornes du trou, pas à une heure inventée.
    expect(repas[0]?.heures).toEqual(['10:00', '13:30']);
  });
});

describe('carte vue journée — la zone repas ne raconte rien', () => {
  it('n’affirme rien de plus que « pas de cours ici »', async () => {
    const el = await monter({});
    // Aucun mot sur un menu, un plat ou la présence de l'élève : la carte ne
    // lit aucune entité de cantine et ne doit rien en laisser croire.
    const t = text(el).toLowerCase();
    expect(t).toContain('repas');
    expect(t).not.toContain('menu');
    expect(t).not.toContain('cantine');
  });

  it('accepte un libellé choisi par l’utilisateur', async () => {
    // Le mot est une convention assumée par l'utilisateur, pas une
    // affirmation du module — donc il doit pouvoir le changer.
    const el = await monter({ meal_label: 'Pause déjeuner' });
    expect(lignes(el).find((x) => x.repas)?.matiere).toBe('Pause déjeuner');
  });

  it('n’affiche rien sur un trou hors de la plage du midi', async () => {
    const el = await monter({}, [
      JOURNEE[0],
      // Trou de 09:00 à 11:00 : long, mais la plage par défaut commence à
      // 11:00 et le trou se termine pile à son début.
      { subject: 'Anglais', start: '2026-09-09T09:00:00+02:00', end: '2026-09-09T10:00:00+02:00' },
      { subject: 'Sport', start: '2026-09-09T11:00:00+02:00', end: '2026-09-09T12:00:00+02:00' },
    ]);
    expect(lignes(el).filter((x) => x.repas)).toHaveLength(0);
    // Assertion positive appariée : les trois cours sont bien là.
    expect(lignes(el)).toHaveLength(3);
  });

  it('n’affiche rien sur un trou de fin d’après-midi', async () => {
    // La borne HAUTE de la plage, que le test précédent ne couvre pas : il
    // vérifie un trou qui finit avant le début du midi, celui-ci un trou qui
    // commence après sa fin. Ce cas manquait, et une mutation l'a révélé —
    // supprimer la comparaison de borne haute laissait les 26 tests verts,
    // et le mot « Repas » serait apparu sur un trou de 15 h à 17 h.
    const el = await monter({}, [
      { subject: 'Maths', start: '2026-09-09T14:00:00+02:00', end: '2026-09-09T15:00:00+02:00' },
      { subject: 'Sport', start: '2026-09-09T17:00:00+02:00', end: '2026-09-09T18:00:00+02:00' },
    ]);
    expect(lignes(el).filter((x) => x.repas)).toHaveLength(0);
    expect(lignes(el)).toHaveLength(2);
  });

  it('n’affiche rien sur un trou trop court pour être un repas', async () => {
    const el = await monter({}, [
      { subject: 'Maths', start: '2026-09-09T11:00:00+02:00', end: '2026-09-09T12:00:00+02:00' },
      // Dix minutes : un changement de salle, pas un déjeuner.
      { subject: 'Histoire', start: '2026-09-09T12:10:00+02:00', end: '2026-09-09T13:10:00+02:00' },
    ]);
    expect(lignes(el).filter((x) => x.repas)).toHaveLength(0);
    expect(lignes(el)).toHaveLength(2);
  });

  it('suit une plage du midi configurée', async () => {
    // Trou de 09:00 à 10:30, hors plage par défaut, dans la plage configurée.
    const lessons = [
      { subject: 'Maths', start: '2026-09-09T08:00:00+02:00', end: '2026-09-09T09:00:00+02:00' },
      { subject: 'Histoire', start: '2026-09-09T10:30:00+02:00', end: '2026-09-09T11:30:00+02:00' },
    ];
    const sans = await monter({}, lessons);
    expect(lignes(sans).filter((x) => x.repas)).toHaveLength(0);

    const avec = await monter({ meal_from: '09:00', meal_to: '10:30' }, lessons);
    expect(lignes(avec).filter((x) => x.repas)).toHaveLength(1);
  });

  it('retombe sur la plage par défaut quand la configuration est illisible', async () => {
    // Une plage saisie à la main peut être n'importe quoi. Une valeur
    // invalide ne doit pas faire disparaître la zone repas : elle doit être
    // ignorée, et la plage par défaut reprendre.
    const el = await monter({ meal_from: 'midi', meal_to: '99:99' });
    expect(lignes(el).filter((x) => x.repas)).toHaveLength(1);
  });

  it('se désactive entièrement sur demande', async () => {
    const el = await monter({ show_meal: false });
    expect(lignes(el).filter((x) => x.repas)).toHaveLength(0);
    expect(lignes(el)).toHaveLength(3);
  });
});

describe('carte vue journée — l’heure de fin déduite', () => {
  /**
   * Le « ≈ » a été retiré de cette carte le 10 septembre 2026, sur demande du
   * propriétaire. La raison est celle-là même qui l'avait fait poser : sur
   * l'établissement de référence `end_inferred` vaut `true` sur **37 créneaux
   * sur 37**, donc le marqueur était sur chaque ligne de chaque journée. Un
   * signe que tout porte n'avertit plus — il décore.
   *
   * Ces tests ne mesurent donc plus un glyphe mais l'**infobulle**, qui n'a
   * jamais dépendu de lui. Et ils gagnent une exigence que le glyphe rendait
   * inutile : puisque les deux cas rendent maintenant le même texte, chacun
   * doit affirmer l'état de l'infobulle, sinon il ne distingue plus rien.
   */
  it('ne montre AUCUN marqueur sur une heure de fin que le serveur n’a pas fournie', async () => {
    const el = await monter({}, [{ ...JOURNEE[0], end_inferred: true }]);
    const l = lignes(el);
    expect(l[0]?.heures[0]).toBe('08:00');
    expect(l[0]?.heures[1]).toBe('09:00');
    expect(l[0]?.heures[1]).not.toContain('≈');
    // Appariement positif : l'absence du glyphe passerait aussi sur un rendu
    // cassé. L'infobulle prouve que la carte a bien VU le drapeau.
    expect(l[0]?.infobulles[1]).not.toBe('');
  });

  it('laisse l’infobulle vide sur une heure de fin envoyée par le serveur', async () => {
    // C'est ce test qui porte la distinction depuis le retrait du glyphe : le
    // texte des deux cas est identique, seule l'infobulle les sépare.
    const el = await monter({}, [{ ...JOURNEE[0], end_inferred: false }]);
    const l = lignes(el);
    expect(l[0]?.heures[1]).toBe('09:00');
    expect(l[0]?.infobulles[1]).toBe('');
  });

  it('signale la zone repas dont la borne gauche est une fin déduite', async () => {
    // La zone repas ne portait pas son seul marqueur sur l'horaire : son
    // libellé a une infobulle propre, qui survit donc telle quelle au retrait
    // du glyphe posé, lui, sur la borne gauche.
    const el = await monter({}, [{ ...JOURNEE[1], end_inferred: true }, JOURNEE[2]]);
    const repas = lignes(el).find((x) => x.repas);
    expect(repas?.heures[0]).toBe('10:00');
    expect(repas?.titreMatiere).not.toBe('');
  });

  it('laisse le libellé du repas sans infobulle quand la fin est ferme', async () => {
    const el = await monter({}, [{ ...JOURNEE[1], end_inferred: false }, JOURNEE[2]]);
    const repas = lignes(el).find((x) => x.repas);
    expect(repas?.titreMatiere).toBe('');
    // Appariement positif : la zone repas est bien là, seule l'infobulle manque.
    expect(repas?.heures[0]).toBe('10:00');
  });
});

describe('carte vue journée — le cours en cours', () => {
  it('met en avant le créneau qui contient l’instant courant', async () => {
    testClock.now = '2026-09-09T08:30:00+02:00';
    const el = await monter({});
    const l = lignes(el);
    expect(l[0]?.courant).toBe(true);
    expect(l[1]?.courant).toBe(false);
  });

  it('ne met rien en avant quand le capteur de cours dit « off »', async () => {
    // Droit de VETO : le capteur voit ce que l'attribut ne porte pas — jour
    // banalisé, cours déplacé après la collecte, élève dispensé.
    testClock.now = '2026-09-09T08:30:00+02:00';
    const hass = makeHass([
      {
        key: 'sensor:lessons_today',
        entity_id: 'sensor.abc_cours_du_jour',
        device: 'dev_enfant',
        state: '3',
        attributes: { lessons: JOURNEE },
      },
      {
        key: 'binary_sensor:in_class',
        entity_id: 'binary_sensor.abc_en_cours',
        device: 'dev_enfant',
        state: 'off',
      },
    ]);
    const el = await mountCard('carnet-scolaire-journee', { device_id: 'dev_enfant' }, hass);
    expect(lignes(el).filter((x) => x.courant)).toHaveLength(0);
    // Appariement positif : la journée s'affiche quand même.
    expect(lignes(el).length).toBeGreaterThan(0);
  });

  it('ne met jamais en avant un cours annulé', async () => {
    testClock.now = '2026-09-09T08:30:00+02:00';
    const el = await monter({}, [{ ...JOURNEE[0], canceled: true }]);
    expect(lignes(el)[0]?.courant).toBe(false);
    expect(lignes(el)[0]?.barre).toBe(true);
  });
});

describe('carte vue journée — le reste', () => {
  it('affiche la salle et sait la taire', async () => {
    expect(lignes(await monter({}))[0]?.detail).toBe('Salle 2.14');
    expect(lignes(await monter({ show_rooms: false }))[0]?.detail).toBe('');
  });

  it('dit « aucun cours » sur une journée vide, et non « indisponible »', async () => {
    const el = await monter({}, []);
    expect(text(el)).toContain("Aucun cours aujourd'hui");
    expect(lignes(el)).toHaveLength(0);
  });

  it('survit à un attribut lessons qui n’est pas un tableau', async () => {
    // Une exception dans `render` n'affiche pas un message : elle efface la
    // carte entière.
    const hass = makeHass([
      {
        key: 'sensor:lessons_today',
        entity_id: 'sensor.abc_cours_du_jour',
        device: 'dev_enfant',
        state: '1',
        attributes: { lessons: 'pas un tableau' },
      },
    ]);
    const el = await mountCard('carnet-scolaire-journee', { device_id: 'dev_enfant' }, hass);
    expect(text(el)).toContain("Aucun cours aujourd'hui");
  });

  it('trie les créneaux même reçus dans le désordre', async () => {
    const el = await monter({}, [JOURNEE[2], JOURNEE[0], JOURNEE[1]]);
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Maths', 'Histoire', 'Repas', 'Anglais']);
  });
});

describe('carte vue journée — la salle et le professeur', () => {
  it('affiche la salle puis le professeur, séparés d’un point médian', async () => {
    const el = await monter({}, [{ ...JOURNEE[0], teachers: ['MARTIN P.'] }]);
    // La salle d'abord : c'est ce qu'on cherche en marchant dans le couloir.
    expect(lignes(el)[0]?.detail).toBe('Salle 2.14 · MARTIN P.');
  });

  it('accepte `teachers` en chaîne autant qu’en tableau', async () => {
    // Les deux formes ont ete publiees selon les versions de l'integration.
    const tableau = await monter({}, [{ ...JOURNEE[0], teachers: ['A', 'B'] }]);
    expect(lignes(tableau)[0]?.detail).toBe('Salle 2.14 · A, B');
    const chaine = await monter({}, [{ ...JOURNEE[0], teachers: 'A. UNIQUE' }]);
    expect(lignes(chaine)[0]?.detail).toBe('Salle 2.14 · A. UNIQUE');
  });

  it('n’écrit pas de séparateur quand un seul des deux existe', async () => {
    // Le point median doit relier deux choses, pas pendre au bout d'une.
    const sansProf = await monter({}, [JOURNEE[0]]);
    expect(sansProf && lignes(sansProf)[0]?.detail).toBe('Salle 2.14');
    const sansSalle = await monter({}, [
      { subject: 'Maths', start: JOURNEE[0]?.start, end: JOURNEE[0]?.end, teachers: ['SEUL P.'] },
    ]);
    expect(lignes(sansSalle)[0]?.detail).toBe('SEUL P.');
  });

  it('sait taire le professeur sans taire la salle', async () => {
    const el = await monter({ show_teachers: false }, [{ ...JOURNEE[0], teachers: ['MARTIN P.'] }]);
    expect(lignes(el)[0]?.detail).toBe('Salle 2.14');
  });

  it('précède la salle de son mot, parce qu’un nombre seul ne dit pas ce qu’il est', async () => {
    // « 2.14 » voisine avec des horaires et un nom de professeur : il se lit
    // aussi bien comme une note. Ces tests ont attendu la valeur nue pendant
    // plusieurs versions et ont été renversés, pas supprimés — c'est une
    // décision du propriétaire, pas la correction d'un défaut.
    const el = await monter({}, [JOURNEE[0]]);
    expect(lignes(el)[0]?.detail).toBe('Salle 2.14');
  });

  it('n’ajoute pas le mot une seconde fois quand l’établissement l’écrit', async () => {
    // Le champ est du texte libre côté serveur. « Salle SALLE 204 » serait
    // plausible et faux. La troisième forme est accentuée : elle mesure la
    // décomposition `NFD`, qui place les lettres de base avant leur accent et
    // rend donc « Sallé 3 » reconnaissable. Ce commentaire a d'abord annoncé
    // qu'elle mesurait le retrait des marques combinantes — une mutation a
    // montré que non, et la ligne inutile a été retirée du code plutôt que le
    // commentaire laissé faux.
    const salles = ['SALLE 204', 'salle polyvalente', 'Sallé 3'];
    const rendus = await Promise.all(
      salles.map((salle) => monter({}, [{ ...JOURNEE[0], classroom: salle }]))
    );
    expect(rendus.map((el) => lignes(el)[0]?.detail)).toEqual(salles);
    // Appariement positif : une salle qui ne porte pas le mot le reçoit bien.
    const autre = await monter({}, [{ ...JOURNEE[0], classroom: 'B12' }]);
    expect(lignes(autre)[0]?.detail).toBe('Salle B12');
  });

  it('ne rend pas un mot tout seul quand la salle est vide', async () => {
    // Une salle vide ou faite d'espaces ne doit pas produire « Salle » sec.
    const vide = await monter({}, [{ ...JOURNEE[0], classroom: '   ' }]);
    expect(vide && lignes(vide)[0]?.detail).toBe('');
    // Appariement positif : la matiere reste rendue.
    expect(lignes(vide)[0]?.matiere).toBe('Maths');
  });

  it('traduit le mot au lieu de l’écrire en français partout', async () => {
    // Le mot vient du catalogue. Un `Salle` code en dur passerait les tests
    // francais et resterait francais pour tout le monde.
    const el = await mountCard(
      'carnet-scolaire-journee',
      { device_id: 'dev_enfant' },
      jour([JOURNEE[0]], 'it')
    );
    expect(lignes(el)[0]?.detail).toBe('Aula 2.14');
  });

  it('ne rend aucune ligne de détail quand les deux sont tus', async () => {
    const el = await monter({ show_rooms: false, show_teachers: false }, [
      { ...JOURNEE[0], teachers: ['MARTIN P.'] },
    ]);
    expect(lignes(el)[0]?.detail).toBe('');
    // Appariement positif : la matiere reste, seul le detail disparait.
    expect(lignes(el)[0]?.matiere).toBe('Maths');
  });
});

describe('carte vue journée — l’en-tête de journée', () => {
  it('affiche la date et les bornes publiées par l’intégration', async () => {
    const el = await mountCard(
      'carnet-scolaire-journee',
      { device_id: 'dev_enfant' },
      jourAvecBornes(JOURNEE, '2026-09-09T08:00:00+02:00', '2026-09-09T14:30:00+02:00')
    );
    const e = entete(el);
    expect(e?.date).toBe('mercredi 9 septembre');
    expect(e?.bornes).toBe('08:00 – 14:30');
  });

  it('signale par infobulle une fin de journée qui vient d’un calcul', async () => {
    // `last_end` est le `max` des fins de cours, et une fin de cours peut
    // etre deduite — sans que l'attribut le dise. La carte va chercher le
    // drapeau sur le creneau qui porte cette fin.
    const el = await mountCard(
      'carnet-scolaire-journee',
      { device_id: 'dev_enfant' },
      jourAvecBornes(
        [{ ...JOURNEE[0], end: '2026-09-09T09:00:00+02:00', end_inferred: true }],
        '2026-09-09T08:00:00+02:00',
        '2026-09-09T09:00:00+02:00'
      )
    );
    const e = entete(el);
    expect(e?.bornes).toBe('08:00 – 09:00');
    expect(e?.bornes).not.toContain('≈');
    // Seule l'infobulle distingue ce cas du suivant, où la borne est ferme.
    expect(e?.infobulle).not.toBe('');
  });

  it('ne marque pas la fin de journée quand le créneau qui la porte est ferme', async () => {
    // Un creneau deduit AILLEURS dans la journee ne doit pas contaminer la
    // borne : seul celui qui porte `last_end` compte.
    const el = await mountCard(
      'carnet-scolaire-journee',
      { device_id: 'dev_enfant' },
      jourAvecBornes(
        [
          { ...JOURNEE[0], end_inferred: true },
          { ...JOURNEE[1], end: '2026-09-09T10:00:00+02:00', end_inferred: false },
        ],
        '2026-09-09T08:00:00+02:00',
        '2026-09-09T10:00:00+02:00'
      )
    );
    expect(entete(el)?.bornes).toBe('08:00 – 10:00');
    expect(entete(el)?.infobulle).toBe('');
  });

  it('garde la date sur une journée vide', async () => {
    // C'est le moment ou l'en-tete sert le plus : « aucun cours » seul laisse
    // le doute sur le jour dont on parle.
    testClock.now = '2026-09-09T08:00:00+02:00';
    const el = await monter({}, []);
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    expect(text(el)).toContain("Aucun cours aujourd'hui");
  });

  it('ne rend pas de bornes quand l’intégration n’en publie pas', async () => {
    // Une integration plus ancienne peut ne pas porter ces attributs : la
    // date reste, les bornes disparaissent, et rien n'est invente.
    const el = await monter({});
    expect(entete(el)?.bornes).toBe('');
    expect(entete(el)?.date).not.toBe('');
  });

  it('se désactive entièrement sur demande', async () => {
    const el = await mountCard(
      'carnet-scolaire-journee',
      { device_id: 'dev_enfant', show_header: false },
      jourAvecBornes(JOURNEE, '2026-09-09T08:00:00+02:00', '2026-09-09T14:30:00+02:00')
    );
    expect(entete(el)).toBeUndefined();
    expect(lignes(el).length).toBeGreaterThan(0);
  });
});

describe('carte vue journée — la navigation d’un jour à l’autre', () => {
  beforeEach(() => {
    // Mercredi, en plein cours d'histoire.
    testClock.now = '2026-09-09T09:30:00+02:00';
  });

  it('n’affiche aucune flèche sans le capteur de semaine', async () => {
    // Sans lui il n'y a aucun autre jour en mémoire, et aller le chercher
    // coûterait une requête. Une flèche qui ne mène nulle part vaut moins que
    // pas de flèche.
    const el = await monter({});
    expect(fleches(el)).toHaveLength(0);
    // Assertion positive appariée : la carte rend bien sa journée par ailleurs.
    expect(lignes(el).length).toBeGreaterThan(0);
  });

  it('affiche deux flèches actives au milieu de la fenêtre collectée', async () => {
    const el = await monterSemaine();
    const f = fleches(el);
    expect(f).toHaveLength(2);
    expect(f.map((x) => x.eteinte)).toEqual([false, false]);
    expect(f[0]?.libelle).toBe('Jour précédent');
    expect(f[1]?.libelle).toBe('Jour suivant');
  });

  it('recule d’un jour et affiche la veille', async () => {
    const el = await monterSemaine();
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    await cliquer(el, 0);
    expect(entete(el)?.date).toBe('mardi 8 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['SVT', 'Repas', 'Sport']);
  });

  it('avance d’un jour et affiche le lendemain', async () => {
    const el = await monterSemaine();
    await cliquer(el, 1);
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Physique']);
  });

  it('recalcule les bornes de la journée pour un autre jour, infobulle comprise', async () => {
    // Rien n'est publié pour les autres jours : la carte reprend la formule de
    // l'intégration — min(début), max(fin) sur tous les créneaux — pour que
    // l'en-tête veuille dire la même chose d'un jour à l'autre. Et l'infobulle
    // suit le drapeau du créneau qui porte cette fin, les autres jours comme
    // aujourd'hui.
    const el = await monterSemaine();
    await cliquer(el, 0);
    expect(entete(el)?.bornes).toBe('10:00 – 16:00');
    expect(entete(el)?.infobulle).not.toBe('');
  });

  it('éteint la flèche du passé sur le premier jour collecté', async () => {
    testClock.now = '2026-09-07T09:00:00+02:00';
    const el = await monterSemaine({}, LUNDI);
    const f = fleches(el);
    expect(f[0]?.eteinte).toBe(true);
    expect(f[1]?.eteinte).toBe(false);
    // La flèche éteinte ne bouge rien : le navigateur ne délivre pas le clic.
    await cliquer(el, 0);
    expect(entete(el)?.date).toBe('lundi 7 septembre');
  });

  it('éteint la flèche du futur sur le dernier jour collecté', async () => {
    testClock.now = '2026-09-10T09:30:00+02:00';
    const el = await monterSemaine({}, JEUDI);
    const f = fleches(el);
    expect(f[0]?.eteinte).toBe(false);
    expect(f[1]?.eteinte).toBe(true);
  });

  it('atteint un jour SANS cours à l’intérieur de la fenêtre, et ne dit pas « aujourd’hui »', async () => {
    // « Aucun cours mercredi » est une information vraie et utile : le jour
    // vide n'est pas un trou à sauter. Mais « aucun cours AUJOURD'HUI » posé
    // au-dessus d'un mercredi qu'on n'est pas serait une affirmation fausse,
    // et c'est exactement le défaut que ce dépôt existe pour éviter.
    testClock.now = '2026-09-08T12:00:00+02:00';
    const el = await monterSemaine({}, MARDI, [...LUNDI, ...MARDI, ...JEUDI]);
    await cliquer(el, 1);
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    expect(text(el)).toContain('Aucun cours ce jour-là');
    expect(text(el)).not.toContain("aujourd'hui");
    expect(lignes(el)).toHaveLength(0);
  });

  it('saute au jour collecté le plus proche depuis un bord de fenêtre', async () => {
    // Dimanche, devant une semaine qui commence le mardi : avancer d'un jour
    // civil mènerait à un lundi hors fenêtre, donc à une flèche éteinte et à
    // un cul-de-sac — alors que deux jours sont en mémoire. Un lundi férié
    // produit exactement cette situation.
    testClock.now = '2026-09-06T12:00:00+02:00';
    const el = await monterSemaine({}, [], [...MARDI, ...JEUDI]);
    const f = fleches(el);
    expect(f[0]?.eteinte).toBe(true);
    expect(f[1]?.eteinte).toBe(false);
    await cliquer(el, 1);
    expect(entete(el)?.date).toBe('mardi 8 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['SVT', 'Repas', 'Sport']);
  });

  it('ne propose le retour à aujourd’hui que lorsqu’on n’y est plus', async () => {
    const el = await monterSemaine();
    expect(el.shadowRoot?.querySelector('.jour-retour')).toBeNull();
    await cliquer(el, 1);
    expect(el.shadowRoot?.querySelector('.jour-retour')).not.toBeNull();
    await revenir(el);
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    expect(el.shadowRoot?.querySelector('.jour-retour')).toBeNull();
  });

  it('ne met jamais un cours d’un autre jour « en cours »', async () => {
    // Les horodatages sont absolus : un créneau de jeudi ne peut pas contenir
    // l'instant présent. Le test fixe la propriété plutôt que de la déduire —
    // c'est elle qui garantit qu'on ne fera jamais croire à un parent que son
    // enfant est en physique un mercredi.
    const el = await monterSemaine();
    expect(lignes(el).filter((x) => x.courant)).toHaveLength(1);
    await cliquer(el, 1);
    expect(lignes(el).filter((x) => x.courant)).toHaveLength(0);
  });

  it('retombe sur aujourd’hui quand la configuration change', async () => {
    // La position consultée est un état d'interface, pas une donnée de la
    // carte : elle ne doit pas survivre à une carte qui n'est plus la même.
    const el = await monterSemaine();
    await cliquer(el, 1);
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
    el.setConfig({ type: 'custom:carnet-scolaire-journee', device_id: 'dev_enfant', show_meal: false });
    await el.updateComplete;
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
  });

  it('se désactive sur demande, sans emporter l’en-tête', async () => {
    const el = await monterSemaine({ show_nav: false });
    expect(fleches(el)).toHaveLength(0);
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
  });

  it('garde les flèches et la date quand l’en-tête est coupé, sans les bornes', async () => {
    // Naviguer sans voir quel jour on regarde n'aurait aucun sens : les deux
    // options répondent à des besoins différents, l'une allège, l'autre
    // déplace.
    const el = await monterSemaine({ show_header: false });
    expect(fleches(el)).toHaveLength(2);
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    expect(entete(el)?.bornes).toBe('');
    await cliquer(el, 1);
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
  });
});

/* ---- L'avance automatique au prochain jour de cours ---------------------

   Repères de la fenêtre collectée, tous utiles à la lecture des tests :
   lundi 7, mardi 8, mercredi 9 (le jour « aujourd'hui » des fixtures),
   jeudi 10. Pas de vendredi — c'est ce qui rend la borne mesurable.

   Le dernier cours du mercredi finit à 14:30, donc le seuil par défaut
   (trente minutes) tombe à 15:00. */

/** La semaine sans le mercredi : un jour sans cours au milieu. */
const SEMAINE_SANS_MERCREDI = [...LUNDI, ...MARDI, ...JEUDI];

describe('carte vue journée — l’avance au prochain jour de cours', () => {
  it('ne bouge pas sans l’option, même longtemps après la fin des cours', async () => {
    // Le point de départ, et la raison pour laquelle l'option est inactive par
    // défaut : une carte qui montre demain là où elle montrait aujourd'hui
    // change ce qu'elle affirme. Personne ne doit se le voir imposer par une
    // mise à jour.
    testClock.now = '2026-09-09T22:00:00+02:00';
    const el = await monterSemaine();
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    // Assertion positive appariée : c'est bien la journée du mercredi qui est
    // rendue, pas une carte vide qui porterait la bonne date par hasard.
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Maths', 'Histoire', 'Repas', 'Anglais']);
  });

  it('avance au jour suivant une fois le dernier cours fini plus le délai', async () => {
    testClock.now = '2026-09-09T15:30:00+02:00';
    const el = await monterSemaine({ auto_advance: true });
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Physique']);
  });

  it('n’avance pas avant l’échéance du délai', async () => {
    // 14:45, soit un quart d'heure après la fin des cours et un quart d'heure
    // avant le seuil. Les deux tests encadrent la bascule : un seul des deux
    // passerait si le délai était ignoré, et un seul si le délai était compté
    // depuis le début du dernier cours.
    testClock.now = '2026-09-09T14:45:00+02:00';
    const el = await monterSemaine({ auto_advance: true });
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Maths', 'Histoire', 'Repas', 'Anglais']);
  });

  it('respecte un délai configuré, de part et d’autre de son échéance', async () => {
    // Deux heures : le seuil passe de 15:00 à 16:30. Le même instant change de
    // verdict selon la configuration, ce qui mesure le délai lui-même et pas
    // seulement l'existence d'un seuil.
    testClock.now = '2026-09-09T15:30:00+02:00';
    const avant = await monterSemaine({ auto_advance: true, auto_advance_after: 120 });
    expect(entete(avant)?.date).toBe('mercredi 9 septembre');

    testClock.now = '2026-09-09T16:45:00+02:00';
    const apres = await monterSemaine({ auto_advance: true, auto_advance_after: 120 });
    expect(entete(apres)?.date).toBe('jeudi 10 septembre');
  });

  it('avance à la sonnerie quand le délai est zéro', async () => {
    // Zéro doit être accepté comme une valeur, pas confondu avec « non
    // renseigné » : un `||` à la place du `??` dans la lecture de l'option
    // ferait retomber ce cas sur trente minutes, et le test le dirait.
    testClock.now = '2026-09-09T14:31:00+02:00';
    const el = await monterSemaine({ auto_advance: true, auto_advance_after: 0 });
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
  });

  it('retombe sur trente minutes quand le délai n’est pas un nombre', async () => {
    // Le champ vient d'un YAML écrit à la main. Ce test ne vérifie pas
    // l'absence de plantage — il vérifie que le repli est bien le DÉFAUT et
    // non zéro : à 14:45 la carte ne bouge pas, à 15:30 elle bouge.
    testClock.now = '2026-09-09T14:45:00+02:00';
    const tot = await monterSemaine({ auto_advance: true, auto_advance_after: 'plus tard' });
    expect(entete(tot)?.date).toBe('mercredi 9 septembre');

    testClock.now = '2026-09-09T15:30:00+02:00';
    const tard = await monterSemaine({ auto_advance: true, auto_advance_after: 'plus tard' });
    expect(entete(tard)?.date).toBe('jeudi 10 septembre');
  });

  it('accepte un délai écrit comme une chaîne de chiffres', async () => {
    // `ha-form` rend un nombre, un YAML écrit à la main rend ce qu'on y a mis.
    // Refuser '120' là où 120 passe serait une distinction que personne ne
    // peut voir dans un éditeur de texte.
    testClock.now = '2026-09-09T15:30:00+02:00';
    const el = await monterSemaine({ auto_advance: true, auto_advance_after: '120' });
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
  });

  it('traverse un jour sans cours au lieu d’attendre une fin qui n’existe pas', async () => {
    // Mercredi matin, mais le mercredi n'a aucun cours. Il n'y a pas de
    // dernier cours dont attendre la fin : la carte passe au prochain jour de
    // cours. C'est la conséquence à connaître avant d'activer l'option — au
    // repos, « aucun cours ce jour-là » ne se verra plus.
    testClock.now = '2026-09-09T09:00:00+02:00';
    const el = await monterSemaine({ auto_advance: true }, [], SEMAINE_SANS_MERCREDI);
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Physique']);
  });

  it('reste sur le dernier jour collecté plutôt que de sauter dans le vide', async () => {
    // Jeudi soir : le jeudi est le dernier jour de la fenêtre, il n'y a pas de
    // vendredi. Sauter quand même afficherait « aucun cours ce jour-là » pour
    // une date dont la carte ne sait RIEN — la seule affirmation fausse que
    // cette carte puisse produire. Elle reste donc sur le jeudi.
    testClock.now = '2026-09-10T20:00:00+02:00';
    const el = await monterSemaine({ auto_advance: true }, JEUDI);
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Physique']);
  });

  it('ne fait rien sans le capteur de semaine', async () => {
    // Même raison que les flèches : le prochain jour de cours se lit dans la
    // semaine déjà collectée, et il n'y a aucune requête à sa disposition pour
    // aller le chercher.
    testClock.now = '2026-09-09T22:00:00+02:00';
    const el = await monter({ auto_advance: true });
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Maths', 'Histoire', 'Repas', 'Anglais']);
  });

  it('avance tout seul sur un tableau de bord laissé ouvert', async () => {
    // La demande porte explicitement là-dessus : « avec une mise à jour même
    // si le dashboard est resté ouvert ». Personne ne touche à rien, aucun
    // état d'entité ne change — seule l'horloge avance, et c'est la minuterie
    // déclarative de la carte (tickMs) qui provoque le repeint.
    vi.useFakeTimers();
    try {
      testClock.now = '2026-09-09T14:45:00+02:00';
      const el = await monterSemaine({ auto_advance: true });
      expect(entete(el)?.date).toBe('mercredi 9 septembre');

      testClock.now = '2026-09-09T15:30:00+02:00';
      vi.advanceTimersByTime(60_000);
      await el.updateComplete;

      expect(entete(el)?.date).toBe('jeudi 10 septembre');
      expect(lignes(el).map((x) => x.matiere)).toEqual(['Physique']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('laisse les flèches compter depuis le jour de repos', async () => {
    // Le piège que cette carte a évité de justesse : `cursor` est un décalage
    // depuis le jour de REPOS, pas depuis aujourd'hui. Avec `todayKey` comme
    // origine, la flèche « précédent » depuis le jeudi aurait posé un curseur
    // nul, donc le jour de repos — le jeudi — et le mercredi aurait été
    // inatteignable.
    testClock.now = '2026-09-09T15:30:00+02:00';
    const el = await monterSemaine({ auto_advance: true });
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
    await cliquer(el, 0);
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Maths', 'Histoire', 'Repas', 'Anglais']);
  });

  it('nomme le bouton de retour d’après le jour où il ramène', async () => {
    // « Aujourd'hui » au-dessus d'un bouton qui ramène à demain serait une
    // affirmation fausse de plus. Le libellé suit le jour de repos.
    testClock.now = '2026-09-09T15:30:00+02:00';
    const el = await monterSemaine({ auto_advance: true });
    await cliquer(el, 0);
    const retour = el.shadowRoot?.querySelector('.jour-retour');
    expect(retour?.textContent?.trim()).toBe('Prochain jour de cours');
    await revenir(el);
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
  });

  it('dit « Aujourd’hui » quand le jour de repos est bien aujourd’hui', async () => {
    // L'autre moitié du test précédent : sans avance, le libellé ne change
    // pas. Sans lui, un libellé figé sur « Prochain jour de cours » passerait.
    testClock.now = '2026-09-09T09:30:00+02:00';
    const el = await monterSemaine({ auto_advance: true });
    await cliquer(el, 0);
    const retour = el.shadowRoot?.querySelector('.jour-retour');
    expect(retour?.textContent?.trim()).toBe("Aujourd'hui");
  });

  it('affiche la date même quand l’en-tête et les flèches sont coupés', async () => {
    // Le cas plausible ET faux : des créneaux de demain sans rien au-dessus se
    // lisent comme ceux d'aujourd'hui. L'avance automatique rend ce cas
    // atteignable sans que personne ait cliqué — donc sans que personne sache
    // qu'il faut se méfier. La date redevient obligatoire.
    testClock.now = '2026-09-09T15:30:00+02:00';
    const el = await monterSemaine({
      auto_advance: true,
      show_header: false,
      show_nav: false,
    });
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
    // Les bornes restent coupées : `show_header` garde son sens.
    expect(entete(el)?.bornes).toBe('');
  });

  it('ramène un curseur qui a dérivé hors de la fenêtre collectée', async () => {
    // Le défaut que l'audit a nommé, et il n'a rien à voir avec l'option.
    // `cursor` est un décalage : à minuit, le jour de repos bouge sous lui.
    // Poussé au-delà du dernier jour collecté, il faisait afficher « aucun
    // cours ce jour-là » pour un vendredi dont la carte ne sait rien. La
    // flèche était bornée par `stepTo`, le curseur ne l'était pas.
    vi.useFakeTimers();
    try {
      testClock.now = '2026-09-09T09:30:00+02:00';
      const el = await monterSemaine();
      await cliquer(el, 1);
      expect(entete(el)?.date).toBe('jeudi 10 septembre');

      // Minuit passe. Le curseur vaut toujours +1, mais il désigne maintenant
      // le vendredi. L'intégration, elle, a collecté la journée du jeudi comme
      // elle le fait chaque nuit : le capteur du jour porte le jeudi.
      testClock.now = '2026-09-10T00:30:00+02:00';
      el.hass = hassSemaine(JEUDI, SEMAINE);
      vi.advanceTimersByTime(60_000);
      await el.updateComplete;

      expect(entete(el)?.date).toBe('jeudi 10 septembre');
      expect(text(el)).not.toContain('Aucun cours');
      expect(lignes(el).map((x) => x.matiere)).toEqual(['Physique']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('carte vue journée — day_offset, la fenêtre glissante', () => {
  /**
   * Demandé par le propriétaire le 10 septembre 2026 : plusieurs cartes côte
   * à côte, chacune sur son jour. Le curseur ne peut pas servir ça — il est
   * par instance et remis à zéro à chaque `setConfig` — donc l'origine de la
   * carte devient une option.
   *
   * La composition mesurée ici est : jour de repos, puis `day_offset`, puis le
   * curseur. Tous ces cas sont un mercredi 9, avec la semaine du lundi 7 au
   * jeudi 10 en mémoire.
   */
  beforeEach(() => {
    testClock.now = '2026-09-09T09:30:00+02:00';
  });

  it('affiche aujourd’hui sans l’option, et le même jour avec zéro', async () => {
    // La compatibilité est la première exigence : aucune configuration
    // existante ne doit bouger. Les deux montages doivent donc être
    // indiscernables.
    expect(entete(await monterSemaine())?.date).toBe('mercredi 9 septembre');
    expect(entete(await monterSemaine({ day_offset: 0 }))?.date).toBe('mercredi 9 septembre');
  });

  it('affiche le lendemain avec 1, et ses cours à lui', async () => {
    const el = await monterSemaine({ day_offset: 1 });
    expect(entete(el)?.date).toBe('jeudi 10 septembre');
    // Appariement positif : une date juste au-dessus des cours de la veille
    // serait plausible ET fausse, ce qui est le défaut que ce dépôt traque.
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Physique']);
  });

  it('affiche la veille avec -1', async () => {
    const el = await monterSemaine({ day_offset: -1 });
    expect(entete(el)?.date).toBe('mardi 8 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['SVT', 'Repas', 'Sport']);
  });

  it('laisse deux cartes du même tableau de bord indépendantes', async () => {
    // C'est l'objectif : aujourd'hui, demain et après-demain sur la même vue.
    // Deux instances partagent le même `hass` et ne doivent pas partager leur
    // jour.
    const aujourdhui = await monterSemaine({ day_offset: 0 });
    const demain = await monterSemaine({ day_offset: 1 });
    expect(entete(aujourdhui)?.date).toBe('mercredi 9 septembre');
    expect(entete(demain)?.date).toBe('jeudi 10 septembre');
    // Et naviguer dans l'une ne déplace pas l'autre.
    await cliquer(demain, 0);
    expect(entete(demain)?.date).toBe('mercredi 9 septembre');
    expect(entete(aujourdhui)?.date).toBe('mercredi 9 septembre');
  });

  it('fait partir les flèches du jour calculé et non d’aujourd’hui', async () => {
    // Le discriminant : depuis une carte « demain » (jeudi 10), reculer mène
    // à mercredi. Si les flèches partaient d'aujourd'hui, elles mèneraient à
    // mardi — et `day_offset` serait annulé au premier clic.
    const el = await monterSemaine({ day_offset: 1 });
    await cliquer(el, 0);
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Maths', 'Histoire', 'Repas', 'Anglais']);
  });

  it('ramène au jour de la carte, pas à aujourd’hui', async () => {
    const el = await monterSemaine({ day_offset: -1 });
    await cliquer(el, 1);
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    await revenir(el);
    expect(entete(el)?.date).toBe('mardi 8 septembre');
  });

  it('nomme le bouton de retour d’après l’origine de la carte', async () => {
    // « Aujourd'hui » sur une carte qui ramène à mardi serait faux, et
    // « Prochain jour de cours » ne décrit que l'avance automatique.
    const el = await monterSemaine({ day_offset: -1 });
    await cliquer(el, 1);
    expect(el.shadowRoot?.querySelector('.jour-retour')?.textContent?.trim()).toBe(
      'Jour de la carte'
    );
  });

  it('dit que le jour n’est pas collecté plutôt qu’il est sans cours', async () => {
    // La seule affirmation fausse que cette carte puisse produire, et une
    // option qui désigne un jour à la main est le chemin le plus court pour
    // l'atteindre : samedi 12 est hors de la semaine collectée, donc la carte
    // ne sait RIEN de ce jour-là.
    const el = await monterSemaine({ day_offset: 3 });
    expect(text(el)).toContain("Ce jour n'est pas dans la semaine collectée");
    expect(text(el)).not.toContain('Aucun cours ce jour-là');
    // L'en-tête reste, et il porte la date demandée : la phrase dit DE QUEL
    // jour on n'a rien. Sans elle, elle serait vraie et inutilisable.
    expect(entete(el)?.date).toBe('samedi 12 septembre');
  });

  it('dit la même chose quand le capteur de semaine n’est pas là', async () => {
    // Sans la semaine, aucun jour autre qu'aujourd'hui n'est en mémoire. Un
    // décalage n'a alors rien à afficher, et surtout rien à affirmer.
    const el = await monter({ day_offset: 1 });
    expect(text(el)).toContain("Ce jour n'est pas dans la semaine collectée");
    expect(text(el)).not.toContain('Aucun cours');
  });

  it('tronque une valeur fractionnaire au lieu de produire une date invalide', async () => {
    // Le champ vient d'un YAML écrit à la main. `1.7` jour n'existe pas ;
    // propagé dans un calcul de date il donnerait un libellé faux.
    expect(entete(await monterSemaine({ day_offset: 1.7 }))?.date).toBe('jeudi 10 septembre');
  });

  it('retombe sur aujourd’hui quand la valeur n’est pas un nombre', async () => {
    expect(entete(await monterSemaine({ day_offset: 'demain' }))?.date).toBe(
      'mercredi 9 septembre'
    );
    expect(entete(await monterSemaine({ day_offset: null }))?.date).toBe('mercredi 9 septembre');
  });

  it('se compose avec l’avance automatique, en glissant AVEC elle', async () => {
    // 22 h le mercredi : le dernier cours est fini depuis longtemps, donc le
    // jour de repos a avancé au jeudi. Une carte à `-1` montre alors le
    // mercredi — aujourd'hui — et pas mardi.
    //
    // C'est ce que « depuis le jour de repos » achète : la fenêtre glisse
    // avec le saut, au lieu qu'une carte saute et que les autres restent.
    testClock.now = '2026-09-09T22:00:00+02:00';
    const el = await monterSemaine({ auto_advance: true, day_offset: -1 });
    expect(entete(el)?.date).toBe('mercredi 9 septembre');
    // Et c'est bien le capteur du JOUR qui la sert, pas la semaine : la
    // condition porte sur le jour affiché, pas sur le curseur.
    expect(lignes(el).map((x) => x.matiere)).toEqual(['Maths', 'Histoire', 'Repas', 'Anglais']);
  });
});
