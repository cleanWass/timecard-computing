import {Duration} from '@js-joda/core';
import {EmploymentContract} from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import {WorkingPeriodTimecard} from '../../../domain/models/time-card-computation/time-card/WorkingPeriodTimecard';

export const computeComplementaryHours = (contract: EmploymentContract) => (timecard: WorkingPeriodTimecard) =>
  contract?.isFullTime()
    ? timecard
    : timecard.register(
        'TotalComplementary',
        Duration.ofMinutes(
          Math.max(0, timecard.workedHours.get('TotalWeekly').toMinutes() - contract.weeklyTotalWorkedHours.toMinutes())
        )
      );
