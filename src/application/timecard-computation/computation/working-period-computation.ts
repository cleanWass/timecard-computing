import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List, Map } from 'immutable';
import { EmploymentContract } from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriod } from '../../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../../~shared/error/TimecardComputationError';

export const throwIfNoContract = <T>(list: List<T>) =>
  list.isEmpty() ? E.left(new TimecardComputationError('No contract matches this period 0')) : E.right(list);

export const filterContractsForPeriod = (period: LocalDateRange) => (contracts: List<EmploymentContract>) =>
  contracts.filter(contract => contract.period(period.end).overlaps(period));

const computeWorkingPeriods = (period: LocalDateRange) => (contracts: List<EmploymentContract>) =>
  pipe(
    contracts,
    E.fromPredicate(
      crts => !crts.isEmpty(),
      () => new TimecardComputationError('No contract matches this period 1')
    ),
    E.map(crts =>
      crts.reduce(
        (acc, { employeeId, id: employmentContractId, weeklyPlannings }) =>
          acc.concat(
            weeklyPlannings.keySeq().map(period =>
              WorkingPeriod.build({
                employeeId,
                employmentContractId,
                period,
              })
            )
          ),
        List<WorkingPeriod>()
      )
    )
  );

export const splitPeriodIntoWorkingPeriods = (contracts: List<EmploymentContract>, period: LocalDateRange) =>
  pipe(contracts, computeWorkingPeriods(period));

export const groupShiftsByWorkingPeriods = (shifts: List<Shift>, workingPeriods: List<WorkingPeriod>) =>
  pipe(workingPeriods, wp =>
    E.right(
      wp.reduce(
        (groupedShifts, workingPeriod) =>
          groupedShifts.set(
            workingPeriod,
            shifts
              .filter(({ startTime }) => workingPeriod.period.includesDate(startTime.toLocalDate()))
              .filter(({ employeeId }) => employeeId === workingPeriod.employeeId)
          ),
        Map<WorkingPeriod, List<Shift>>()
      )
    )
  );

export const groupLeavesByWorkingPeriods = (leaves: List<Leave>, workingPeriods: List<WorkingPeriod>) =>
  pipe(workingPeriods, wp =>
    E.right(
      wp.reduce(
        (groupedPeriods, workingPeriod) =>
          groupedPeriods.set(
            workingPeriod,
            leaves.filter(leave => workingPeriod.period.contains(leave.date))
          ),
        Map<WorkingPeriod, List<Leave>>()
      )
    )
  );
