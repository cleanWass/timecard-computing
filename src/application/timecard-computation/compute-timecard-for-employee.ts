import {
  groupShiftsByWorkingPeriods,
  splitPeriodIntoWorkingPeriods,
} from '@application/timecard-computation/util/workingPeriodsComputation';
import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/employment-contract';
import {Leave} from '@domain/models/leave-recording/leave/leave';
import {LocalDateRange} from '@domain/models/local-date-range';
import {Shift} from '@domain/models/mission-delivery/shift/shift';
import {WorkingPeriodTimecard} from '@domain/models/time-card-computation/time-card/WorkingPeriodTimecard';
import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';
import {Duration} from '@js-joda/core';
import {TimecardComputationError} from '@shared/error/TimecardComputationError';

import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/function';
import {List, Map} from 'immutable';

const computeTotalHoursByWorkingPeriod = (
  groupedShifts: Map<WorkingPeriod, List<Shift>>
) =>
  E.right(
    groupedShifts.map(gs =>
      gs.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)
    )
  );

const computeTotalSupplementaryHours = (
  contracts: List<EmploymentContract>,
  totalWeekly: Map<WorkingPeriod, Duration>
) => {
  const totalSupplementaryHoursMap = totalWeekly.reduce(
    (acc, total, workingPeriod) => {
      const contract = contracts.find(
        c => c.id === workingPeriod.employmentContractId
      );
      if (!contract?.isFullTime()) return acc.set(workingPeriod, Duration.ZERO);
      return !contract
        ? acc
        : acc.set(
            workingPeriod,
            Duration.ofMinutes(
              Math.max(
                0,
                total.toMinutes() - contract.weeklyTotalWorkedHours.toMinutes()
              )
            )
          );
    },
    Map<WorkingPeriod, Duration>()
  );
  return pipe(
    totalSupplementaryHoursMap,
    E.fromPredicate(
      () => totalSupplementaryHoursMap.size === totalWeekly.size,
      () => new TimecardComputationError('Missing contract')
    )
  );
};

const computeSupplementaryHours: WPTimecardComputation =
  contract => timecard =>
    contract?.isFullTime()
      ? timecard.register(
          'TotalSupplementary',
          Duration.ofMinutes(
            Math.max(
              0,
              timecard.workedHours.get('TotalWeekly').toMinutes() -
                contract.weeklyTotalWorkedHours.toMinutes()
            )
          )
        )
      : timecard;

// todo fetch rating from contract
const divideSupplementaryHoursByRating: WPTimecardComputation =
  contract => timecard => {
    const supplementaryHours = timecard.workedHours.TotalSupplementary;

    const _25PerCentRateHours = Duration.ofMinutes(
      Math.min(supplementaryHours.toMinutes(), Duration.ofHours(8).toMinutes())
    );
    const _50PerCentRateHours = supplementaryHours.minus(_25PerCentRateHours);
    return timecard
      .register('TwentyFivePercentRateSupplementary', _25PerCentRateHours)
      .register('FiftyPercentRateSupplementary', _50PerCentRateHours);
  };

type WPTimecardComputation = (
  contract: EmploymentContract
) => (timecard: WorkingPeriodTimecard) => WorkingPeriodTimecard;

// todo HERE
const computeNightShiftHours: WPTimecardComputation = contract => timecard => {
  const nightHours = contract.weeklyNightShiftHours
  return timecard;
};

const computeTotalHours =
  (shifts: List<Shift>) => (timecard: WorkingPeriodTimecard) =>
    timecard.register(
      'TotalWeekly',
      shifts.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)
    );

const computeComplementaryHours =
  (contract: EmploymentContract) => (timecard: WorkingPeriodTimecard) =>
    contract?.isFullTime()
      ? timecard
      : timecard.register(
          'TotalComplementary',
          Duration.ofMinutes(
            Math.max(
              0,
              timecard.workedHours.get('TotalWeekly').toMinutes() -
                contract.weeklyTotalWorkedHours.toMinutes()
            )
          )
        );

const findContract =
  (contracts: List<EmploymentContract>) => (workingPeriod: WorkingPeriod) =>
    pipe(
      contracts.find(c => c.id === workingPeriod.employmentContractId),
      E.fromNullable(new TimecardComputationError('Missing contract')),
      E.map(contract => ({contract, workingPeriod}))
    );

const initializeWorkingPeriodTimecard = (workingPeriod: WorkingPeriod) =>
  WorkingPeriodTimecard.build({
    contractId: workingPeriod.employmentContractId,
    employeeId: workingPeriod.employeeId,
    workingPeriod: workingPeriod,
  });

// todo pattern matching on contract fulltime et flow(a) flow(b) selon temps plein / partiel ?

export const computeWorkingPeriodTimecard: (
  workingPeriod: WorkingPeriod,
  shifts: List<Shift>,
  leaves: List<Leave>,
  contract: EmploymentContract
) => WorkingPeriodTimecard = (workingPeriod, shifts, leaves, contract) =>
  pipe(
    workingPeriod,
    initializeWorkingPeriodTimecard,
    computeTotalHours(shifts),
    computeComplementaryHours(contract),
    computeSupplementaryHours(contract),
    divideSupplementaryHoursByRating(contract)

    // computeTotalHours({workingPeriod, shifts, contract})),
    // E.map(tc => tc )
  );

const formatDuration = (d: Duration) =>
  `${d.toHours()}h${d?.toMinutes() % 60 > 0 ? `${d.toMinutes() % 60} ` : ''}`;

export const computeTimecardForEmployee: (
  employeeId: string,
  period: LocalDateRange,
  shifts: List<Shift>,
  leaves: List<Leave>,
  contracts: List<EmploymentContract>
) => E.Either<TimecardComputationError, Array<WorkingPeriodTimecard>> = (
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
    E.bindW('groupedShifts', ({workingPeriods}) =>
      groupShiftsByWorkingPeriods(shifts, workingPeriods)
    ),
    E.bindW('groupedLeaves', () => E.right(Map<WorkingPeriod, List<Leave>>())),
    E.bindW('totalWeekly', ({groupedShifts}) =>
      computeTotalHoursByWorkingPeriod(groupedShifts)
    ),
    E.bindW('timecards', ({workingPeriods, groupedShifts, groupedLeaves}) =>
      pipe(
        workingPeriods.toArray().map(wp =>
          pipe(
            wp,
            findContract(contracts),
            E.map(({contract, workingPeriod}) =>
              computeWorkingPeriodTimecard(
                workingPeriod,
                groupedShifts.get(workingPeriod, List<Shift>()),
                groupedLeaves.get(workingPeriod, List<Leave>()),
                contract
              )
            )
          )
        ),
        E.sequenceArray,
        E.map(tcs => List(tcs))
      )
    ),
    E.bindW('totalSupplementaryHours', ({totalWeekly}) =>
      computeTotalSupplementaryHours(contracts, totalWeekly)
    ),
    E.map(
      ({
        timecards,
        workingPeriods,
        groupedShifts,
        totalWeekly,
        // totalAdditionalHours,
        totalSupplementaryHours,
      }) => {
        console.log(
          timecards
            .map(tc => {
              const contract = contracts.find(
                c => c.id === tc.workingPeriod.employmentContractId
              );
              const weekly = tc.workedHours.get('TotalWeekly');
              const complementary = tc.workedHours.get('TotalComplementary');
              const supplementary = tc.workedHours.get('TotalSupplementary');

              return `${tc.workingPeriod.period.toFormattedString()} ${contract?.weeklyTotalWorkedHours.toString()}
                    TotalHours: ${formatDuration(weekly)}
                    TotalComplementary: ${formatDuration(complementary)}
                    TotalSupplementary: ${formatDuration(supplementary)}
                        -- 25%: ${formatDuration(
                          tc.workedHours.TwentyFivePercentRateSupplementary
                        )}
                        -- 50%: ${formatDuration(
                          tc.workedHours.FiftyPercentRateSupplementary
                        )}
                    `;
            })
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
          // totalAdditionalHours,
          totalSupplementaryHours,
        };
      }
    )
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
