import { DayOfWeek } from '@js-joda/core';
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
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import { computeExtraHoursByRate, computeTotalAdditionalHours } from './computation/additionnal-hours-computation';
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
import { curateLeaves, filterShifts } from './curation/shifts-and-period-curation';
import { generateInactiveShiftsIfPartialWeek } from './generation/inactive-shifts-generation';
import { generateWeeklyTimecardRecap } from './generation/weekly-timecard-recap-generation';

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
    weeklyPlanning: contract.weeklyPlannings.get(workingPeriod.period, Map<DayOfWeek, Set<LocalTimeSlot>>()),
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
    generateInactiveShiftsIfPartialWeek,
    computeTotalNormalHoursAvailable,
    computeWorkedHours,
    computeLeavesHours,
    computeTotalAdditionalHours,
    computeExtraHoursByRate,
    computeSurchargedHours,
    computeMealTickets,
    inferTotalIntercontractAndTotalContract
    // computeRentabilityForEmployee
  );
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
        workingPeriods: List(),
        groupedShifts: List(),
        timecards: [],
        contracts,
        weeklyRecaps: Map(),
      });
    }
    return pipe(
      E.Do,
      E.bind('workingPeriods', () => splitPeriodIntoWorkingPeriods(contracts, period)),
      E.bind('groupedShifts', ({ workingPeriods }) => groupShiftsByWorkingPeriods(shifts, workingPeriods)),
      E.bind('groupedLeaves', ({ workingPeriods }) => groupLeavesByWorkingPeriods(leaves, workingPeriods)),
      E.bind('timecards', ({ workingPeriods, groupedShifts, groupedLeaves }) =>
        pipe(
          workingPeriods.toArray(),
          E.traverseArray(wp =>
            pipe(
              wp,
              findContract(contracts),
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
      E.bind('weeklyRecaps', ({ timecards }) => generateWeeklyTimecardRecap(List(timecards), employee, period)),
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
