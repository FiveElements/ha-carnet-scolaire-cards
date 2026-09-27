/**
 * Les formateurs `Intl`, construits une fois par langue et par options.
 *
 * Construire un `Intl.DateTimeFormat` coûte cher : le moteur charge et
 * résout les données de la langue et du fuseau à chaque fois. Le socle et les
 * cartes en construisaient plusieurs par rendu — `resolveTimeZone` deux ou
 * trois, `formatTime` un par appel, donc un par ligne d'emploi du temps — et
 * un rendu a lieu à chaque changement d'état d'une entité suivie, multiplié
 * par le nombre de cartes de la vue.
 *
 * La clé est la langue plus les options sérialisées : les appelants écrivent
 * leurs options en littéraux, dans un ordre stable. Une construction qui lève
 * (fuseau ou langue que le moteur refuse) n'est **pas** mise en cache : elle
 * lève de nouveau à l'appel suivant, et c'est sur cette levée que
 * `resolveTimeZone` s'appuie pour écarter un fuseau. Le cache est borné : au-
 * delà de `LIMITE` entrées il repart de zéro, ce qui n'arrive qu'avec des
 * valeurs dynamiques qu'aucun appelant ne produit aujourd'hui.
 */
const LIMITE = 256;

function memo<F>(build: (locale: string | undefined, options: object) => F) {
  const cache = new Map<string, F>();
  return (locale: string | undefined, options: object = {}): F => {
    const cle = `${locale ?? ''}|${JSON.stringify(options)}`;
    const deja = cache.get(cle);
    if (deja !== undefined) return deja;
    const neuf = build(locale, options);
    if (cache.size >= LIMITE) cache.clear();
    cache.set(cle, neuf);
    return neuf;
  };
}

export const dateTimeFormat: (
  locale: string | undefined,
  options?: Intl.DateTimeFormatOptions
) => Intl.DateTimeFormat = memo((locale, options) => new Intl.DateTimeFormat(locale, options));

export const relativeTimeFormat: (
  locale: string | undefined,
  options?: Intl.RelativeTimeFormatOptions
) => Intl.RelativeTimeFormat = memo(
  (locale, options) => new Intl.RelativeTimeFormat(locale, options)
);

export const numberFormat: (
  locale: string | undefined,
  options?: Intl.NumberFormatOptions
) => Intl.NumberFormat = memo((locale, options) => new Intl.NumberFormat(locale, options));
