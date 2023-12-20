import { Duration } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { List, Map } from 'immutable';
import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../../domain/models/time-card-computation/working-period/working-period';

const computeTotalHoursByWorkingPeriod = (groupedShifts: Map<WorkingPeriod, List<Shift>>) =>
  E.right(groupedShifts.map(gs => gs.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)));

export const computeTotalHoursWorked = (timecard: WorkingPeriodTimecard) =>
  timecard.register(
    'TotalWeekly',
    timecard.shifts.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)
  );

export const computeLeavesHours = (timecard: WorkingPeriodTimecard) => {
  const computeDuration = (condition: (l: Leave) => boolean = () => true) =>
    timecard.leaves.filter(condition).reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO);

  const leavesTotalDuration = computeDuration();
  const leavesPaidDuration = computeDuration(leave => ['Paid', 'Holiday'].includes(leave.reason));
  const leavesUnpaidDuration = computeDuration(leave => leave.reason === 'Unpaid');

  return timecard
    .register('TotalLeaves', leavesTotalDuration)
    .register('TotalLeavesPaid', leavesPaidDuration)
    .register('TotalLeavesUnpaid', leavesUnpaidDuration);
};

export const computeTotalNormalHoursAvailable = (timecard: WorkingPeriodTimecard) => {
  const normalHoursFromLeaves = timecard.leaves
    .filter(leave => leave.reason === 'Paid' || leave.reason === 'Holiday')
    .reduce((sum, shift) => sum.plus(shift.duration), Duration.ZERO);

  // POURQUOI CA MARCHE PAS
  // const normalHoursFromTheoreticalShifts = timecard.theoreticalShift.reduce((sum, shift) => sum.plus(shift.duration), Duration.ZERO);

  return timecard.register('TotalNormalAvailable', normalHoursFromLeaves);
};
