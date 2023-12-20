import * as E from 'fp-ts/Either';
import { List, Map } from 'immutable';
import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../../domain/models/time-card-computation/working-period/working-period';
import { getTotalDuration } from '../../../~shared/util/joda-helper';

const computeTotalHoursByWorkingPeriod = (groupedShifts: Map<WorkingPeriod, List<Shift>>) => E.right(groupedShifts.map(getTotalDuration));

export const normalHoursComputation = (timecard: WorkingPeriodTimecard) =>
  timecard.register('TotalWeekly', getTotalDuration(timecard.shifts));

export const computeLeavesHours = (timecard: WorkingPeriodTimecard) => {
  const computeDuration = (condition: (l: Leave) => boolean = () => true) => getTotalDuration(timecard.leaves.filter(condition));

  const leavesTotalDuration = computeDuration();
  const leavesPaidDuration = computeDuration(leave => ['Paid', 'Holiday'].includes(leave.reason));
  const leavesUnpaidDuration = computeDuration(leave => leave.reason === 'Unpaid');

  return timecard
    .register('TotalLeaves', leavesTotalDuration)
    .register('TotalLeavesPaid', leavesPaidDuration)
    .register('TotalLeavesUnpaid', leavesUnpaidDuration);
};

export const computeTotalNormalHoursAvailable = (timecard: WorkingPeriodTimecard) =>
  timecard.register(
    'TotalNormalAvailable',
    getTotalDuration(timecard.leaves.filter(leave => leave.reason === 'Paid' || leave.reason === 'Holiday'))
  );
