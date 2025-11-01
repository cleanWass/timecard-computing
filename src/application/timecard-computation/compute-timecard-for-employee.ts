import { DayOfWeek } from '@js-joda/core';
import { Either } from 'fp-ts/Either';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List, Map, Set } from 'immutable';
import '@js-joda/timezone';

import { Employee } from '../../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../domain/models/leave-recording/leave/leave';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../domain/models/local-time-slot';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../domain/models/timecard-computation/timecard/working-period-timecard';
import { WeeklyTimecardRecap } from '../../domain/models/timecard-computation/weekly-timecard-recap/weekly-timecard-recap';
import { WorkingPeriod } from '../../domain/models/timecard-computation/working-period/working-period';
import { IllegalArgumentError } from '../../~shared/error/IllegalArgumentError';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import {
  computeExtraHoursByRate,
  computeTotalAdditionalHours,
} from './computation/compute-additional-hours';
import {
  computeLeavesHours,
  computeTotalNormalHoursAvailable,
  computeWorkedHours,
} from './computation/compute-base-hours';
import { computeMealTickets } from './computation/compute-meal-tickets';
import { computeSurchargedHours } from './computation/compute-surcharged-hours';
import {
  groupLeavesByWorkingPeriods,
  groupShiftsByWorkingPeriods,
  splitPeriodIntoWorkingPeriods,
} from './computation/compute-working-period';
import { inferTotalIntercontractAndTotalContract } from './computation/infer-total-intercontract-and-total-contract';
import {
  curateLeaves,
  filterBenchingShifts,
  filterShifts,
} from './curation/curate-shifts-and-period';
import { mergeContractsIfSameWorkingTime } from './curation/merge-contracts-if-same-working-time';
import { generateInactiveShiftsIfPartialWeek } from './generation/generate-inactive-shifts';
import { generateWeeklyTimecardRecap } from './generation/generate-weekly-timecard-recap';
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

export type ComputeTimecardForEmployeeType = Either<
  IllegalArgumentError,
  {
    period: LocalDateRange;
    employee: Employee;
    workingPeriods: List<WorkingPeriod>;
    groupedShifts: Map<WorkingPeriod, List<Shift>>;
    timecards: readonly WorkingPeriodTimecard[];
    contracts: List<EmploymentContract>;
    weeklyRecaps: Map<LocalDateRange, WeeklyTimecardRecap>;
  }
>;

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

export const computeTimecardForEmployee =
  (period: LocalDateRange) =>
  ({
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

    return pipe(
      E.Do,
      E.bind('mergedContracts', () =>
        mergeContractsIfSameWorkingTime({ silaeId: employee.silaeId, contracts, period })
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
