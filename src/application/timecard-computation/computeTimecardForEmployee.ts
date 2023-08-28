import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/EmploymentContract';
import {Leave} from '@domain/models/leave-recording/leave/Leave';
import {LocalDateRange} from '@domain/models/localDateRange';
import {Shift} from '@domain/models/mission-delivery/shift/Shift';
import {TimeCard} from '@domain/models/time-card-computation/time-card/TimeCard';
import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';
import {Duration} from '@js-joda/core';
import {TimecardComputationError} from '@shared/error/TimecardComputationError';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {identity, pipe} from 'fp-ts/function';
import {List, Map, Set} from 'immutable';
import {divideIntoPeriods} from '@application/timecard-computation/util/divideIntoPeriods';

type AffectationGroupedByPeriod = Map<
  LocalDateRange,
  | Map<'shifts', Array<Shift>>
  | Map<'leaves', Array<Leave>>
  | Map<'contract', EmploymentContract>
>;

const throwLeftIfListIsEmpty = <T>(list: List<T>) =>
  list.isEmpty()
    ? E.left(new TimecardComputationError('No contract found'))
    : E.right(list);

const filterContractsForPeriod =
  (period: LocalDateRange) => (contracts: List<EmploymentContract>) =>
    contracts.filter(contract => contract.period(period.end).overlaps(period));

const getPeriods =
  (period: LocalDateRange) => (contracts: List<EmploymentContract>) =>
    contracts.reduce(
      (list, contract) =>
        list.concat(
          divideIntoPeriods(
            contract,
            period.start,
            period.end.isBefore(contract.period(period.end).end)
              ? period.end
              : contract.period(period.end).end
          )
        ),
      List<WorkingPeriod>()
    );
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
    throwLeftIfListIsEmpty,
    E.map(contracts => getPeriods(period)(contracts)),
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

export const computeTimecardForEmployee: (
  employeeId: string,
  period: LocalDateRange,
  shifts: Array<Shift>,
  leaves: Array<Leave>,
  contracts: List<EmploymentContract>
) => E.Either<TimecardComputationError, TimeCard> = (
  employeeId,
  period,
  shifts,
  leaves,
  contracts
) => {
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
