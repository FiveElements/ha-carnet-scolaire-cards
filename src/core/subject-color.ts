/**
 * La couleur qu'un établissement associe à une matière.
 *
 * PRONOTE publie une couleur par matière — `CouleurFond` sur les créneaux et
 * les devoirs, `couleur` sur les moyennes par matière. C'est un code visuel que
 * l'élève connaît déjà de l'interface officielle, et le reprendre coûte moins
 * cher en attention que n'importe quelle légende.
 *
 * ## Pourquoi cette fonction existe
 *
 * C'est la **seule** valeur de ce dépôt qui vienne du serveur PRONOTE et
 * atteigne un attribut `style`. Tout le reste de ce que le serveur écrit
 * (matière, salle, motif d'annulation, énoncé de devoir) est du texte, et Lit
 * échappe le texte : il ne peut pas s'échapper de son nœud. Une couleur, non —
 * elle devient de la CSS, et la CSS interpolée est un vecteur : un
 * point-virgule dans la valeur ajoute une propriété arbitraire à la règle.
 * `#fff; position: fixed; inset: 0` recouvrirait la page depuis une donnée de
 * serveur.
 *
 * D'où le contrat : **hexadécimal strict, ou rien.** Pas de noms CSS, pas de
 * `rgb()`, pas de `color-mix()`. Ces formes sont légitimes en CSS et refusées
 * quand même, parce qu'accepter une famille de syntaxes revient à accepter
 * l'analyseur CSS entier comme frontière de confiance. Une expression
 * régulière qui n'admet que `#` suivi de trois ou six chiffres hexadécimaux
 * est une frontière qu'on peut lire en entier.
 *
 * Refuser n'a aucun coût d'affichage : sans couleur exploitable, la carte rend
 * exactement ce qu'elle rendait avant. C'est la propriété qui permet d'être
 * aussi strict — le pire cas est une ligne sans accent de couleur.
 *
 * ## Ce qu'elle tolère, et ce qu'elle ne fait toujours pas
 *
 * Elle admet le `#` **manquant** : `1e88e5` est accepté et rendu `#1e88e5`.
 * C'est un revirement assumé — une version antérieure de ce commentaire
 * refusait toute normalisation, au motif qu'une valeur rendue telle quelle se
 * retrouve à l'identique dans le DOM inspecté, ce qui facilite le diagnostic.
 * L'argument était bon et il a perdu : une table écrite `1e88e5` laissait la
 * ligne grise **sans un mot**, exactement l'échec silencieux que le repli des
 * accents existe pour tuer, et rien ne distinguait « j'ai oublié le dièse » de
 * « cette matière n'a pas de couleur ». Un dièse ajouté coûte un caractère de
 * différence entre la configuration et le DOM ; l'échec silencieux coûte une
 * demi-heure à celui qui le cherche.
 *
 * Elle ne touche à **rien d'autre** : ni la casse, ni la forme à trois
 * chiffres, qui sont toutes deux valides en CSS et se lisent telles quelles.
 * La sortie reste donc au plus proche de ce que l'utilisateur a écrit.
 *
 * Elle ne juge pas non plus le CONTRASTE. Les couleurs PRONOTE sont choisies
 * pour le fond blanc de l'interface officielle : un bleu nuit posé sur un
 * thème sombre de Home Assistant est presque invisible. C'est pourquoi les
 * cartes ne s'en servent que comme **accent** — une bordure, jamais un fond ni
 * une couleur de texte. Un accent invisible perd une information secondaire ;
 * un fond mal contrasté rendrait la ligne illisible.
 */

/**
 * Un `#` **facultatif** suivi de trois ou six chiffres hexadécimaux, et rien
 * d'autre.
 *
 * Les ancres `^` et `$` sont ce qui fait le travail : sans elles,
 * `#fff; position: fixed` correspondrait par son préfixe, et
 * `#336699 (rouge)` passerait pour une couleur. Rendre le `#` facultatif ne
 * touche pas à cette propriété — c'est le nombre de chiffres qui reste ancré
 * des deux côtés.
 *
 * Les formes à quatre et huit chiffres (avec canal alpha) sont volontairement
 * hors du contrat : le serveur ne les envoie pas, et une transparence sur un
 * accent de couleur ne servirait qu'à le rendre moins lisible.
 */
const STRICT_HEX = /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * La couleur si elle est exploitable, `undefined` sinon.
 *
 * Le paramètre est `unknown` par honnêteté : un attribut d'entité Home
 * Assistant n'est typé nulle part, et ce champ arrive tel que le serveur l'a
 * écrit. Un `string | undefined` mentirait sur ce qu'on reçoit.
 */
export function subjectColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!STRICT_HEX.test(trimmed)) return undefined;
  // Le dièse est ajouté s'il manque, et rien de plus. La valeur atteint un
  // attribut `style` : sans lui, `1e88e5` y serait une couleur invalide, donc
  // silencieusement ignorée par le navigateur — le même échec muet que le
  // filtre est censé rendre impossible.
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * La couleur d'une matière, en **trois rangs**, dans cet ordre.
 *
 * 1. la couleur publiée par le serveur, filtrée par `subjectColor` ;
 * 2. sinon la table de l'utilisateur, comparée sans casse ni espaces de bord ;
 * 3. sinon `undefined` — à l'appelant de choisir entre pas de gouttière et une
 *    gouttière réservée mais transparente (voir `RowOptions.accent`).
 *
 * Le rang 1 produit depuis la version 0.0.13 de l'intégration : la couleur
 * arrive sur les créneaux d'emploi du temps, sur les devoirs et sur les
 * moyennes par matière — mesuré 27 sur 27, 12 sur 12 et 4 sur 4. Le troisième
 * palier est longtemps resté une attente plutôt qu'une mesure : le serveur y
 * écrit la couleur sous un autre nom de champ que sur les deux premiers, et la
 * liste était vide aux premiers relevés. Observé le 24 septembre 2026. Deux
 * entités ne la portent pas : le prochain cours (mesuré, la clé est absente de ses
 * attributs) et les évaluations (`_evaluations_attributes` construit ses
 * éléments en ligne, et le modèle amont ne porte pas le champ).
 *
 * Le rang 2 reste donc la seule source de couleur sur ces deux entités-là.
 *
 * **Et le rang 1 rend le rang 2 muet sans le dire.** Une table écrite pour
 * compenser l'absence du champ est devenue inerte le jour où le champ est
 * arrivé, en restant dans le YAML de l'utilisateur. Une version antérieure de
 * ce commentaire promettait « rien à supprimer à ce moment-là » : c'était faux,
 * et l'erreur est instructive parce qu'elle raisonnait juste sur le mécanisme.
 * Le rang 1 bat bien le rang 2 tout seul — mais un mécanisme correct peut
 * laisser derrière lui une configuration qui ne correspond plus à rien.
 *
 * **Jamais de couleur dérivée du libellé par hachage.** C'est le rang qui
 * n'existe pas, et délibérément : une couleur déclarée est assumée et
 * corrigible, une couleur calculée aurait l'apparence d'une information sans en
 * porter aucune. Deux matières prendraient deux teintes qu'un lecteur lirait
 * comme une catégorie, et le jour où le serveur publierait ses vraies couleurs,
 * elles contrediraient l'habitude prise.
 *
 * La comparaison ignore la casse, les espaces de bord **et les signes
 * diacritiques**, parce que PRONOTE écrit souvent les matières en capitales et
 * que personne ne devrait avoir à recopier « HISTOIRE-GÉOGRAPHIE » à
 * l'identique pour obtenir une couleur. Le repli des accents n'est pas un
 * confort : sans lui, une table écrite sans accents laisse la ligne grise
 * **sans un mot** — un échec silencieux, et le pire genre puisque rien ne
 * distingue « j'ai mal écrit la matière » de « cette matière n'a pas de
 * couleur ». Le risque inverse, deux matières d'un même établissement ne
 * différant que par un accent, n'existe pas.
 * Les couleurs de la table passent par le même filtre strict que celles du
 * serveur — une chaîne de configuration atteint le même attribut `style`, et
 * l'origine d'une valeur ne dit rien de son innocuité.
 */
/**
 * Un nom de matière réduit à ce qui doit servir à la comparaison.
 *
 * `NFD` décompose « é » en « e » + accent combinant, et la classe Unicode
 * `\p{M}` retire ces marques — d'où le drapeau `u`, sans lequel la classe
 * n'existe pas. Le nom d'origine n'est jamais modifié : seule la clé de
 * comparaison l'est.
 */
const fold = (value: string | undefined): string =>
  (value ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/**
 * La clé de comparaison d'une matière, pour qu'une carte qui rapproche deux
 * familles par leur matière (une note et la moyenne qui porte sa couleur)
 * compare comme le filtre et la table de couleurs, et pas autrement.
 */
export const subjectKey = fold;

/**
 * Le filtre de matières d'une carte, avec la même comparaison que la table de
 * couleurs : sans casse, sans accents, sans espaces de bord. Une liste absente
 * ou vide laisse tout passer.
 */
export function subjectFilter(
  wanted: readonly string[] | undefined
): (subject: string | undefined) => boolean {
  const keys = new Set((wanted ?? []).map(fold).filter((k) => k !== ''));
  if (keys.size === 0) return () => true;
  return (subject) => keys.has(fold(subject));
}

export function subjectAccent(
  published: unknown,
  subject: string | undefined,
  table: Record<string, string> | undefined
): string | undefined {
  const fromServer = subjectColor(published);
  if (fromServer !== undefined) return fromServer;

  const name = fold(subject);
  if (name === '' || table === undefined) return undefined;
  for (const [key, color] of Object.entries(table)) {
    if (fold(key) === name) return subjectColor(color);
  }
  return undefined;
}
