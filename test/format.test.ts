import { describe, expect, it } from 'vitest';
import {
  compareInstants,
  formatTimeWithDay,
  durationToMinutes,
  formatDayLabel,
  formatDuration,
  plainText,
  formatGrade,
  formatRelative,
  formatTime,
  parseTimestamp,
} from '../src/core/format';

const TZ = 'Europe/Paris';

describe('parseTimestamp', () => {
  it('accepte un ISO 8601 avec décalage', () => {
    expect(parseTimestamp('2026-09-08T08:30:00+02:00')?.getTime()).toBe(
      Date.parse('2026-09-08T06:30:00Z')
    );
  });
  it('rend undefined pour unknown, unavailable et vide', () => {
    expect(parseTimestamp('unknown')).toBeUndefined();
    expect(parseTimestamp('unavailable')).toBeUndefined();
    expect(parseTimestamp('')).toBeUndefined();
    expect(parseTimestamp(undefined)).toBeUndefined();
  });
});

describe('compareInstants', () => {
  it('ordonne sur l’instant, pas sur la chaîne', () => {
    // 08:00+02:00 (06:00 UTC) est AVANT 07:00Z, bien que la chaîne soit plus grande.
    expect(compareInstants('2026-09-08T08:00:00+02:00', '2026-09-08T07:00:00Z')).toBeLessThan(0);
  });
  it('place une valeur illisible avant toutes les autres, sans NaN', () => {
    expect(compareInstants(undefined, '2026-09-08')).toBeLessThan(0);
    expect(compareInstants('2026-09-08', 'pas une date')).toBeGreaterThan(0);
    expect(compareInstants(undefined, undefined)).toBe(0);
  });
});

describe('formatTimeWithDay', () => {
  const now = new Date('2026-09-25T20:00:00+02:00'); // un vendredi soir, à Paris
  it('rend l’heure seule le jour même', () => {
    expect(formatTimeWithDay('2026-09-25T22:30:00+02:00', 'fr', TZ, now)).toBe('22:30');
  });
  it('ajoute le jour quand l’instant tombe un autre jour', () => {
    // « Maths à 08:30 » un vendredi soir, pour le lundi, se lisait comme ce soir.
    expect(formatTimeWithDay('2026-09-28T08:30:00+02:00', 'fr', TZ, now)).toBe(
      '08:30, lundi 28 septembre'
    );
  });
  it('compare les jours dans le fuseau d’affichage, pas en UTC', () => {
    // 00:30 à Paris le 26 est encore le 25 en UTC : c'est bien un autre jour.
    expect(formatTimeWithDay('2026-09-26T00:30:00+02:00', 'fr', TZ, now)).toBe(
      '00:30, samedi 26 septembre'
    );
  });
  it('ne rend rien pour une valeur absente', () => {
    expect(formatTimeWithDay(undefined, 'fr', TZ, now)).toBe('');
  });
});

describe('formatTime', () => {
  it('rend une heure locale sur 24 h dans le fuseau demandé', () => {
    expect(formatTime('2026-09-08T08:30:00+02:00', 'fr', TZ)).toBe('08:30');
  });
  it('rend une chaîne vide pour une date absente', () => {
    expect(formatTime(undefined, 'fr', TZ)).toBe('');
  });
});

describe('formatDayLabel', () => {
  it('rend un libellé de jour dans le fuseau demandé', () => {
    // Chaîne relevée en exécutant le formateur (ICU Node) plutôt que devinée.
    expect(formatDayLabel('2026-09-08T08:30:00+02:00', 'fr', TZ)).toBe('mardi 8 septembre');
  });
  it('rend une chaîne vide pour une date absente', () => {
    expect(formatDayLabel(undefined, 'fr', TZ)).toBe('');
  });
  it('lit une date seule comme un jour, pas comme minuit UTC, y compris à décalage négatif', () => {
    // `new Date('2026-09-10')` vaut minuit UTC : reprojeté à la Martinique
    // (UTC−4), il reculait au 9. C'est la forme que l'intégration publie
    // pour la date d'une évaluation et pour l'échéance d'un devoir.
    expect(formatDayLabel('2026-09-10', 'fr', 'America/Martinique')).toBe('jeudi 10 septembre');
    expect(formatDayLabel('2026-09-10', 'fr', 'Pacific/Kiritimati')).toBe('jeudi 10 septembre');
    // Assertion positive appariée : un horodatage suit toujours le fuseau.
    expect(formatDayLabel('2026-09-10T01:00:00+02:00', 'fr', 'America/Martinique')).toBe(
      'mercredi 9 septembre'
    );
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-09-08T08:00:00+02:00');
  it('rend « dans 30 min » pour une échéance proche', () => {
    expect(formatRelative('2026-09-08T08:30:00+02:00', 'fr', now)).toBe('dans 30 min');
  });
  it('rend « dans 2 h » au-delà de l’heure', () => {
    expect(formatRelative('2026-09-08T10:00:00+02:00', 'fr', now)).toBe('dans 2 h');
  });
  it('rend « il y a 15 min » pour le passé', () => {
    expect(formatRelative('2026-09-08T07:45:00+02:00', 'fr', now)).toBe('il y a 15 min');
  });
  it('rend « maintenant » sous la minute', () => {
    expect(formatRelative('2026-09-08T08:00:30+02:00', 'fr', now)).toBe('maintenant');
  });
  it('dérive le mot « maintenant » de la langue plutôt que de le figer en français', () => {
    // Chaîne relevée en exécutant Intl.RelativeTimeFormat('it', ...) plutôt que devinée.
    expect(formatRelative('2026-09-08T08:00:30+02:00', 'it', now)).toBe('ora');
  });
});

describe('formatGrade', () => {
  it('rend note et barème', () => {
    expect(formatGrade(14.5, 20)).toBe('14,5/20');
  });
  it('rend la note seule sans barème', () => {
    expect(formatGrade(14.5, undefined)).toBe('14,5');
  });
  it('rend un tiret pour une note absente', () => {
    expect(formatGrade(undefined, 20)).toBe('—');
  });
  it('formate une note reçue comme chaîne (état hass) comme un nombre', () => {
    expect(formatGrade('14.5', 20)).toBe('14,5/20');
  });
  it('rend un tiret pour l’état hass "unknown"', () => {
    expect(formatGrade('unknown', 20)).toBe('—');
  });
  it('rend un tiret pour l’état hass "unavailable"', () => {
    expect(formatGrade('unavailable', 20)).toBe('—');
  });
  it('laisse passer une note textuelle non numérique telle quelle', () => {
    // « Absent/20 » se lit mal, et c'est assumé : ce cas n'est PAS atteignable
    // depuis cette intégration. Vérifié dans son modèle — `Grade.value` est
    // `float | None` et `value`/`status` sont mutuellement exclusifs par
    // conception, « pour qu'un déclencheur numeric_state fonctionne » ; une
    // sentinelle laisse l'état à `unknown` avec le motif en attribut. Idem
    // pour `overall_average`, un `float | None`.
    //
    // La tolérance reste, parce qu'un autre producteur pourrait poser une
    // chaîne et qu'un rendu maladroit vaut mieux qu'un tiret qui effacerait
    // l'information. Mais ne bâtissez rien sur cette forme, et ne la
    // « corrigez » pas en croyant réparer un défaut visible : il n'est visible
    // nulle part.
    expect(formatGrade('Absent', 20)).toBe('Absent/20');
  });

  /**
   * Le barème absent va devenir le chemin NORMAL, pas un cas limite.
   *
   * L'intégration publie aujourd'hui `out_of: 20` en littéral sur les deux
   * moyennes générales — une constante lue de nulle part, donc fausse sur un
   * établissement qui note sur une autre échelle. Le producteur la remplace
   * par la valeur réelle quand le protocole la porte, et par `null` sinon.
   *
   * Ces deux tests figent le comportement attendu ce jour-là : la valeur
   * seule, sans dénominateur inventé. Ils passent déjà — le garde-fou existe
   * dans `formatGrade` sans que la signature ne l'exige — et c'est
   * précisément pour ça qu'ils sont écrits : ce que le type ne garantit pas,
   * un test doit le vérifier.
   */
  it('rend la valeur seule quand le barème est null', () => {
    // `null` traverse `ctx.attr`, qui annonce `T | undefined` et rend ce que
    // l'attribut contient : à l'exécution, un `null` JSON reste un `null`
    // pendant que TypeScript croit lire un nombre.
    expect(formatGrade(13.5, null)).toBe('13,5');
  });

  it('rend la valeur seule quand le barème est une chaîne vide', () => {
    expect(formatGrade(13.5, '')).toBe('13,5');
  });

  describe('language', () => {
    it('respecte la langue demandée', () => {
      expect(formatGrade(14.5, 20, 'it')).toBe('14,5/20');
      expect(formatGrade(14.5, 20, 'pt')).toBe('14,5/20');
      expect(formatGrade(14.5, 20, 'es')).toBe('14,5/20');
    });
    it("retombe sur 'fr' quand la langue n'est pas fournie — ne casse pas les appelants existants", () => {
      expect(formatGrade(14.5, 20)).toBe(formatGrade(14.5, 20, 'fr'));
    });
  });
});

describe('plainText', () => {
  // Forme réelle d'un énoncé de devoir : l'intégration recopie le HTML de
  // PRONOTE. La carte l'affichait tel quel, et le parent lisait les balises.
  const enonce =
    '<div>Prenez votre cahier.<br>\nPour rappel, il vous faudra le livre &quot;Titre&quot;, pensez à l&#039;acheter !</div>';

  it('retire les balises et décode les entités', () => {
    const out = plainText(enonce);
    expect(out).toContain('Prenez votre cahier.');
    expect(out).toContain('il vous faudra le livre "Titre", pensez à l\'acheter !');
    expect(out).not.toContain('<');
    expect(out).not.toContain('&#039;');
    expect(out).not.toContain('&quot;');
  });

  it('garde un retour à la ligne là où le balisage en posait un', () => {
    expect(plainText(enonce).split('\n')).toHaveLength(2);
  });

  it('décode l’hexadécimal et laisse une entité inconnue telle quelle', () => {
    expect(plainText('a&#x27;b')).toBe("a'b");
    expect(plainText('&pasuneentite;')).toBe('&pasuneentite;');
  });

  it('ne rend rien sur une valeur absente ou vide', () => {
    expect(plainText(undefined)).toBe('');
    expect(plainText('<div></div>')).toBe('');
  });

  it('garde les chevrons d’un texte qui ne sont pas des balises', () => {
    expect(plainText('si a < b et c > d')).toBe('si a < b et c > d');
    // Assertion positive appariée : une vraie balise part toujours.
    expect(plainText('<b>gras</b> et 1 < 2')).toBe('gras et 1 < 2');
  });

  it('préfixe les puces d’une liste', () => {
    expect(plainText('<ul><li>un</li><li>deux</li></ul>')).toBe('• un\n• deux');
  });
});

describe('formatDuration', () => {
  it('ne rend rien sur un NaN, plutôt que « NaN h NaN »', () => {
    // `NaN < 0` et `NaN < 60` sont tous deux faux : sans garde-fou explicite,
    // un NaN traversait les deux tests et ressortait affiché sur la carte.
    expect(formatDuration(Number.NaN)).toBe('');
    expect(formatDuration(Number('2h00') * 60)).toBe('');
  });

  it('rend les minutes sous l’heure', () => {
    expect(formatDuration(45)).toBe('45 min');
  });
  it('rend heures et minutes au-delà', () => {
    expect(formatDuration(135)).toBe('2 h 15');
  });
  it('rend les heures rondes sans minutes', () => {
    expect(formatDuration(120)).toBe('2 h');
  });
  it('arrondit une durée non entière au lieu de rendre « 1 h 19.8 »', () => {
    expect(formatDuration(79.8)).toBe('1 h 20');
    expect(formatDuration(44.6)).toBe('45 min');
  });

  describe('language', () => {
    // Chaînes relevées en exécutant Intl.NumberFormat(langue, { style: 'unit', unitDisplay: 'short' })
    // (voir node -e dans le rapport de correctifs) plutôt que devinées : fr,
    // it, pt et es rendent tous la même abréviation d'heure et de minute en
    // affichage court.
    it('respecte la langue demandée pour les minutes', () => {
      expect(formatDuration(45, 'it')).toBe('45 min');
      expect(formatDuration(45, 'pt')).toBe('45 min');
      expect(formatDuration(45, 'es')).toBe('45 min');
    });
    it('respecte la langue demandée pour heures et minutes combinées', () => {
      expect(formatDuration(135, 'it')).toBe('2 h 15');
      expect(formatDuration(135, 'pt')).toBe('2 h 15');
      expect(formatDuration(135, 'es')).toBe('2 h 15');
    });
    it("retombe sur 'fr' quand la langue n'est pas fournie — ne casse pas les appelants existants", () => {
      expect(formatDuration(45)).toBe(formatDuration(45, 'fr'));
      expect(formatDuration(135)).toBe(formatDuration(135, 'fr'));
    });
  });
});

describe('durationToMinutes', () => {
  it('convertit les secondes que le capteur déclare en minutes', () => {
    expect(durationToMinutes('2700', 's')).toBe(45);
  });

  it('arrondit à la minute plutôt que de rendre une fraction', () => {
    // 1743 s = 29,05 min : la carte n'a que faire de la seconde près.
    expect(durationToMinutes('1743', 's')).toBe(29);
  });

  it('laisse les minutes telles quelles', () => {
    expect(durationToMinutes('135', 'min')).toBe(135);
  });

  it('convertit les heures en minutes', () => {
    expect(durationToMinutes('2', 'h')).toBe(120);
  });

  it("rend undefined quand l'unité est absente, plutôt que de supposer les minutes", () => {
    // C'est le cœur du correctif : supposer une unité produit une durée
    // plausible et fausse. L'appelant montre alors la valeur brute.
    expect(durationToMinutes('1743', undefined)).toBeUndefined();
  });

  it("rend undefined quand l'unité est inconnue", () => {
    expect(durationToMinutes('42', 'quinzaines')).toBeUndefined();
  });

  it('rend undefined sur un état non numérique, vide ou négatif', () => {
    expect(durationToMinutes('unavailable', 's')).toBeUndefined();
    expect(durationToMinutes('', 's')).toBeUndefined();
    expect(durationToMinutes(undefined, 's')).toBeUndefined();
    expect(durationToMinutes('-60', 's')).toBeUndefined();
  });
});
