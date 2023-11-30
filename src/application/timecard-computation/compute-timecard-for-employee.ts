import {
  groupShiftsByWorkingPeriods,
  splitPeriodIntoWorkingPeriods,
} from '@application/timecard-computation/util/workingPeriodsComputation';
import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/employment-contract';
import {Leave} from '@domain/models/leave-recording/leave/leave';
import {LocalDateRange} from '@domain/models/local-date-range';
import {Shift} from '@domain/models/mission-delivery/shift/shift';
import {TimeCard, WorkingPeriodTimecard} from '@domain/models/time-card-computation/time-card/TimeCard';
import {WorkedHoursRate} from '@domain/models/time-card-computation/time-card/WorkedHoursRate';
import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';
import {Duration, TemporalUnit} from '@js-joda/core';
import {TimecardComputationError} from '@shared/error/TimecardComputationError';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/function';
import {List, Map} from 'immutable';

const computeTotalHoursByWorkingPeriod = (groupedShifts: Map<WorkingPeriod, List<Shift>>) =>
  E.right(groupedShifts.map(gs => gs.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)));

const computeTotalHours = (shifts: List<Shift>) => (timecard: WorkingPeriodTimecard) =>
  timecard.workedHours.set(
    'TotalWeekly',
    shifts.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)
  );

const computeAdditionalHours = (
  timecard: WorkingPeriodTimecard,
  contract: EmploymentContract
  // contracts: List<EmploymentContract>,
  // totalWeekly: Map<WorkingPeriod, Duration>
) => {
  if (contract?.isFullTime()) return timecard;

  return timecard.register(
    'TotalComplementary',
    Duration.ofMinutes(
      Math.max(0, timecard.workedHours.get('TotalWeekly').toMinutes() - contract.weeklyTotalWorkedHours.toMinutes())
    )
  );
};

const computeTotalSupplementaryHours = (
  contracts: List<EmploymentContract>,
  totalWeekly: Map<WorkingPeriod, Duration>
) => {
  const totalSupplementaryHoursMap = totalWeekly.reduce((acc, total, workingPeriod) => {
    const contract = contracts.find(c => c.id === workingPeriod.employmentContractId);
    if (!contract?.isFullTime()) return acc.set(workingPeriod, Duration.ZERO);
    return !contract
      ? acc
      : acc.set(
          workingPeriod,
          Duration.ofMinutes(Math.max(0, total.toMinutes() - contract.weeklyTotalWorkedHours.toMinutes()))
        );
  }, Map<WorkingPeriod, Duration>());
  return pipe(
    totalSupplementaryHoursMap,
    E.fromPredicate(
      () => totalSupplementaryHoursMap.size === totalWeekly.size,
      () => new TimecardComputationError('Missing contract')
    )
  );
};
const findContract = (contracts: List<EmploymentContract>, workingPeriod: WorkingPeriod) =>
  pipe(
    contracts.find(c => c.id === workingPeriod.employmentContractId),
    E.fromNullable(() => new TimecardComputationError('Missing contract'))
  );

const initializeWorkingPeriodTimecard = (workingPeriod: WorkingPeriod) =>
  WorkingPeriodTimecard.build({
    contractId: workingPeriod.employmentContractId,
    employeeId: workingPeriod.employeeId,
    workingPeriod: workingPeriod,
    workedHours: Map<WorkedHoursRate, Duration>(),
  });
// write a function that takes a working period, shifts and leaves and returns a working period timecard
export const computeWorkingPeriodTimecard: (
  workingPeriod: WorkingPeriod,
  shifts: List<Shift>,
  leaves: List<Leave>,
  contract: EmploymentContract
) => E.Either<TimecardComputationError, WorkingPeriodTimecard> = (workingPeriod, shifts, leaves, contracts) => {
  const wpTimecard = WorkingPeriodTimecard.build({
    contractId: workingPeriod.employmentContractId,
    employeeId: workingPeriod.employeeId,
    workingPeriod: workingPeriod,
    workedHours: Map<WorkedHoursRate, Duration>(),
  });
  pipe(
    workingPeriod,
    initializeWorkingPeriodTimecard,
    computeTotalHours(shifts),
    computeAdditionalHours(contracts, totalWeekly)
    // computeTotalHours({workingPeriod, shifts, contract})),
    // E.map(tc => tc )
  );
};

export const computeTimecardForEmployee: (
  employeeId: string,
  period: LocalDateRange,
  shifts: List<Shift>,
  leaves: List<Leave>,
  contracts: List<EmploymentContract>
) => E.Either<TimecardComputationError, TimeCard> = (employeeId, period, shifts, leaves, contracts) => {
  pipe(
    E.Do,
    E.bind('workingPeriods', () => splitPeriodIntoWorkingPeriods(contracts, period)),
    E.bindW('groupedShifts', ({workingPeriods}) => groupShiftsByWorkingPeriods(shifts, workingPeriods)),
    E.bindW('groupedLeaves', () => E.right(Map<WorkingPeriod, List<Leave>>())),
    E.bindW('totalWeekly', ({groupedShifts}) => computeTotalHoursByWorkingPeriod(groupedShifts)),
    E.bindW('totalAdditionalHours', ({totalWeekly}) => computeAdditionalHours(contracts, totalWeekly)),
    E.bindW('totalSupplementaryHours', ({totalWeekly}) => computeTotalSupplementaryHours(contracts, totalWeekly)),
    E.map(({workingPeriods, groupedShifts, totalWeekly, totalAdditionalHours, totalSupplementaryHours}) => {
      console.log(
        totalAdditionalHours
          .map(
            (total, wp) =>
              `${wp.period.toFormattedString()} ${contracts
                .find(c => c.id === wp.employmentContractId)
                ?.weeklyTotalWorkedHours.toString()}
              TotalHours: ${totalWeekly.get(wp)?.toHours()}h${
                (totalWeekly.get(wp)?.toMinutes() || 0) % 60 > 0
                  ? `${(totalWeekly.get(wp)?.toMinutes() || 0) % 60} `
                  : ''
              }
              AdditionalHours: ${total.toHours()}h${total.toMinutes() % 60 > 0 ? `${total.toMinutes() % 60}` : ''}
              SupplementaryHours: ${totalSupplementaryHours.get(wp)?.toHours()}h${
                (totalSupplementaryHours.get(wp)?.toMinutes() || 0) % 60 > 0
                  ? `${(totalSupplementaryHours.get(wp)?.toMinutes() || 0) % 60}`
                  : ''
              }`
          )
          .valueSeq()
          .toArray()
          .join('\n')
      );
      return {
        employeeId,
        period,
        workingPeriods,
        groupedShifts,
        totalWeekly,
        totalAdditionalHours,
        totalSupplementaryHours,
      };
    })
  );

  return E.left(new TimecardComputationError('Not implemented'));
};

// TODO
// - [x] filter contracts
// - [x] filter shifts
// - [ ] filter leaves
// - [x] group shifts by contract
// - [ ] group leaves by contract
// - [X] divide contract period into periods
// - [X] match shift and leaves to periods
// - [ ] determiner complement d'heures, heures complementaires, heures supplementaires
// - [ ] ressortir les heures majorées (nuit, dimanche, férié)
// - [ ] calculer les tickets restaurants
// - [ ] computeTimecardForEmployee
