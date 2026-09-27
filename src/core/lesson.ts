/**
 * Ce qu'un créneau porte, et les deux lectures qui ne doivent pas diverger
 * entre les cartes qui l'affichent.
 *
 * Ce module existe parce que deux cartes lisent maintenant `lessons[]` —
 * l'emploi du temps et la vue journée. La règle du dépôt est nette : une même
 * question posée à la même donnée par deux cartes finit par recevoir deux
 * réponses différentes. La détection d'annulation en particulier ne se
 * duplique pas : elle a déjà été corrigée une fois, et une carte restée sur
 * l'ancienne lecture afficherait un cours annulé comme un cours normal.
 */

export interface Lesson {
  subject?: string;
  start?: string;
  end?: string;
  classroom?: string;
  teachers?: string[] | string;
  canceled?: boolean;
  status?: string;
  test?: boolean;
  outing?: boolean;
  /**
   * L'élève est dispensé de ce cours. L'intégration l'exclut déjà de ses
   * propres calculs (prochain cours, fin de journée) ; une carte le montre,
   * avec sa pastille, et ne le dit jamais « en cours ».
   */
  exempted?: boolean;
  /**
   * « Le serveur n'a pas envoyé l'heure de fin. » Vaut **exactement** ça, et
   * le champ est toujours présent. Sur l'établissement de référence, il vaut
   * `true` sur **37 créneaux sur 37** : cet établissement ne publie aucune
   * heure de fin, et toutes celles affichées sont calculées depuis la grille
   * horaire. Une carte qui montre l'heure de fin doit donc le signaler, sans
   * quoi elle présente un calcul comme une donnée — sur chaque ligne.
   */
  end_inferred?: boolean;
  /**
   * La couleur de matière (`CouleurFond`). `unknown` à dessein : c'est une
   * chaîne de serveur, et elle doit traverser `subjectColor` avant d'atteindre
   * un attribut `style`.
   */
  background_color?: unknown;
}

/**
 * Le seul libellé de `status` que la pastille d'annulation dit déjà.
 * C'est du texte de serveur, jamais traduit (voir `docs/limites.md`) : on le
 * compare tel quel, on ne le reformule pas.
 */
export const CANCELED_STATUS = 'Cours annulé';

/**
 * `canceled` est le signal nominal, mais certaines versions de l'intégration
 * ne posent que `status` (par exemple « Cours annulé ») sans lever
 * `canceled`. L'ignorer ferait apparaître un cours annulé comme un cours
 * normal — exactement ce que la règle « signalé et non masqué » interdit.
 */
export const isCanceled = (l: Lesson): boolean =>
  // Rogné comme dans `statusLabel` : sinon une espace finale faisait taire le
  // libellé ici ET là-bas, et le cours annulé passait pour un cours normal.
  l.canceled === true || (typeof l.status === 'string' && l.status.trim() === CANCELED_STATUS);

/**
 * Le motif écrit par l'établissement, quand il dit plus que la pastille
 * d'annulation.
 *
 * `status` est **orthogonal** à `canceled`, et c'est un relevé d'instance qui
 * l'a montré : sur une semaine de 27 créneaux, `canceled: true` avec
 * « Prof. absent », et `canceled: false` avec « Cours modifié ». Le drapeau
 * dit SI le cours a lieu, le libellé dit POURQUOI — et le pourquoi est ce
 * qu'un parent veut lire.
 *
 * Rendu vide quand le libellé ne fait que répéter la pastille : deux surfaces
 * qui affirment la même chose finissent par se désaccorder sans qu'on sache
 * laquelle croire.
 *
 * Le texte est rendu **tel quel**, jamais classé. Il n'existe aucune
 * énumération fermée de ces libellés côté intégration — vérifié dans son
 * modèle, où un créneau ne porte que `canceled: bool` et `status: str | None`,
 * sans aucun indicateur distinct pour « classe absente » ou « professeur
 * absent ».
 */
export const statusLabel = (l: Lesson): string => {
  const label = typeof l.status === 'string' ? l.status.trim() : '';
  return label === CANCELED_STATUS ? '' : label;
};

/** `teachers` arrive tantôt en tableau, tantôt en chaîne selon la version de l'intégration. */
export const teachersOf = (value: unknown): string =>
  Array.isArray(value) ? value.filter(Boolean).join(', ') : typeof value === 'string' ? value : '';
