import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { ModulationDataWorkingPeriodCard } from '../../../domain/models/modulation-data/modulation-data-working-period-card';
import { getTotalDuration } from '../../../~shared/util/joda-helper';

export const computeModulationWorkedHours = (timecard: ModulationDataWorkingPeriodCard) =>
  timecard.register('TotalWeekly', getTotalDuration(timecard.shifts));

export const computeModulationLeavesHours = (timecard: ModulationDataWorkingPeriodCard) => {
  const computeDuration = (condition: (l: Leave) => boolean = () => true) =>
    getTotalDuration(timecard.leaves.filter(condition));

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

export const computeTotalNormalHoursAvailable = (timecard: ModulationDataWorkingPeriodCard) =>
  timecard.register(
    'TotalNormalAvailable',
    getTotalDuration(
      timecard.leaves.filter(
        leave => leave.compensation === 'PAID' && leave.absenceType === 'HOLIDAY'
      )
    )
  );
