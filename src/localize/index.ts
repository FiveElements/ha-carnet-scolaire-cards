import fr from './fr.json';
import it from './it.json';
import pt from './pt.json';
import es from './es.json';

type Dict = { [k: string]: string | Dict };

const CATALOGS: Record<string, Dict> = { fr, it, pt, es };
const FALLBACK = 'fr';

/**
 * Résout un chemin pointé dans le catalogue de la langue, puis dans le
 * catalogue de repli. Rend le chemin lui-même si rien n'est trouvé — une
 * chaîne manquante doit être visible, pas silencieuse.
 */
export function localize(
  path: string,
  vars?: Record<string, string | number>,
  language = FALLBACK
): string {
  const found = lookup(catalogFor(language), path) ?? lookup(CATALOGS[FALLBACK], path);
  if (typeof found !== 'string') return path;
  if (!vars) return found;
  return found.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * Le catalogue d'une langue, variante régionale comprise.
 *
 * Home Assistant publie des variantes (`pt-BR`, `es-419`, `zh-Hans`) : sans
 * repli sur la langue de base, toute la carte parlait français à un
 * utilisateur brésilien, pendant que `Intl` lui mettait les dates en
 * portugais. Le français ne vient qu'en dernier.
 */
function catalogFor(language: string): Dict {
  return CATALOGS[language] ?? CATALOGS[language.split('-')[0] ?? ''] ?? CATALOGS[FALLBACK]!;
}

function lookup(dict: Dict | undefined, path: string): string | Dict | undefined {
  if (!dict) return undefined;
  return path.split('.').reduce<string | Dict | undefined>((acc, part) => {
    if (acc === undefined || typeof acc === 'string') return undefined;
    return acc[part];
  }, dict);
}
