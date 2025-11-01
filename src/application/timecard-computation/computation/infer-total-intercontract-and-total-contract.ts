import { Duration } from '@js-joda/core';
import { WorkingPeriodTimecard } from '../../../domain/models/timecard-computation/timecard/working-period-timecard';
import { getGreaterDuration } from '../../../~shared/util/joda-helper';

export const inferTotalIntercontractAndTotalContract = (tc: WorkingPeriodTimecard) => {
  const totalHoursAffected = Duration.ZERO.plus(tc.workedHours.TotalWeekly)
    .plus(tc.workedHours.TotalLeaves)
    .plus(tc.workedHours.TotalInactiveShifts);
  const totalIntercontract = getGreaterDuration(
    tc.contract.weeklyTotalWorkedHours.minus(totalHoursAffected),
    Duration.ZERO
  );
  const totalContract = getGreaterDuration(
    totalHoursAffected.minus(tc.workedHours.TotalAdditionalHours),
    Duration.ZERO
  );
  return tc
    .register('TotalIntercontract', totalIntercontract)
    .register('TotalContract', totalContract);
};
