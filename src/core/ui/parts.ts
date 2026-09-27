import { html, nothing, type TemplateResult } from 'lit';
import type { EntityKey, EntityStatus, Translate } from '../types';
import { subjectColor } from '../subject-color';

export type Tone = 'neutral' | 'ok' | 'warn' | 'problem';

export const chip = (label: string, tone: Tone = 'neutral'): TemplateResult =>
  html`<span class="chip ${tone === 'neutral' ? '' : tone}">${label}</span>`;

/** État « vide » : l'information EST le vide. Message fourni par la carte. */
export const emptyState = (message: string): TemplateResult =>
  html`<div class="notice">${message}</div>`;

/** État « indisponible » : transitoire, pas une erreur. */
export const unavailableState = (t: Translate): TemplateResult =>
  html`<div class="notice">${t('common.unavailable')}</div>`;

/** État « entité absente » : demande une action de l'utilisateur. */
export const missingState = (keys: readonly string[], t: Translate): TemplateResult => html`
  <div class="notice problem">
    ${t('common.missing_body')} ${keys.map((k) => html`<code>${k}</code> `)}
  </div>
  <div class="notice">${t('common.missing_hint')}</div>
`;

/**
 * Ce qu'une carte doit dire à la place de son vide quand les sources d'une
 * section ne sont pas exploitables, ou `undefined` si elles le sont toutes.
 *
 * Le socle rend une carte dès qu'UNE de ses ancres est exploitable
 * (`requiresAny`). Une carte à sections peut donc être appelée alors que la
 * source de la section voulue est `unknown` ou absente du registre, et
 * conclure au vide (« Aucune note », « Rien à signaler ») pour une donnée
 * qui n'a simplement pas été collectée. Le vide n'appartient à la carte que
 * si ses sources sont là : sinon c'est l'un des deux états du socle, et la
 * carte le dit avec ses mots à lui. « Pas encore collectée » l'emporte sur
 * « introuvable », parce qu'une source au registre promet une donnée.
 *
 * `reportMissing` : une source absente du registre n'est signalée que pour
 * une section que l'utilisateur a **choisie**. Les sections par défaut sont
 * une offre, pas une demande : une instance qui ne publie pas les retards
 * n'a pas à se faire dire qu'ils sont introuvables, alors qu'elle affichait
 * jusqu'ici « Rien à signaler » sur les absences qu'elle publie.
 */
export const sourcesState = (
  status: (key: EntityKey) => EntityStatus,
  keys: readonly EntityKey[],
  t: Translate,
  reportMissing: boolean
): TemplateResult | undefined => {
  if (keys.some((k) => status(k) === 'unavailable')) return unavailableState(t);
  const missing = reportMissing ? keys.filter((k) => status(k) === 'missing') : [];
  return missing.length > 0 ? missingState(missing, t) : undefined;
};

/**
 * État « la carte a levé » : dernier filet, jamais un état normal.
 *
 * Sans lui, une exception dans `render()` laisse la racine d'ombre vide et la
 * carte disparaît de la page sans un mot — c'est exactement ce qui est arrivé
 * sur une instance réelle, sur deux cartes à la fois. Un message visible vaut
 * mieux qu'un trou dans le tableau de bord.
 */
export const errorState = (t: Translate): TemplateResult =>
  html`<div class="notice problem">${t('common.render_error')}</div>`;

export interface RowOptions {
  primary: string | TemplateResult;
  secondary?: string | TemplateResult;
  trailing?: string | TemplateResult;
  canceled?: boolean;
  /**
   * L'accent de couleur de la matière, et ses **trois** valeurs.
   *
   * - `undefined` : cette liste n'est pas codée par couleur. Aucune gouttière,
   *   aucun décalage — le rendu est exactement celui d'avant l'introduction de
   *   l'accent. C'est le cas du limiteur, de la cantine, de la vie scolaire et
   *   de l'élève, dont les lignes ne portent pas de matière.
   * - `null` : cette liste **est** codée par couleur, mais cette ligne-ci n'a
   *   pas de couleur exploitable. La gouttière est réservée, transparente.
   *   Sans ce troisième cas, un créneau sans couleur s'alignerait trois pixels
   *   à gauche de son voisin coloré, et ce décalage se lirait comme un défaut
   *   d'affichage plutôt que comme une absence de donnée.
   * - une couleur : la gouttière la prend.
   *
   * La valeur doit avoir traversé `subjectColor` : elle finit dans un attribut
   * `style`, où une chaîne de serveur non filtrée permettrait d'ajouter des
   * propriétés CSS arbitraires.
   */
  accent?: string | null;
  /**
   * La ligne en **bloc de deux niveaux** au lieu d'un flux à trois parties, et
   * ses deux valeurs.
   *
   * - `undefined` ou `false` : le flux d'origine — intitulé, contenu et partie
   *   finale se suivent sur une seule ligne, chacun pris dans la largeur que
   *   les autres lui laissent. C'est le cas de toutes les cartes sauf une.
   * - `true` : l'intitulé et la partie finale forment le **titre** du bloc, et
   *   le contenu passe **dessous, sur toute la largeur de la carte**.
   *
   * Le cas qui a créé cette option, les devoirs : mis en colonne à côté de la
   * matière, l'énoncé disposait de 132 pixels sur une carte de 420 et se
   * dépliait sur une dizaine de lignes. Or l'énoncé EST le contenu de la carte
   * — c'est ce qu'il y a à faire. Il passe donc devant l'alignement de la
   * colonne qui le comprimait.
   *
   * La ligne reste **une seule boîte** dans les deux cas : c'est elle qui
   * porte le trait de séparation entre deux entrées et la gouttière de
   * `accent`. Le titre est un élément interne, pas une ligne sœur.
   */
  stacked?: boolean;
}

/**
 * La ligne de liste, et le seul endroit qui pose la **gouttière** de couleur —
 * d'où le drapeau `stacked` plutôt qu'une seconde fonction à côté.
 *
 * Une `stackedRow` séparée aurait dû reproduire les trois valeurs de `accent`
 * (aucune gouttière, gouttière réservée, gouttière colorée) ainsi que le
 * filtrage de la valeur qui atteint l'attribut `style`. C'est exactement le
 * genre de copie qui dérive : **cinq** cartes placent la couleur de matière
 * ici, et le fait qu'une seule fonction s'en charge est ce qui les tient
 * identiques.
 *
 * Cinq et non six, et il faut le dire au lieu de l'arrondir : la vue journée
 * n'appelle pas `listRow`. Sa grille a ses propres colonnes et elle pose son
 * filet à la main. Une version antérieure de ce commentaire écrivait « six
 * cartes » et en concluait que la garantie couvrait tout le monde — faux, et
 * faux dans le sens le plus coûteux, puisqu'une garantie surestimée dispense
 * d'aller vérifier l'exception.
 *
 * Ce qui reste vraiment partagé avec la journée : la valeur passe des deux
 * côtés par `subjectColor` puis par la propriété personnalisée
 * `--pronote-subject-color`. C'est le **filtrage** qui est central, pas le
 * placement — une chaîne venue du serveur atteint un attribut `style`.
 */
export const listRow = (o: RowOptions): TemplateResult => {
  const primary = html`<span class="primary">${o.primary}</span>`;
  const secondary = o.secondary ? html`<span class="secondary">${o.secondary}</span>` : '';
  const trailing = o.trailing ? html`<span class="trailing">${o.trailing}</span>` : '';
  // Refiltrée ici même : la valeur atteint un attribut `style`, et la seule
  // garantie était jusqu'ici un commentaire demandant à l'appelant de l'avoir
  // fait. Filtrer une valeur déjà filtrée ne coûte rien.
  const color = subjectColor(o.accent);
  // Une ligne codée par couleur mais sans couleur exploitable est marquée
  // NEUTRE : `--pronote-subject-color` est une propriété héritée, et un thème
  // qui la pose plus haut colorait sinon toutes ces lignes (voir
  // `.row.accented.accent-neutre` dans styles.ts).
  const neutre = o.accent !== undefined && color === undefined;
  return html`
    <div
      class="row ${o.canceled ? 'canceled' : ''} ${
        o.accent === undefined ? '' : 'accented'
      } ${neutre ? 'accent-neutre' : ''} ${o.stacked === true ? 'empile' : ''}"
      style=${color === undefined ? nothing : `--pronote-subject-color: ${color}`}
    >
      ${
        o.stacked === true
          ? // L'ordre du DOM est l'ordre visuel : titre puis contenu. Un `order`
            // en CSS aurait donné le même rendu en laissant le DOM mentir sur la
            // position — donc un test de placement qui passe alors que le
            // lecteur d'écran lit l'énoncé avant sa matière.
            html`<div class="empile-tete">${primary}${trailing}</div>
              ${secondary}`
          : html`${primary}${secondary}${trailing}`
      }
    </div>
  `;
};
