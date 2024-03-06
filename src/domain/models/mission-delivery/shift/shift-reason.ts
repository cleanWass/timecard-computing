export const SHIFT_REASON = [
  'Permanent',
  'Ponctuel',
  'Absence',
  'Remplacement',
  'Intercontrat',
  'Maintien Partiel',
  'Prospective',
  'Inactive',
] as const;

export type ShiftReason = (typeof SHIFT_REASON)[number];
