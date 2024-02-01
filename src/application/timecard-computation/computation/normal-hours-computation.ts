import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { formatDurationAs100, getTotalDuration } from '../../../~shared/util/joda-helper';

export const normalHoursComputation = (timecard: WorkingPeriodTimecard) =>
  timecard.register('TotalWeekly', getTotalDuration(timecard.shifts));

export const computeLeavesHours = (timecard: WorkingPeriodTimecard) => {
  const computeDuration = (condition: (l: Leave) => boolean = () => true) => getTotalDuration(timecard.leaves.filter(condition));

  const leavesTotalDuration = computeDuration();
  const holidaysLeavesDuration = computeDuration(leave => leave.absenceType === 'HOLIDAY');
  const leavesPaidDuration = computeDuration(leave => leave.compensation === 'PAID');
  const leavesUnpaidDuration = computeDuration(leave => leave.compensation === 'UNPAID');

  return timecard
    .register('TotalLeaves', leavesTotalDuration)
    .register('TotalNationalHolidayLeaves', holidaysLeavesDuration)
    .register('TotalLeavesPaid', leavesPaidDuration)
    .register('TotalLeavesUnpaid', leavesUnpaidDuration);
};

export const computeTotalNormalHoursAvailable = (timecard: WorkingPeriodTimecard) =>
  timecard.register('TotalNormalAvailable', getTotalDuration(timecard.leaves.filter(leave => leave.compensation === 'PAID')));
