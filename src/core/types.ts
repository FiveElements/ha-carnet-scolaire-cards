import type { TemplateResult } from 'lit';
import type { HaFormSchema, HassEntity, HomeAssistant } from './ha-types';

/** Clé d'entité qualifiée par son domaine : 'sensor:next_lesson', 'todo:homework'. */
export type EntityKey = `${string}:${string}`;

/** Les trois états que toute carte doit distinguer (spec §4.3). */
export type EntityStatus = 'missing' | 'unavailable' | 'ok';

export type CardScope = 'child' | 'account';

/** Signature de la fonction de traduction telle que consommée par les primitives d'affichage. */
export type Translate = (path: string, vars?: Record<string, string | number>) => string;

export interface CarnetCardConfig {
  type: string;
  device_id?: string;
  title?: string;
  /** Surcharge de résolution, clé qualifiée → entity_id. Jamais nécessaire au cas nominal. */
  entities?: Record<string, string>;
  [option: string]: unknown;
}

/**
 * Vue en lecture de `HomeAssistant` : tout, sauf `callService`. C'est ce qui
 * rend vraie la promesse de docs/limites.md — le socle ne donne aux cartes
 * aucun moyen d'appeler un service Home Assistant via `ctx.hass` ; le seul
 * chemin d'appel est `RenderCtx.callService`, restreint par le type à
 * `AllowedCall`.
 */
export type HassView = Omit<HomeAssistant, 'callService'>;

/**
 * Compose un couple domaine/service sans jamais écrire la paire en dur,
 * contiguë, dans le source : la garde anti-identifiant du projet
 * (test/guards.test.ts) repère `todo.` suivi de minuscules comme un
 * identifiant d'entité codé en dur.
 */
type Call<Domain extends string, Service extends string> = `${Domain}.${Service}`;

/**
 * Les seuls appels qu'une carte peut émettre. Toute autre valeur est refusée
 * à la compilation — en particulier aucun des services à réponse (celui qui
 * rend l'URL iCal, celui qui rend le bloc d'identité, celui qui produit le
 * PDF d'emploi du temps, celui qui rend l'état du limiteur, celui qui
 * exporte les identifiants, celui qui rend le numéro INE) ne peut y figurer
 * sans passer par cette liste, revue en revue de code.
 */
export type AllowedCall =
  | Call<'carnet_scolaire', 'refresh'>
  | Call<'todo', 'update_item'>
  // La bascule de mode de collecte, ajoutee le 10 septembre 2026 sur demande
  // du proprietaire. C'est un ELARGISSEMENT de la seule garantie que
  // `docs/limites.md` presente comme portee par le type, donc il se dit.
  //
  // Ce qu'elle ne casse pas : l'invariant est qu'une carte ne declenche
  // jamais de collecte A L'AFFICHAGE, pas qu'elle ne puisse rien declencher.
  // `carnet_scolaire.refresh` etait deja un geste delibere de l'utilisateur. Un
  // clic sur un mode a la meme forme.
  //
  // Ce qu'elle change vraiment : le domaine `select` n'est pas celui de
  // l'integration. Une carte peut donc desormais ecrire dans une entite
  // `select` QUELCONQUE de l'instance, si un jour une carte s'y trompait de
  // cible. La cible vient de `ctx.entityId(cle)`, donc de la resolution, donc
  // du registre — mais le type ne le garantit plus a lui seul, et c'est le
  // prix paye ici.
  | Call<'select', 'select_option'>;

/**
 * Les seuls services **à réponse** qu'une carte peut appeler. Une liste à
 * part, et non une entrée de plus dans `AllowedCall` : un service à réponse
 * rend une donnée à la carte, là où les trois appels ci-dessus agissent sans
 * rien rendre. Les confondre dans un même type laisserait `refresh` demander
 * une réponse, ou ce service-ci s'appeler sans qu'on la lise.
 *
 * Ajouté le 24 septembre 2026 sur accord explicite du propriétaire, pour la
 * sécurité des flux : l'intégration cesse de publier dans un attribut
 * d'entité l'adresse signée qui ouvre une pièce jointe de type fichier.
 * L'attribut finissait dans l'historique, dans chaque abonnement WebSocket et
 * dans l'état exporté, avec douze heures de validité. Frappée au clic, elle
 * n'existe que le temps d'ouvrir l'onglet, et l'intégration la fait expirer
 * en cinq minutes.
 *
 * Ce que ce service ne fait pas, et qui est ce qui l'autorise ici : il ne
 * place **aucune** requête PRONOTE. Il retrouve la pièce dans l'instantané
 * déjà en mémoire et signe un chemin, sans réseau. La requête vers
 * l'établissement part à l'ouverture du document, comme avant — donc
 * toujours d'un geste de l'utilisateur, jamais de l'affichage.
 *
 * Les six services à réponse que la liste ci-dessus refuse restent refusés :
 * celui-ci n'en fait pas partie, et il n'ouvre la porte à aucun d'eux.
 */
export type AllowedResponseCall = Call<'carnet_scolaire', 'get_attachment_url'>;

export interface RenderCtx<C extends CarnetCardConfig = CarnetCardConfig> {
  /** Vue en lecture : `callService` n'y figure pas (voir `HassView`). */
  hass: HassView;
  config: C;
  /** Langue de Home Assistant. Commodité pour éviter `ctx.hass.language`. */
  language: string;
  /** Fuseau horaire de Home Assistant. Commodité pour éviter `ctx.hass.locale.time_zone`. */
  timeZone: string;
  /** Nom affiché de l'appareil résolu. Jamais un nom codé en dur. */
  deviceName: string;
  entityId(key: EntityKey): string | undefined;
  entity(key: EntityKey): HassEntity | undefined;
  status(key: EntityKey): EntityStatus;
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- `T` est une commodité d'écriture pour lire un attribut d'entité Home Assistant, qui n'est typé nulle part : ce n'est pas une garantie de type, l'appelant reste responsable de ce qu'il annonce.
  attr<T = unknown>(key: EntityKey, name: string): T | undefined;
  /** Chaîne localisée depuis src/localize. */
  t(path: string, vars?: Record<string, string | number>): string;
  /**
   * Seul point d'appel de service ouvert aux cartes, restreint par le type
   * à `AllowedCall`. Ne place aucun appel réseau PRONOTE lui-même : c'est
   * l'ordonnanceur, côté intégration, qui reste soumis au limiteur.
   */
  callService(
    call: AllowedCall,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>
  ): Promise<void>;
  /**
   * Appelle un service à réponse de la liste close `AllowedResponseCall` et
   * rend sa réponse, non typée : elle vient du serveur, l'appelant la filtre.
   *
   * Jamais au rendu. Le seul appelant est un gestionnaire de clic, et c'est
   * ce qui garde vraie la règle « aucun appel à l'affichage ». Les erreurs ne
   * lèvent pas de bandeau Home Assistant : elles remontent à la carte, qui
   * sait quoi en dire.
   */
  callForResponse(call: AllowedResponseCall, data: Record<string, unknown>): Promise<unknown>;
  /** Relève une priorité de collecte auprès de l'ordonnanceur. Passe par `callService`. */
  refresh(tier?: string): Promise<void>;
  /** Vrai pendant l'intervalle de garde suivant un refresh (spec §4.5). */
  refreshCoolingDown: boolean;
  /** Vrai si le dernier `refresh` a échoué (rejet du service). Remis à faux au prochain appel. */
  refreshFailed: boolean;
  /**
   * Curseur de navigation local à cette carte. Un entier, que la carte
   * interprète comme elle veut ; le socle ne garantit que deux choses : il
   * survit aux repeints, et il **retombe à zéro à chaque `setConfig`**.
   *
   * Volontairement hors de la configuration, et c'est tout l'intérêt. Un
   * `day: -1` posé dans le YAML d'un tableau de bord y resterait : la carte
   * afficherait la veille pour tout le monde, en permanence, et le lendemain
   * l'avant-veille. Ce curseur est un état d'interface — il vit dans
   * l'instance de l'élément, pas dans le document du tableau de bord, donc il
   * disparaît au rechargement de la page comme la position d'un défilement.
   *
   * Un entier et non un dictionnaire ouvert : un fourre-tout invite à y
   * ranger des données, alors qu'une carte ne doit rien détenir que le
   * registre ne porte déjà.
   */
  cursor: number;
  /** Déplace le curseur et repeint. N'écrit rien dans la configuration. */
  setCursor(value: number): void;
}

export interface CardSpec<C extends CarnetCardConfig = CarnetCardConfig> {
  /** Nom de l'élément personnalisé, sans le préfixe 'custom:'. */
  type: string;
  name: string;
  description: string;
  /** Racine de catalogue de la carte : 'notes', 'devoirs'… Sert aux libellés de l'éditeur. */
  key: string;
  scope: CardScope;
  /** Toutes obligatoires. Fonction de la config : `range` et `period` changent les clés. */
  requires(config: C): EntityKey[];
  /** Au moins une doit être résolue. Vide si sans objet. */
  requiresAny?(config: C): EntityKey[];
  optional(config: C): EntityKey[];
  /**
   * `t` est optionnel pour que les cartes non encore migrées continuent de
   * compiler ; une carte qui l'ignore retombe sur des libellés en dur.
   */
  schema(config: C, t?: Translate): HaFormSchema[];
  /** Config par défaut proposée par l'éditeur de tableau de bord. */
  stub?: Partial<C>;
  /**
   * Hauteur annoncée à Home Assistant, qui s'en sert pour répartir les cartes
   * en colonnes. Une fonction plutôt qu'un nombre, parce qu'une même carte
   * n'a pas la même hauteur selon sa configuration : l'emploi du temps rend
   * une poignée de lignes en mode journée et trente à quarante en mode
   * semaine. Un nombre figé faisait mentir toutes les configurations sauf
   * une, et Home Assistant empilait alors les colonnes de travers.
   */
  size?: number | ((config: C) => number);
  /**
   * Carte dont la charge utile vit dans les ATTRIBUTS, pas dans l'état.
   *
   * Le socle écarte normalement une entité dont l'état est `unknown` ou
   * `unavailable` : « pas encore collectée », et `render` n'est pas appelé.
   * C'est le bon comportement pour presque tout — mais pas pour la cantine,
   * où l'intégration laisse délibérément l'état à `unknown` même quand la
   * collecte a réussi, parce que « zéro plat » serait une affirmation sur un
   * menu qui n'existe pas. L'information « il n'y a pas de menu aujourd'hui »
   * ne vit alors que dans un attribut.
   *
   * Avec ce drapeau, une entité résolue mais sans état exploitable est
   * confiée à la carte, qui devient responsable des DEUX phrases : « pas de
   * menu ce jour » et « pas encore collecté ». Ne l'activez que si la carte
   * sait vraiment les distinguer — sinon le socle le fait mieux.
   *
   * Deux cartes le portent : la cantine, et le prochain cours, dont le
   * capteur vaut `unknown` quand plus aucun cours n'est collecté (les
   * vacances) — `fetched_at` y distingue « plus de cours » de « pas encore
   * collectée ».
   */
  attributeDriven?: boolean;
  /**
   * Déclare que la carte a besoin d'être repeinte périodiquement même sans
   * qu'aucune propriété réactive ne change — compte à rebours, créneau en
   * cours, bouton grisé par le temps. Le socle pose la minuterie ; la carte
   * ne gère jamais elle-même de `setInterval`.
   */
  tickMs?: number;
  render(ctx: RenderCtx<C>): TemplateResult;
}
