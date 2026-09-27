/**
 * Lecture défensive des attributs de liste publiés par l'intégration.
 *
 * Les attributs d'entités Home Assistant ne sont typés nulle part : `items`,
 * `lessons`, `tiers_due` arrivent tels que l'intégration les a posés. Le socle
 * garantit qu'une entité est résolue et porte un état exploitable ; il ne
 * garantit rien sur la FORME de ses attributs.
 *
 * Une carte qui fait `(ctx.attr('items') ?? []).slice()` survit à l'absence et
 * au `null`, mais lève sur un objet ou une chaîne — et une exception dans
 * `render` ne dégrade pas l'affichage : elle le fait disparaître entièrement,
 * sans même le message « donnée pas encore collectée ». C'est pire que le
 * défaut qu'on cherchait à éviter.
 */

/**
 * Rend le tableau demandé, débarrassé de ses trous, ou un tableau vide.
 *
 * `T` est ce que l'appelant annonce lire, pas une garantie : les attributs
 * Home Assistant ne sont typés nulle part. La seule chose que cette fonction
 * garantit, c'est un tableau sans `null` ni `undefined`.
 */
export function listAttr<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  const items: unknown[] = value;
  return items.filter((item): item is T => item !== null && item !== undefined);
}

/**
 * Les `limit` éléments les plus récents, le plus récent en tête.
 *
 * L'intégration publie ses listes du plus ancien au plus récent ; les cartes
 * veulent l'inverse et souvent tronqué. Écrire cette bascule dans chaque carte
 * a produit deux implémentations divergentes : l'une traitait `limit: 0` comme
 * « aucun élément », l'autre comme « tous », parce que `slice(-0)` vaut
 * `slice(0)`. Ici, `limit` absent, nul ou négatif signifie « tout », et
 * `limit: 0` signifie « aucun » — le seul sens qui ne surprenne personne.
 *
 * L'itération à indice décroissant remplace `reverse()`, qui muterait son
 * receveur et que la configuration de lint du projet refuse.
 */
export function latestFirst<T>(value: unknown, limit?: number): T[] {
  const all = listAttr<T>(value);
  // `typeof` et `isFinite` : un `limit: null` venu du YAML passait `< 0`
  // (faux) et rendait une liste vide, un NaN aussi.
  const count =
    typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0 ? all.length : limit;
  const out: T[] = [];
  for (let i = all.length - 1; i >= Math.max(0, all.length - count); i--) {
    const item = all[i];
    if (item !== undefined) out.push(item);
  }
  return out;
}

/**
 * Tri stable, sans muter son entrée.
 *
 * `Array#sort()` mute son receveur, ce que la configuration de lint du projet
 * proscrit ; `Array#toSorted()` est ES2023, hors de la cible `lib` du projet
 * (ES2022), et rien ne la polyfille dans un navigateur. Trois cartes ont
 * résolu ce même dilemme de trois façons différentes — deux tris par
 * insertion recopiés à l'identique et une suppression de règle de lint. La
 * primitive vit donc ici, une seule fois.
 *
 * Le tri par insertion est stable et largement suffisant : les listes triées
 * sont celles d'une journée de cours ou d'une liste de devoirs bornée.
 */
export function sortedBy<T>(items: T[], compare: (a: T, b: T) => number): T[] {
  const out = [...items];
  for (let i = 1; i < out.length; i++) {
    const cur = out[i];
    if (cur === undefined) continue;
    let j = i - 1;
    while (j >= 0) {
      const prev = out[j];
      if (prev === undefined || compare(prev, cur) <= 0) break;
      out[j + 1] = prev;
      j--;
    }
    out[j + 1] = cur;
  }
  return out;
}
