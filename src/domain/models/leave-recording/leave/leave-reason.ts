export type LeaveReason = 'PAID' | 'UNPAID' | 'HOLIDAY';

export type PaidLeaveReason =
  | 'HOLIDAY'
  | 'CLOSED_SITE'
  | 'COMMUTE INJURY'
  | 'FAMILY_LEAVE'
  | 'PAYED_LEAVE'
  | 'SICK_CHILD'
  | 'TRAINING_LEAVE';

export const isPaidLeaveReason = (reason: string): reason is PaidLeaveReason =>
  ['CLOSED_SITE', 'COMMUTE INJURY', 'FAMILY_LEAVE', 'PAYED_LEAVE', 'SICK_CHILD', 'TRAINING_LEAVE'].includes(reason);

export type UnpaidLeaveReason =
  | 'ILLNESS'
  | 'CONSERVATORY_LAID_OFF'
  | 'DISCIPLINARY_LAID_OFF'
  | 'LEAVE_ABSENCE_PAID'
  | 'MATERNITY_LEAVE'
  | 'PARENTAL_LEAVE'
  | 'PATERNITY_LEAVE'
  | 'SABBATICAL_LEAVE'
  | 'UNAUTHORIZED_LEAVE'
  | 'UNAUTHORIZED_LEAVE_UNPAID'
  | 'UNPAYED_LEAVE'
  | 'WORK_ILLNESS'
  | 'WORK_INJURY';

export const isUnpaidLeaveReason = (reason: string): reason is UnpaidLeaveReason =>
  [
    'ILLNESS',
    'CONSERVATORY_LAID_OFF',
    'DISCIPLINARY_LAID_OFF',
    'LEAVE_ABSENCE_PAID',
    'MATERNITY_LEAVE',
    'PARENTAL_LEAVE',
    'PATERNITY_LEAVE',
    'SABBATICAL_LEAVE',
    'UNAUTHORIZED_LEAVE_UNPAID',
    'UNAUTHORIZED_LEAVE',
    'UNPAYED_LEAVE',
    'WORK_ILLNESS',
    'WORK_INJURY',
  ].includes(reason);
