import type { AllowedResponseCall, HassView } from './types';

/**
 * Les pièces jointes ouvertes au clic, partagées par les cartes devoirs et
 * notes. Sorti de `devoirs.ts` quand la carte notes a reçu le sujet et le
 * corrigé d'un devoir noté : les deux cartes présentent la même empreinte au
 * même service, et deux copies du filtre d'adresse auraient fini par
 * diverger — or c'est lui qui empêche une valeur de serveur d'atteindre une
 * barre d'adresse sans contrôle.
 */

/**
 * La forme d'une empreinte, telle que l'intégration la calcule : seize
 * chiffres hexadécimaux en minuscules. Tout le reste est refusé, et la
 * pastille reste muette plutôt que d'envoyer au service une chaîne de
 * serveur qu'il n'a pas produite.
 */
export const CLE_PIECE = /^[0-9a-f]{16}$/;


/**
 * Une adresse **ouvrable dans un navigateur**, ou rien.
 *
 * Le filtre de schéma n'est pas de la prudence décorative : cette valeur
 * vient du serveur et atterrit dans un attribut `href`. Un `javascript:` y
 * exécuterait du code dans la page Home Assistant de l'utilisateur, un
 * `data:` y servirait un document arbitraire. C'est le même raisonnement que
 * `subjectColor`, la seule autre valeur de serveur du projet qui atteigne un
 * attribut — on n'admet qu'une forme close, ici `http:` et `https:`.
 *
 * **Deux formes passent**, et la seconde a demandé deux mesures. Une adresse
 * absolue est admise telle quelle. Une adresse **enracinée** — exactement une
 * barre oblique initiale — est résolue contre l'origine de l'**instance**,
 * puis n'est admise que si elle y est restée. C'est la forme que
 * l'intégration publie pour les pièces qu'elle relaie elle-même, et le refus
 * n'était pas théorique : mesuré le 10 septembre 2026 sur une instance, seize
 * des vingt-trois pièces jointes portent un chemin enraciné signé, et la
 * carte les écartait toutes.
 *
 * **L'origine de l'instance, jamais celle du document.** La première version
 * résolvait contre `window.location.origin`, et c'était faux d'une manière
 * qui ne se voit pas sur une instance ordinaire : le tableau de bord Cast est
 * servi depuis une origine **tierce** et parle à Home Assistant par
 * WebSocket. Le lien fabriqué y pointait chez ce tiers — mort, et emportant
 * la signature dans son adresse. `hass.hassUrl` donne la bonne base ; le
 * défaut a été signalé par la session de l'intégration, et la forme du
 * champ vérifiée sur l'instance avant d'être écrite ici.
 *
 * **L'égalité d'origine ne se remplace pas par un test de préfixe**, et c'est
 * le seul point de cette fonction qui ne se devine pas. Mesuré : une valeur
 * qui commence par une barre oblique suivie d'une barre oblique **inverse**
 * est normalisée en autorité par l'analyseur d'URL — elle désigne donc un
 * autre hôte tout en satisfaisant « commence par une seule barre oblique ».
 * Seule la comparaison de `url.origin` **après** analyse l'attrape. Le refus
 * explicite de deux barres obliques en tête est un second verrou, redondant
 * exprès : mesuré, le retirer ne fait tomber aucun test, parce que l'égalité
 * d'origine l'attrape seule. C'est la définition d'un verrou redondant, pas
 * une lacune de couverture — et c'est écrit ici pour qu'on ne le retire pas au
 * motif qu'aucun test ne le défend.
 *
 * Une adresse sans schéma **et** sans barre oblique initiale reste refusée :
 * il faudrait la résoudre contre le chemin de la page courante, qui dépend de
 * la vue ouverte — la même pièce jointe donnerait deux adresses selon
 * l'endroit où la carte est posée. L'intégration n'en publie pas.
 */
export const instanceOrigin = (hass: HassView): string | undefined => {
  try {
    const brut = hass.hassUrl?.();
    if (typeof brut !== 'string' || brut === '') return undefined;
    const url = new URL(brut);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined;
  } catch {
    return undefined;
  }
};

export const openableUrl = (value: unknown, origine: string | undefined): string | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const brut = value.trim();
  const enracinee = brut.startsWith('/') && !brut.startsWith('//');
  // Sans origine d'instance connue, un chemin enraciné est refusé. Une
  // pastille muette est un moindre mal qu'une adresse devinée : c'est
  // exactement là que le jeton partirait chez un tiers.
  //
  // Cette ligne est explicite plus que nécessaire, et c'est mesuré : la
  // retirer seule ne fait tomber aucun test, parce que `new URL` lève déjà
  // sur une base absente. Ce qui est bel et bien couvert, c'est le
  // COMPORTEMENT — remplacer l'origine manquante par celle de la page fait
  // tomber le cas « refuse le chemin enraciné quand l’instance est inconnue ».
  if (enracinee && origine === undefined) return undefined;
  try {
    const url = new URL(brut, enracinee ? origine : undefined);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    // Le verrou : ce qui a été résolu contre notre origine doit y être resté.
    if (enracinee && url.origin !== origine) return undefined;
    return url.href;
  } catch {
    // Ni absolue, ni enracinée : rien à résoudre.
    return undefined;
  }
};

/**
 * Le premier des champs demandés qui porte quelque chose.
 *
 * `Reflect.get` plutôt qu'une assertion vers un dictionnaire : la valeur
 * arrive en `unknown` sans qu'on ait promis au compilateur une forme qu'on
 * n'a pas vérifiée. Les variantes de nom couvrent ce qu'une intégration
 * écrit naturellement, sans qu'on ait à deviner juste du premier coup.
 */
export const champ = (source: object, ...cles: string[]): unknown => {
  for (const cle of cles) {
    const valeur: unknown = Reflect.get(source, cle);
    if (valeur !== undefined && valeur !== null) return valeur;
  }
  return undefined;
};

/**
 * La phrase à dire quand le service refuse de rendre une adresse.
 *
 * Les deux clés sont un contrat avec l'intégration, qui s'est engagée à ne
 * pas les renommer sans prévenir : Home Assistant les transmet dans l'erreur
 * WebSocket, à côté d'un message déjà traduit dans la langue de l'instance.
 * La carte ne réutilise pas ce message, parce qu'il ne sait pas ce qu'il faut
 * faire ensuite ; les siens le disent.
 *
 * - `attachment_not_collected` : l'élève n'a pas encore d'instantané. C'est
 *   temporaire, il n'y a rien à faire qu'attendre.
 * - `attachment_unknown` : l'instantané existe et la pièce n'y est plus — le
 *   devoir a tourné depuis l'affichage. Rafraîchir la carte suffit.
 *
 * Toute autre erreur rend une phrase générique : un code inconnu ne mérite
 * pas une explication inventée.
 */
export const messageDeRefus = (erreur: unknown, messages: AttachmentMessages): string => {
  const cle =
    erreur !== null && typeof erreur === 'object' ? champ(erreur, 'translation_key') : undefined;
  if (cle === 'attachment_not_collected') return messages.notCollected;
  if (cle === 'attachment_unknown') return messages.unknown;
  return messages.failed;
};

/** Les phrases propres à la carte qui ouvre la pièce. */
export interface AttachmentMessages {
  notCollected: string;
  unknown: string;
  failed: string;
  blocked: string;
}

/**
 * Ouvre une pièce de type fichier : demande son adresse au service, au
 * clic, et jamais avant. Rend `undefined` quand l'onglet a reçu l'adresse,
 * sinon la phrase à afficher sous les pastilles.
 *
 * **L'onglet s'ouvre AVANT l'appel**, vide, puis reçoit l'adresse. Dans
 * l'ordre inverse, `window.open` arrive après un `await` et n'est plus
 * rattaché au geste de l'utilisateur : Safari le bloque sans un mot, et
 * Chrome ne le tolère que quelques secondes. Ouvrir d'abord, c'est le seul
 * ordre qui marche partout.
 *
 * `noopener` ne peut pas se passer à l'ouverture — `window.open` rendrait
 * alors `null`, et on n'aurait plus d'onglet à diriger. On coupe donc le
 * lien à la main, avant d'y écrire quoi que ce soit.
 *
 * L'adresse rendue repasse par `openableUrl`, exactement comme celle d'un
 * attribut : elle vient du serveur, et elle va dans une barre d'adresse.
 * Elle n'est retenue nulle part — ni en mémoire, ni dans le rendu — et
 * c'est voulu : elle expire en cinq minutes, et un second clic en frappe
 * une autre.
 */
export const openAttachment = async (
  ctx: {
    callForResponse(call: AllowedResponseCall, data: Record<string, unknown>): Promise<unknown>;
  },
  deviceId: string,
  key: string,
  origin: string | undefined,
  messages: AttachmentMessages
): Promise<string | undefined> => {
  const onglet = window.open('', '_blank');
  if (onglet) onglet.opener = null;
  let message: string;
  try {
    const reponse = await ctx.callForResponse('carnet_scolaire.get_attachment_url', {
      device_id: deviceId,
      key,
    });
    const url =
      reponse !== null && typeof reponse === 'object'
        ? openableUrl(champ(reponse, 'url'), origin)
        : undefined;
    if (url !== undefined && onglet) {
      onglet.location.replace(url);
      return undefined;
    }
    message = url === undefined ? messages.failed : messages.blocked;
  } catch (erreur) {
    message = messageDeRefus(erreur, messages);
  }
  onglet?.close();
  return message;
};
