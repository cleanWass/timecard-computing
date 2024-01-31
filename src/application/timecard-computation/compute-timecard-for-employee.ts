import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List } from 'immutable';
import '@js-joda/timezone';

import { Employee } from '../../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../domain/models/leave-recording/leave/leave';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import { computeExtraHoursByRate, computeTotalAdditionalHours } from './computation/additionnal-hours-computation';
import { computeMealTickets } from './computation/meal-tickets-computation';
import { computeLeavesHours, computeTotalNormalHoursAvailable, normalHoursComputation } from './computation/normal-hours-computation';
import { computeSurchargedHours } from './computation/surcharged-hours-computation';
import {
  groupLeavesByWorkingPeriods,
  groupShiftsByWorkingPeriods,
  splitPeriodIntoWorkingPeriods,
} from './computation/working-period-computation';
import { curateLeaves, filterShifts } from './curation/shifts-and-period-curation';
import { generateTheoreticalShiftIfPartialWeek } from './generation/theoretical-shifts-generation';

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
    weeklyPlanning: contract.weeklyPlannings.get(workingPeriod.period),
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
    generateTheoreticalShiftIfPartialWeek,
    computeTotalNormalHoursAvailable,
    normalHoursComputation,
    computeLeavesHours,
    computeTotalAdditionalHours,
    computeExtraHoursByRate,
    computeSurchargedHours,
    computeMealTickets
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
    return pipe(
      E.Do,
      E.bind('workingPeriods', () => splitPeriodIntoWorkingPeriods(contracts, period)),
      E.bindW('groupedShifts', ({ workingPeriods }) => groupShiftsByWorkingPeriods(shifts, workingPeriods)),
      E.bindW('groupedLeaves', ({ workingPeriods }) => groupLeavesByWorkingPeriods(leaves, workingPeriods)),
      E.bindW('timecards', ({ workingPeriods, groupedShifts, groupedLeaves }) =>
        pipe(
          workingPeriods,
          wps => {
            return wps;
          },
          wps =>
            wps
              .map(wp =>
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
              .toArray(),
          E.sequenceArray
        )
      ),
      E.map(({ timecards, workingPeriods, groupedShifts }) => ({
        period,
        employee,
        workingPeriods,
        groupedShifts,
        timecards,
        contracts,
      }))
    );
  };
};
