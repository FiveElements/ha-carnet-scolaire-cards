import type { HomeAssistant } from './ha-types';
import type { EntityKey } from './types';

/**
 * Écarte d'une résolution les surcharges `entities` qui ne désignent rien.
 *
 * `resolveEntities` accepte une surcharge sur son seul domaine : il ne lit
 * jamais `hass.states`, et une surcharge peut légitimement viser une entité
 * hors registre (une entité YAML sans `unique_id`). Une faute de frappe y
 * passait donc, et la carte affichait « pas encore collectée » — présenté
 * comme transitoire — pour toujours, pendant que l'éditeur disait « trouvée ».
 *
 * Une surcharge est gardée si son identifiant figure au registre OU dans les
 * états ; sinon la clé tombe en « introuvable ». Ce contrôle vit hors du
 * résolveur exprès, pour que l'invariant de `resolve.ts` reste vrai. La carte
 * rendue n'est jamais mutée : elle peut venir d'un cache.
 */
export function dropDanglingOverrides(
  hass: HomeAssistant,
  resolved: Map<EntityKey, string>,
  overrides: Record<string, string> | undefined
): Map<EntityKey, string> {
  if (!overrides) return resolved;
  const vides = [...resolved].filter(
    ([k, id]) =>
      overrides[k] === id && hass.entities[id] === undefined && hass.states[id] === undefined
  );
  if (vides.length === 0) return resolved;
  const kept = new Map(resolved);
  for (const [k] of vides) kept.delete(k);
  return kept;
}
