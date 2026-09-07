import {
  formatHeightCm,
  isContentEditableStatus,
  lastReviewComment,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  workflowActionLabel,
} from './admin.models';

/**
 * F3 — helpers puros del modelo de producto que la Editor UI consume para
 * derivar estado editable, comentarios de revisión y presentación.
 */
describe('admin.models (F3 helpers)', () => {
  it('PRODUCT_STATUSES cubre los 7 estados del backend con etiqueta', () => {
    expect([...PRODUCT_STATUSES].sort()).toEqual(
      ['APPROVED', 'ARCHIVED', 'CHANGES_REQUESTED', 'DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'].sort(),
    );
    for (const s of PRODUCT_STATUSES) expect(PRODUCT_STATUS_LABELS[s]).toBeTruthy();
  });

  it('isContentEditableStatus: DRAFT / REJECTED / CHANGES_REQUESTED editables; el resto no', () => {
    expect(isContentEditableStatus('DRAFT')).toBe(true);
    expect(isContentEditableStatus('REJECTED')).toBe(true);
    expect(isContentEditableStatus('CHANGES_REQUESTED')).toBe(true);
    for (const s of ['PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] as const) {
      expect(isContentEditableStatus(s)).toBe(false);
    }
  });

  it('lastReviewComment: última entrada request_changes/reject del historial; cae a rejectionReason', () => {
    expect(
      lastReviewComment({
        workflowHistory: [
          { action: 'submit', toStatus: 'PENDING_REVIEW' },
          { action: 'request_changes', toStatus: 'CHANGES_REQUESTED', comment: 'Primera' },
          { action: 'resubmit', toStatus: 'PENDING_REVIEW' },
          { action: 'request_changes', toStatus: 'CHANGES_REQUESTED', comment: 'La más reciente' },
        ],
        rejectionReason: undefined,
      }),
    ).toBe('La más reciente');

    expect(lastReviewComment({ workflowHistory: [], rejectionReason: 'Motivo espejo' })).toBe('Motivo espejo');
    expect(lastReviewComment({ workflowHistory: undefined, rejectionReason: undefined })).toBeNull();
  });

  it('formatHeightCm: centímetros -> "1.87 m"; vacío si no hay dato', () => {
    expect(formatHeightCm(187)).toBe('1.87 m');
    expect(formatHeightCm(200)).toBe('2.00 m');
    expect(formatHeightCm(null)).toBe('');
    expect(formatHeightCm(undefined)).toBe('');
    expect(formatHeightCm(0)).toBe('');
  });

  it('workflowActionLabel: traduce acciones conocidas y deja pasar las desconocidas', () => {
    expect(workflowActionLabel('request_changes')).toBe('Cambios solicitados');
    expect(workflowActionLabel('publish')).toBe('Publicado');
    expect(workflowActionLabel('algo_raro')).toBe('algo_raro');
  });
});
