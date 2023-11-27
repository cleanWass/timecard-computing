import {
  groupShiftsByWorkingPeriods,
  splitPeriodIntoWorkingPeriods,
} from '@application/timecard-computation/util/workingPeriodsComputation';
import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/employment-contract';
import {Leave} from '@domain/models/leave-recording/leave/leave';
import {LocalDateRange} from '@domain/models/local-date-range';
import {Shift} from '@domain/models/mission-delivery/shift/shift';
import {TimeCard} from '@domain/models/time-card-computation/time-card/TimeCard';
import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';
import {Duration} from '@js-joda/core';
import {TimecardComputationError} from '@shared/error/TimecardComputationError';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/function';
import {List, Map} from 'immutable';

const computeTotalHoursByWorkingPeriod = (groupedShifts: Map<WorkingPeriod, List<Shift>>) =>
  E.right(groupedShifts.map(gs => gs.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)));

const computeTotalAdditionalHours = (
  contracts: List<EmploymentContract>,
  totalWeekly: Map<WorkingPeriod, Duration>
) => {
  const totalAdditionalHoursMap = totalWeekly.reduce((acc, total, workingPeriod) => {
    const contract = contracts.find(c => c.id === workingPeriod.employmentContractId);
    return !contract ? acc : acc.set(workingPeriod, total.minus(contract.weeklyTotalWorkedHours));
  }, Map<WorkingPeriod, Duration>());
  return pipe(
    totalAdditionalHoursMap,
    E.fromPredicate(
      () => totalAdditionalHoursMap.size === totalWeekly.size,
      () => new TimecardComputationError('Missing contract')
    )
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
    E.bindW('totalAdditionalHours', ({totalWeekly}) => computeTotalAdditionalHours(contracts, totalWeekly)),
    E.map(({workingPeriods, groupedShifts, totalWeekly, totalAdditionalHours}) => {
      console.log(
        totalAdditionalHours
          .map(
            (total, wp) =>
              `${wp.period.toFormattedString()} T: ${totalWeekly.get(wp)?.toHours()}h AH: ${total.toHours()}h${total.toHours() %60}`
          ).valueSeq()
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
