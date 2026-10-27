import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string, exts: string[]): string[] => {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
};

const read = (files: string[]) => files.map((f) => [f, readFileSync(f, 'utf8')] as const);

// Les fichiers de la racine sont publiés au même titre que docs/ : ce sont
// les deux premières pages qu'un visiteur lit sur GitHub, et elles sont
// restées hors du radar des gardes jusqu'ici — c'est CONTRIBUTING.md qui a
// publié une affirmation de sécurité fausse sans qu'aucun test bronche.
const ROOT_DOCS = ['README.md', 'CONTRIBUTING.md', 'CLAUDE.md'];

// Le contenu publié couvert par les gardes ci-dessous : code, tests, docs,
// gabarits GitHub et pages de la racine. `superpowers/` est exclu — c'est le
// plan et la spécification eux-mêmes, qui nomment légitimement les interdits
// pour les interdire.
const published = () =>
  read([
    ...walk('src', ['.ts', '.json']),
    ...walk('docs', ['.md']),
    ...walk('.github', ['.yml', '.md']),
    ...ROOT_DOCS,
  ]).filter(([f]) => !f.includes('superpowers'));

/**
 * Les appels de service autorisés ont la forme `domaine.service`, que la
 * règle `HARDCODED` de la garde ci-dessous ne sait pas distinguer d'un
 * identifiant d'entité. Ce sont
 * pourtant deux choses opposées : un identifiant d'entité varie d'une
 * installation à l'autre — c'est tout l'objet de cette garde — alors qu'un
 * nom de service est fixe et fait partie du contrat de Home Assistant.
 *
 * On les retire donc du texte avant de chercher, plutôt que de contorsionner
 * le code appelant pour esquiver la règle : une garde qui force à écrire
 * `'todo.' + 'update_item'` ne protège plus rien, elle déplace le problème là
 * où plus personne ne le lit. La liste reste volontairement fermée et
 * identique à `AllowedCall` (src/core/types.ts) : tout autre couple
 * `domaine.service` continue d'être signalé.
 */
const withoutAllowedCalls = (body: string): string =>
  ALLOWED_CALLS.reduce((acc, call) => acc.split(call).join(''), body);

describe("garde : aucun identifiant d'entité en dur", () => {
  /**
   * La liste des domaines est volontairement large, et non limitée à ceux que
   * `carnet_scolaire` crée aujourd'hui. Une liste fermée sur six domaines laissait
   * passer `switch.quelque_chose` sans un mot : le jour où l'intégration crée
   * une entité dans un domaine de plus, la garde se tait au lieu de parler.
   */
  const DOMAINS = [
    'sensor',
    'binary_sensor',
    'calendar',
    'todo',
    'button',
    'event',
    'image',
    'number',
    'select',
    'switch',
    'text',
    'update',
    'device_tracker',
    'person',
    'input_boolean',
    'input_text',
    'input_number',
    'input_select',
    'input_datetime',
  ];
  // La sentinelle de fin refuse une suite en majuscule : `event.currentTarget`
  // est un accès de propriété JavaScript, pas un identifiant d'entité, et
  // `event` est un domaine Home Assistant.
  const HARDCODED = new RegExp(
    String.raw`\b(?:${DOMAINS.join('|')})\.[a-z0-9_]{2,}(?![A-Za-z0-9_])`
  );

  /**
   * On ne cherche que dans les CHAÎNES du fichier, jamais dans le code nu.
   * Un identifiant d'entité n'est utilisable que sous forme de chaîne ; en
   * revanche `event.currentTarget` est un accès de propriété JavaScript
   * parfaitement légitime, et `event` est un domaine Home Assistant. Élargir
   * la liste des domaines sans restreindre le terrain de recherche fabrique
   * des faux positifs qui finissent par faire désactiver la garde — ce qui
   * est exactement ce qu'on cherche à éviter.
   */
  // Une chaîne contenant une apostrophe échappée sera coupée trop tôt ; sans
  // conséquence ici, la garde cherche un motif, pas à analyser le langage.
  const STRINGS = /'([^']*)'|"([^"]*)"|`([^`]*)`/g;
  const literalsOf = (file: string, body: string): string[] =>
    file.endsWith('.json')
      ? [body]
      : [...body.matchAll(STRINGS)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');

  it('src/ ne contient aucun identifiant complet', () => {
    for (const [file, body] of read(walk('src', ['.ts', '.json']))) {
      for (const literal of literalsOf(file, body)) {
        const hit = withoutAllowedCalls(literal).match(HARDCODED);
        expect(hit, `${file} contient « ${hit?.[0]} »`).toBeNull();
      }
    }
  });
});

/**
 * Liste BLANCHE des appels de service, et non liste noire des interdits.
 *
 * Chercher six noms interdits par `includes` est franchissable par une simple
 * concaténation, et n'aurait jamais révélé qu'un document publié mentait sur
 * ce que le code fait. Énumérer au contraire TOUS les appels réellement
 * présents dans `src/` et exiger que chaque couple `domaine.service` figure
 * ci-dessous inverse la charge : un appel nouveau échoue par défaut, sans que
 * personne ait à prévoir lequel.
 *
 * Cette liste doit rester identique à `AllowedCall` (src/core/types.ts). Le
 * type est la garantie ; ce test est la vérification de texte qui la double,
 * pas un substitut — la nuance a son importance, docs/limites.md l'explique.
 */
const ALLOWED_CALLS = [
  'carnet_scolaire.refresh',
  'todo.update_item',
  // Ajouté le 10 septembre 2026 avec la carte « mode de collecte », sur
  // demande du propriétaire. La garde suit le type et ne le précède jamais :
  // si cette ligne était là sans l'entrée correspondante dans `AllowedCall`,
  // la vérification de texte autoriserait un appel que le type refuse, et
  // c'est la vérification qui aurait tort.
  //
  // À noter, parce que c'est le vrai changement : `select` n'est pas le
  // domaine de l'intégration. Cette entrée ouvre donc l'écriture vers une
  // entité `select` quelconque de l'instance, là où les deux premières
  // restaient dans le périmètre de PRONOTE et des listes de tâches.
  'select.select_option',
  // Ajouté le 24 septembre 2026, sur accord explicite du propriétaire : le
  // seul service À RÉPONSE que le projet appelle, et il porte son propre type
  // (`AllowedResponseCall`) plutôt qu'une entrée de plus dans `AllowedCall`.
  // Il rend l'adresse signée d'une pièce jointe au moment du clic, pour que
  // l'intégration cesse de la publier dans un attribut d'entité. Il ne place
  // aucune requête PRONOTE.
  'carnet_scolaire.get_attachment_url',
];

describe('garde : liste blanche des appels de service', () => {
  // Le seul endroit du socle qui reconstitue domaine et service à partir de
  // `AllowedCall`, et donc le seul qui a le droit de toucher `hass.callService`.
  const BRIDGE = join('src', 'core', 'base-card.ts');

  it('tout appel de service part d’un littéral de la liste blanche', () => {
    for (const [file, body] of read(walk('src', ['.ts']))) {
      // `callForResponse` est le second pont du socle, celui des services à
      // réponse : il obéit à la même règle, et une garde qui ne regarderait
      // que `callService` le laisserait passer sans un mot.
      for (const m of body.matchAll(/(?<!\w)(?:callService|callForResponse)\(\s*([^)]{0,40})/g)) {
        const head = m[1] ?? '';
        // Une DÉCLARATION, pas un appel : le premier « argument » y est un
        // paramètre annoté (`domain: string`). ha-types.ts et types.ts
        // décrivent la surface de Home Assistant, ils n'appellent rien.
        if (/^[A-Za-z_$][\w$]*\s*[:?]/.test(head)) continue;
        // base-card.ts définit le pont : son argument est la variable typée
        // `AllowedCall`, déjà fermée à la compilation.
        if (file === BRIDGE && !head.startsWith("'")) continue;
        expect(
          head.startsWith("'"),
          `${file} : appel de service dont le premier argument n’est pas un littéral`
        ).toBe(true);
      }
      for (const m of body.matchAll(/(?<!\w)(?:callService|callForResponse)\(\s*'([^']*)'/g)) {
        const call = m[1] ?? '';
        expect(
          ALLOWED_CALLS.includes(call),
          `${file} appelle « ${call} », absent de la liste blanche`
        ).toBe(true);
      }
    }
  });

  it('hass.callService ne s’atteint que depuis le socle', () => {
    for (const [file, body] of read(walk('src', ['.ts']))) {
      if (file === BRIDGE) continue;
      expect(
        /\bhass\.callService\s*\(/.test(body),
        `${file} appelle hass.callService directement`
      ).toBe(false);
    }
  });
});

describe('garde : les services à réponse restent hors du projet', () => {
  const FORBIDDEN = [
    'get_ical_url',
    'get_identity',
    'generate_timetable_pdf',
    'get_rate_limit_status',
    'export_credentials',
    'ine_number',
  ];

  it('aucun fichier publié n’en mentionne un', () => {
    for (const [file, body] of published()) {
      for (const f of FORBIDDEN) {
        expect(body.includes(f), `${file} mentionne ${f}`).toBe(false);
      }
    }
  });
});

describe('garde : le journaliseur pronotepy n’est jamais recommandé', () => {
  it("aucun fichier publié ne propose d'activer pronotepy en debug", () => {
    for (const [file, body] of published()) {
      expect(/pronotepy\s*:\s*debug/i.test(body), file).toBe(false);
      expect(/logger.*pronotepy/i.test(body), file).toBe(false);
    }
  });
});

describe('garde : src/ ne dépend d’aucun module Node natif', () => {
  /**
   * `import … from 'node:x'`, `import 'node:x'`, `require('node:x')` ET
   * `import('node:x')` — la forme dynamique manquait, et c'est justement
   * celle qu'on écrit quand on veut qu'un import passe inaperçu.
   *
   * tsconfig.json élargit `types` à ["…", "node"] pour que ce fichier, qui lit
   * l'arborescence, compile. Cet élargissement ne vaut que pour les tests : il
   * ne doit jamais rendre compilable une carte qui s'exécute dans un
   * navigateur, pas dans Node.
   */
  const NODE_IMPORT =
    /(?:\bfrom\s+|\bimport\s+|\bimport\s*\(\s*|\brequire\(\s*)['"]node:[a-z0-9/_-]+['"]/;

  it("aucun fichier de src/ n'importe un module node:", () => {
    for (const [file, body] of read(walk('src', ['.ts', '.json']))) {
      const hit = body.match(NODE_IMPORT);
      expect(
        hit,
        `${file} importe « ${hit?.[0]} » : src/ part dans un navigateur, pas dans Node.`
      ).toBeNull();
    }
  });
});

const scanned = () =>
  read([
    ...walk('src', ['.ts', '.json']),
    ...walk('test', ['.ts']),
    ...walk('docs', ['.md']),
    ...walk('.github', ['.yml', '.md']),
    ...ROOT_DOCS,
  ]).filter(([f]) => !f.includes('superpowers'));

describe('garde : aucune donnée réelle', () => {
  // Liste blanche délibérée : élargir ici, jamais en affaiblissant la garde.
  const ALLOWED_HOSTS = new Set([
    'github.com',
    'fiveelements.github.io',
    'home-assistant.io',
    'www.home-assistant.io',
    'developers.home-assistant.io',
    'hacs.xyz',
    'demo.example.invalid',
    // Les badges du README. Cette garde existe pour empecher une adresse
    // d'instance PRONOTE de fuir dans le depot, pas pour interdire un service
    // d'images : un badge ne porte que le nom du depot public et l'etat d'un
    // workflow. La liste reste blanche plutot que de laisser passer les
    // sous-domaines d'un hote connu.
    'img.shields.io',
    // Le service de redirection officiel de Home Assistant, derrière les
    // boutons « Ajouter à mon Home Assistant » du README. L'URL ne porte que
    // le propriétaire et le nom du dépôt public.
    'my.home-assistant.io',
    // Le badge OpenSSF Scorecard et sa page de détail. L'URL ne porte que le
    // nom du dépôt public, comme les badges ci-dessus.
    'api.scorecard.dev',
    'scorecard.dev',
  ]);

  it('toutes les URL citées pointent vers un hôte autorisé', () => {
    // Tous les manquants d'un coup, et non le premier.
    //
    // La version précédente assérait à l'intérieur de la boucle : la première
    // URL non autorisée levait, et les suivantes restaient invisibles. Deux
    // hôtes arrivés dans le même commit du README ont donc coûté deux
    // publications — la première corrigée en local, verte, puis rouge en
    // intégration continue sur le second. Une garde qui ne montre qu'un
    // défaut à la fois transforme une correction en ping-pong.
    const offenders = new Set<string>();
    for (const [file, body] of scanned()) {
      for (const match of body.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) {
        const host = match[1] ?? '';
        if (!ALLOWED_HOSTS.has(host)) offenders.add(`${file} : ${host}`);
      }
    }
    expect([...offenders], 'hôtes non autorisés').toEqual([]);
  });

  /**
   * Une adresse d'instance PRONOTE s'écrit tout aussi bien sans schéma, et la
   * règle précédente, ancrée sur `http`, ne la voyait pas. Aucun exemple
   * concret n'est donné ici : la garde s'applique à son propre fichier. On cherche donc aussi les noms d'hôtes nus, reconnus à leur
   * domaine de premier niveau. Les extensions de fichiers du projet (.ts,
   * .json, .md, .yml) n'y figurent pas : elles ne peuvent pas déclencher de
   * faux positif.
   */
  const TLD = 'fr|com|net|org|io|xyz|edu|dev|app|eu|be|ch';
  const BARE_HOST = new RegExp(
    String.raw`(?<![\w./@-])((?:[a-z0-9-]+\.)+(?:${TLD}))(?![\w-])`,
    'g'
  );

  it('aucun nom d’hôte nu, sans schéma, n’échappe à la liste blanche', () => {
    for (const [file, body] of scanned()) {
      for (const match of body.matchAll(BARE_HOST)) {
        const host = match[1] ?? '';
        expect(ALLOWED_HOSTS.has(host), `${file} cite l'hôte nu ${host}`).toBe(true);
      }
    }
  });
});

/**
 * Une propriété d'une valeur de forme inconnue.
 *
 * `JSON.parse` rend `any`, et le lint du projet refuse — à juste titre — de
 * convertir ce `any` en une forme affirmée : on ne connaît pas le contenu
 * d'un fichier lu à l'exécution. On le TRAVERSE donc, sans jamais prétendre
 * savoir ce qu'il est. `Object.entries` fait la vérification que l'assertion
 * aurait sautée.
 */
const prop = (value: unknown, key: string): unknown => {
  if (typeof value !== 'object' || value === null) return undefined;
  for (const [k, v] of Object.entries(value)) {
    if (k === key) return v as unknown;
  }
  return undefined;
};

/** Le catalogue d'une langue, tel quel. */
const cataloguesCache = new Map<string, unknown>();
const catalogueOf = (lang: string): unknown => {
  const seen = cataloguesCache.get(lang);
  if (seen !== undefined) return seen;
  const parsed: unknown = JSON.parse(readFileSync(join('src', 'localize', `${lang}.json`), 'utf8'));
  cataloguesCache.set(lang, parsed);
  return parsed;
};

/**
 * Les couples (racine de catalogue, nom d'option) déclarés par les cartes,
 * relevés dans le source plutôt qu'en important les `SPEC` : `schema()` est
 * une fonction de la configuration, et l'appeler ici demanderait d'inventer
 * une configuration par carte — donc de deviner laquelle révèle toutes les
 * options. Le source, lui, les porte toutes.
 */
const declared = (): { key: string; option: string; file: string }[] => {
  const out: { key: string; option: string; file: string }[] = [];
  for (const [file, body] of read(walk(join('src', 'cards'), ['.ts']))) {
    const keyMatch = /^\s*key: '([a-z_]+)',$/m.exec(body);
    if (!keyMatch?.[1]) continue;
    const key = keyMatch[1];
    // Les entrées de schéma s'écrivent toutes `{ name: '<option>', selector: …`.
    for (const m of body.matchAll(/\{\s*name: '([a-z_]+)',\s*selector:/g)) {
      const option = m[1];
      if (option !== undefined) out.push({ key, option, file });
    }
  }
  return out;
};

/**
 * Chaque option d'éditeur doit avoir son libellé, dans les quatre langues.
 *
 * L'éditeur générique résout les libellés sous la racine de catalogue de la
 * carte : une option `show_teachers` sur la carte `journee` cherche
 * `journee.show_teachers`. Une clé absente rend **le chemin lui-même**, par
 * choix du projet — donc le défaut est visible et non silencieux. Mais visible
 * veut dire visible par l'utilisateur, dans son formulaire de configuration,
 * après publication.
 *
 * Cette garde n'existait pas, et la carte vue journée a ajouté huit options
 * d'un coup. Elle couvre les dix cartes, pas seulement la dernière : le coût
 * est le même et le filet est bien plus large.
 */
describe('garde : les libellés d’options de l’éditeur', () => {
  const CATALOGUES = ['fr', 'it', 'pt', 'es'] as const;

  it('relève bien des options à vérifier — sinon la garde ne garde rien', () => {
    // Une garde dont l'extraction rend zéro élément passe toujours. Le seuil
    // est délibérément bas : il dit « le relevé fonctionne », pas « il y a
    // tant d'options ».
    expect(declared().length).toBeGreaterThan(15);
  });

  for (const lang of CATALOGUES) {
    it(`chaque option a son libellé en ${lang}`, () => {
      for (const { key, option, file } of declared()) {
        const racine = prop(catalogueOf(lang), key);
        expect(racine, `${file} : le catalogue ${lang} n'a pas de racine « ${key} »`).toBeDefined();
        expect(
          typeof prop(racine, option),
          `${file} : ${lang} n'a pas de libellé pour « ${key}.${option} »`
        ).toBe('string');
      }
    });
  }
});

describe('garde : aucune pastille colorée ne porte du texte sur un aplat', () => {
  /**
   * Les trois tons de pastille ont porté pendant des semaines du blanc sur un
   * aplat saturé : `warn` donnait **1,96:1**, `problem` 4,29 et `ok` 3,30, là
   * où la règle de contraste des textes demande 4,5. Le pire était l'ambre,
   * dont la luminance est proche de celle du blanc — à ce niveau ce n'est plus
   * une question d'accessibilité, c'est illisible pour tout le monde.
   *
   * Ils sont appelés 71 fois depuis dix des onze cartes, donc le retour de
   * l'aplat serait un défaut du dépôt entier et non d'une carte.
   *
   * Cette garde est **textuelle** et ne mesure aucun contraste : `happy-dom`
   * ne calcule pas de style, et un test qui prétendrait mesurer ici serait un
   * test vert répétant son hypothèse. Elle vérifie la forme qui a produit le
   * défaut, ce qui est ce qu'une garde peut réellement tenir.
   */
  const styles = readFileSync(join('src', 'core', 'ui', 'styles.ts'), 'utf8');

  const TONS = ['--warning-color', '--error-color', '--success-color'];

  /** Le corps d'une règle .chip.<ton>, accolades comprises. */
  const regleDe = (ton: string): string => {
    const debut = styles.indexOf('.chip.' + ton + ' {');
    expect(debut).toBeGreaterThan(-1);
    return styles.slice(debut, styles.indexOf('}', debut));
  };

  it('mélange chaque ton au fond de la carte au lieu de l’étaler', () => {
    for (const ton of TONS) {
      // Appariement positif : le ton est bien employé.
      expect(styles).toContain(ton);
      // Et il n'atteint jamais un fond directement.
      expect(styles).not.toContain('background: var(' + ton + ')');
    }
    for (const nom of ['warn', 'problem', 'ok']) {
      const regle = regleDe(nom);
      // Deux mélanges par règle : le fond et le texte.
      expect(regle.split('color-mix(').length - 1).toBe(2);
      expect(regle).toContain('var(--card-background-color)');
      expect(regle).toContain('var(--primary-text-color)');
    }
  });

  it('ne pose plus, sur une pastille, la couleur de texte prévue pour un aplat', () => {
    // `--text-primary-color` est destinée à s'asseoir sur `--primary-color`.
    // Sur un ton saturé elle ne garantit rien, et c'est elle qui produisait
    // le 1,96. Elle reste légitime ailleurs, donc la garde est portée sur les
    // trois règles et non sur le fichier.
    for (const nom of ['warn', 'problem', 'ok']) {
      expect(regleDe(nom)).not.toContain('--text-primary-color');
    }
  });
});
