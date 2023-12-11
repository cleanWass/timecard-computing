import { Duration } from '@js-joda/core';

import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List, Map } from 'immutable';
import { EmploymentContract } from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LeavePeriod } from '../../../domain/models/leave-recording/leave/leave-period';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../../~shared/error/TimecardComputationError';

export const computeTotalHoursByWorkingPeriod = (groupedShifts: Map<WorkingPeriod, List<Shift>>) =>
  E.right(groupedShifts.map(gs => gs.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)));

export const computeTotalSupplementaryHours = (contracts: List<EmploymentContract>, totalWeekly: Map<WorkingPeriod, Duration>) => {
  const totalSupplementaryHoursMap = totalWeekly.reduce((acc, total, workingPeriod) => {
    const contract = contracts.find(c => c.id === workingPeriod.employmentContractId);
    if (!contract?.isFullTime()) return acc.set(workingPeriod, Duration.ZERO);
    return !contract
      ? acc
      : acc.set(workingPeriod, Duration.ofMinutes(Math.max(0, total.toMinutes() - contract.weeklyTotalWorkedHours.toMinutes())));
  }, Map<WorkingPeriod, Duration>());
  return pipe(
    totalSupplementaryHoursMap,
    E.fromPredicate(
      () => totalSupplementaryHoursMap.size === totalWeekly.size,
      () => new TimecardComputationError('Missing contract')
    )
  );
};

export const computeSupplementaryHours: WPTimecardComputation = contract => timecard =>
  contract?.isFullTime()
    ? timecard.register(
        'TotalSupplementary',
        Duration.ofMinutes(Math.max(0, timecard.workedHours.get('TotalWeekly').toMinutes() - contract.weeklyTotalWorkedHours.toMinutes()))
      )
    : timecard;

// todo fetch rating from contract
export const divideSupplementaryHoursByRating: WPTimecardComputation = contract => timecard => {
  const supplementaryHours = timecard.workedHours.TotalSupplementary;

  const _25PerCentRateHours = Duration.ofMinutes(Math.min(supplementaryHours.toMinutes(), Duration.ofHours(8).toMinutes()));
  const _50PerCentRateHours = supplementaryHours.minus(_25PerCentRateHours);
  return timecard
    .register('TwentyFivePercentRateSupplementary', _25PerCentRateHours)
    .register('FiftyPercentRateSupplementary', _50PerCentRateHours);
};

type WPTimecardComputation = (contract: EmploymentContract) => (timecard: WorkingPeriodTimecard) => WorkingPeriodTimecard;
