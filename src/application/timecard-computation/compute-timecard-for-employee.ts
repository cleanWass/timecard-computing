import {divideIntoPeriods} from '@application/timecard-computation/util/divideIntoPeriods';
import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/employment-contract';
import {Leave} from '@domain/models/leave-recording/leave/leave';
import {LocalDateRange} from '@domain/models/local-date-range';
import {Shift} from '@domain/models/mission-delivery/shift/shift';
import {TimeCard} from '@domain/models/time-card-computation/time-card/TimeCard';
import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';
import {TimecardComputationError} from '@shared/error/TimecardComputationError';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/function';
import {List, Map, Set} from 'immutable';

type AffectationGroupedByPeriod = Map<
  LocalDateRange,
  | Map<'shifts', Array<Shift>>
  | Map<'leaves', Array<Leave>>
  | Map<'contract', EmploymentContract>
>;

const throwIfNoContract = <T>(list: List<T>) =>
  list.isEmpty()
    ? E.left(new TimecardComputationError('No contract matches this period'))
    : E.right(list);

const filterContractsForPeriod =
  (period: LocalDateRange) => (contracts: List<EmploymentContract>) =>
    contracts.filter(contract => contract.period(period.end).overlaps(period));

const computeWorkingPeriods = (period: LocalDateRange) => {
  return (contracts: List<EmploymentContract>) => {
    return pipe(
      contracts,
      E.fromPredicate(
        crts => !crts.isEmpty(),
        () => new TimecardComputationError('No contract matches this period')
      ),
      E.map(crts =>
        crts.reduce((wps, crt) => {
          const commonRange = crt.period(period.end).commonRange(period);
          return !!commonRange ? wps.concat(divideIntoPeriods(
            crt,
            commonRange.start,
            commonRange.end
          )) : wps;
        }, List<WorkingPeriod>())
      )
    );
  };
};

// contracts.reduce((workingPeriods, contract) => {
//   const commonRange = contract.period(period.end).commonRange(period);
//   if (!commonRange) return workingPeriods;
//   return workingPeriods.concat(
//     pipe(
//       divideIntoPeriods(contract, commonRange.start, commonRange.end),
//       E.match(
//         e => List(),
//         wps => wps
//       )
//     )
//   );
// }, List<WorkingPeriod>());
// divideIntoPeriods(contracts, period.start, period.end);

export const dividePeriodAndGroupByContract: (
  period: LocalDateRange,
  contracts: List<EmploymentContract>,
  shifts: List<Shift>,
  leaves: List<Leave>
) => E.Either<
  TimecardComputationError,
  Map<EmploymentContract, Set<LocalDateRange>>
> = (period, contracts, shifts, leaves) => {
  pipe(
    contracts,
    filterContractsForPeriod(period),
    throwIfNoContract,
    E.map(contracts => computeWorkingPeriods(period)(contracts)),
    E.map(workingPeriods =>
      workingPeriods.reduce(
        (acc, workingPeriod) =>
          acc.update(
            workingPeriod,
            {shifts: List<Shift>(), leaves: List<Leave>()},
            affectations => ({
              ...affectations,
              shifts: shifts.filter(shift =>
                workingPeriod.period.includesDate(shift.startTime.toLocalDate())
              ),
            })
          ),
        Map<WorkingPeriod, {shifts: List<Shift>; leaves: List<Leave>}>()
      )
    ),
    E.map(e => {
      e.sortBy((a, b) => b.period.start.toString()).forEach((lis, w) => {
        console.log(`working period : ${w.period.toFormattedString()}`);
        console.log('-------');
        lis.leaves.forEach(leave =>
          console.log(
            `leave : ${leave.startTime.toString()} ${leave.duration.toString()}`
          )
        );
        lis.shifts.forEach(shift =>
          console.log(
            `shifts : ${shift.startTime.toString()} ${shift.duration.toString()}`
          )
        );
        console.log(
          'total week',
          lis.shifts.reduce((acc, sh) => acc + sh.duration.toMinutes(), 0) / 60,
          ' / ',
          (contracts
            .find(c => c.id === w.employmentContractId)
            ?.weeklyTotalWorkedHours.toMinutes() || 0) / 60,
          'h'
        );
      });
    })
  );
  return E.right(Map<EmploymentContract, Set<LocalDateRange>>());
};

export const splitPeriodIntoWorkingPeriods = (
  contracts: List<EmploymentContract>,
  period: LocalDateRange
) =>
  pipe(
    contracts,
    filterContractsForPeriod(period),
    throwIfNoContract,
    E.flatMap(computeWorkingPeriods(period))
  );

export const computeTimecardForEmployee: (
  employeeId: string,
  period: LocalDateRange,
  shifts: List<Shift>,
  leaves: List<Leave>,
  contracts: List<EmploymentContract>
) => E.Either<TimecardComputationError, TimeCard> = (
  employeeId,
  period,
  shifts,
  leaves,
  contracts
) => {
  pipe(
    E.Do,
    E.bind('workingPeriods', () =>
      splitPeriodIntoWorkingPeriods(contracts, period)
    ),
    E.bind('groupedShifts', ({workingPeriods}) => E.right(1))
  );
  // const test = pipe(
  //   period,
  //   divideIntoPeriods(contracts),
  // )
  return E.left(new TimecardComputationError('Not implemented'));
};

// TODO
// - [ ] filter contracts
// - [ ] filter shifts
// - [ ] filter leaves
// - [ ] group shifts by contract
// - [ ] group leaves by contract
// - [ ] divide contract period into periods
// - [ ] match shift and leaves to periods
// - [ ] determiner complement d'heures, heures complementaires, heures supplementaires
// - [ ] ressortir les heures majorées (nuit, dimanche, férié)
// - [ ] calculer les tickets restaurants
// - [ ] computeTimecardForEmployee
