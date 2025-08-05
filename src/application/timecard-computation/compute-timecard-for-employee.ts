import { DayOfWeek, LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { List, Map, Set } from 'immutable';
import '@js-joda/timezone';

import { Employee } from '../../domain/models/employee-registration/employee/employee';
import {
  EmploymentContract,
  WeeklyPlanning,
} from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../domain/models/leave-recording/leave/leave';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../domain/models/local-time-slot';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WeeklyTimecardRecap } from '../../domain/models/time-card-computation/weekly-timecard-recap/weekly-timecard-recap';
import { WorkingPeriod } from '../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import {
  computeExtraHoursByRate,
  computeTotalAdditionalHours,
} from './computation/additionnal-hours-computation';
import {
  computeLeavesHours,
  computeTotalNormalHoursAvailable,
  computeWorkedHours,
} from './computation/base-hours-computation';
import { inferTotalIntercontractAndTotalContract } from './computation/infer-total-intercontract-and-total-contract';
import { computeMealTickets } from './computation/meal-tickets-computation';
import { computeSurchargedHours } from './computation/surcharged-hours-computation';
import {
  groupLeavesByWorkingPeriods,
  groupShiftsByWorkingPeriods,
  splitPeriodIntoWorkingPeriods,
} from './computation/working-period-computation';
import {
  curateLeaves,
  filterBenchingShifts,
  filterShifts,
} from './curation/shifts-and-period-curation';
import { generateInactiveShiftsIfPartialWeek } from './generation/inactive-shifts-generation';
import { generateWeeklyTimecardRecap } from './generation/weekly-timecard-recap-generation';
import { attributeSurchargedHoursToShifts } from './premium-hours-attribution/attribute-surcharged-hours-to-shifts';

const findContract = (contracts: List<EmploymentContract>) => (workingPeriod: WorkingPeriod) =>
  pipe(
    contracts.find(c => c.id === workingPeriod.employmentContractId),
    E.fromNullable(new TimecardComputationError('Missing contract')),
    E.map(contract => ({ contract, workingPeriod }))
  );

const initializeWorkingPeriodTimecard = ({
  shifts,
  leaves,
  contract,
  workingPeriod,
  employee,
}: {
  shifts: List<Shift>;
  leaves: List<Leave>;
  contract: EmploymentContract;
  employee: Employee;
  workingPeriod: WorkingPeriod;
}) =>
  WorkingPeriodTimecard.build({
    contract,
    employee,
    workingPeriod,
    weeklyPlanning: contract.weeklyPlannings.get(
      workingPeriod.period,
      Map<DayOfWeek, Set<LocalTimeSlot>>()
    ),
    shifts,
    leaves,
  });

export const computeWorkingPeriodTimecard: (
  workingPeriod: WorkingPeriod,
  shifts: List<Shift>,
  leaves: List<Leave>,
  contract: EmploymentContract,
  employee: Employee
) => WorkingPeriodTimecard = (workingPeriod, shifts, leaves, contract, employee) => {
  return pipe(
    {
      contract,
      employee,
      workingPeriod,
      shifts,
      leaves,
    },
    initializeWorkingPeriodTimecard,
    curateLeaves,
    filterShifts,
    filterBenchingShifts,
    generateInactiveShiftsIfPartialWeek,
    computeTotalNormalHoursAvailable,
    computeWorkedHours,
    computeLeavesHours,
    computeTotalAdditionalHours,
    computeExtraHoursByRate,
    computeSurchargedHours,
    computeMealTickets,
    inferTotalIntercontractAndTotalContract,
    attributeSurchargedHoursToShifts
    // computeRentabilityForEmployee
  );
};

const shouldBeMerged = (firstContract: EmploymentContract, secondContract: EmploymentContract) =>
  firstContract.weeklyTotalWorkedHours.equals(secondContract.weeklyTotalWorkedHours) &&
  firstContract.type === 'CDI' &&
  secondContract.type === 'CDI' &&
  firstContract.subType === secondContract.subType &&
  firstContract.subType !== 'complement_heure' &&
  secondContract.subType !== 'complement_heure';

const mergeWeeklyPlanningsBasedOnDates = ({
  firstContract,
  secondContract,
}: {
  firstContract: EmploymentContract;
  secondContract: EmploymentContract;
}): Map<LocalDateRange, WeeklyPlanning> => {
  let mergedWeeklyPlannings = Map<LocalDateRange, WeeklyPlanning>();

  const startDate = firstContract.startDate;
  const endDate = secondContract.endDate;
  const mergedPeriod = new LocalDateRange(startDate, O.getOrElse(() => LocalDate.MAX)(endDate));

  const mergedWeeklyPlanning = Map<DayOfWeek, Set<LocalTimeSlot>>().withMutations(
    weeklyPlanning => {
      DayOfWeek.values().forEach(dayOfWeek => {
        const firstContractPlanning = firstContract.weeklyPlannings
          .valueSeq()
          .flatMap(planning => planning.get(dayOfWeek, Set<LocalTimeSlot>()))
          .toSet();

        const secondContractPlanning = secondContract.weeklyPlannings
          .valueSeq()
          .flatMap(planning => planning.get(dayOfWeek, Set<LocalTimeSlot>()))
          .toSet();

        const firstContractEndDate = O.getOrElse(() => LocalDate.MAX)(firstContract.endDate);

        const dayPlanning =
          dayOfWeek.value() < firstContractEndDate.dayOfWeek().value()
            ? firstContractPlanning
            : secondContractPlanning;

        weeklyPlanning.set(dayOfWeek, dayPlanning);
      });
    }
  );

  mergedWeeklyPlannings = mergedWeeklyPlannings.set(mergedPeriod, mergedWeeklyPlanning);

  return mergedWeeklyPlannings;
};

export const mergeContractsIfSameWorkingTime = ({
  silaeId,
  period,
  contracts,
}: {
  silaeId: string;
  period: LocalDateRange;
  contracts: List<EmploymentContract>;
}) => {
  const calendarWeeks = period.divideIntoCalendarWeeks();

  const groupedContracts = calendarWeeks.reduce(
    (res, week) =>
      res.set(
        week,
        contracts.filter(c => week.overlaps(c.period(week.end)))
      ),
    Map<LocalDateRange, List<EmploymentContract>>()
  );
  const groupedContractsWithSameWorkingTime = groupedContracts.reduce((acc, ctrs, week) => {
    return acc.set(
      week,
      ctrs.size <= 1
        ? ctrs
        : ctrs
            .sort((a, b) => a.startDate.compareTo(b.startDate))
            .reduce((acc, currentContract, index) => {
              const lastRegisteredContract = acc.last();
              if (index === 0 || !lastRegisteredContract) return acc.push(currentContract);
              if (silaeId === '00914')
                console.log(
                  `00914 shouldBeMerged : ${shouldBeMerged(
                    currentContract,
                    lastRegisteredContract
                  )} ${currentContract.debug()}${lastRegisteredContract.debug()}`
                );
              if (shouldBeMerged(currentContract, lastRegisteredContract)) {
                const mergedWeeklyPlannings = mergeWeeklyPlanningsBasedOnDates({
                  firstContract: lastRegisteredContract,
                  secondContract: currentContract,
                });

                return acc.pop().push(
                  lastRegisteredContract.with({
                    endDate: currentContract.endDate,
                    weeklyPlannings: mergedWeeklyPlannings,
                  })
                );
              }
              return acc.push(currentContract);
            }, List<EmploymentContract>())
    );
  }, Map<LocalDateRange, List<EmploymentContract>>());

  const mergedContracts = groupedContractsWithSameWorkingTime
    .reduce((list, contracts) => list.concat(contracts), List<EmploymentContract>())
    .toSet()
    .toList();

  return E.right(mergedContracts);
};

export const computeTimecardForEmployee = (period: LocalDateRange) => {
  return ({
    employee,
    shifts,
    contracts,
    leaves,
  }: {
    employee: Employee;
    shifts: List<Shift>;
    leaves: List<Leave>;
    contracts: List<EmploymentContract>;
  }) => {
    if (contracts.isEmpty() && shifts.isEmpty()) {
      return E.right({
        period,
        employee,
        workingPeriods: List<WorkingPeriod>(),
        groupedShifts: Map<WorkingPeriod, List<Shift>>(),
        timecards: [] as WorkingPeriodTimecard[],
        contracts,
        weeklyRecaps: Map<LocalDateRange, WeeklyTimecardRecap>(),
      });
    }

    const testChangesOnContracts = true;

    return pipe(
      E.Do,
      E.bind('mergedContracts', () =>
        testChangesOnContracts
          ? mergeContractsIfSameWorkingTime({ silaeId: employee.silaeId, contracts, period })
          : E.right(contracts)
      ),
      E.bind('workingPeriods', ({ mergedContracts }) =>
        splitPeriodIntoWorkingPeriods(mergedContracts, period)
      ),
      E.bind('groupedShifts', ({ workingPeriods }) =>
        groupShiftsByWorkingPeriods(shifts, workingPeriods)
      ),
      E.bind('groupedLeaves', ({ workingPeriods }) =>
        groupLeavesByWorkingPeriods(leaves, workingPeriods)
      ),
      E.bind('timecards', ({ mergedContracts, workingPeriods, groupedShifts, groupedLeaves }) =>
        pipe(
          workingPeriods.toArray(),
          E.traverseArray(wp =>
            pipe(
              wp,
              findContract(mergedContracts),
              E.map(({ contract, workingPeriod }) =>
                computeWorkingPeriodTimecard(
                  workingPeriod,
                  groupedShifts.get(workingPeriod, List<Shift>()),
                  groupedLeaves.get(workingPeriod, List<Leave>()),
                  contract,
                  employee
                )
              )
            )
          )
        )
      ),
      E.bind('weeklyRecaps', ({ timecards }) =>
        generateWeeklyTimecardRecap(List(timecards), employee, period)
      ),
      E.map(({ timecards, workingPeriods, groupedShifts, weeklyRecaps }) => ({
        period,
        employee,
        workingPeriods,
        groupedShifts,
        timecards,
        contracts,
        weeklyRecaps,
      }))
    );
  };
};
