import { describe, expect, it } from 'vitest';
import { isCanceled, statusLabel } from '../src/core/lesson';

describe('isCanceled et statusLabel', () => {
  it('reconnaît une annulation dont le libellé porte des espaces autour', () => {
    // `statusLabel` rognait le libellé et le taisait, `isCanceled` ne le
    // rognait pas : avec une espace finale, le cours n'avait ni pastille ni
    // motif, et s'affichait comme un cours normal.
    const l = { canceled: false, status: 'Cours annulé ' };
    expect(isCanceled(l)).toBe(true);
    expect(statusLabel(l)).toBe('');
  });

  it('garde un motif qui dit autre chose que l’annulation', () => {
    const l = { canceled: true, status: ' Prof. absent ' };
    expect(isCanceled(l)).toBe(true);
    expect(statusLabel(l)).toBe('Prof. absent');
  });
});
