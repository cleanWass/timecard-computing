import { DayOfWeek, Duration, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import * as O from 'fp-ts/Option';
import { List, Map, Set } from 'immutable';
import zod from 'zod';
import { Employee } from '../../../domain/models/employee-registration/employee/employee';
import { EMPLOYEE_ROLE } from '../../../domain/models/employee-registration/employee/EMPLOYEE_ROLE';
import { ContractSubType } from '../../../domain/models/employment-contract-management/employment-contract/contract-sub-type';
import {
  EmploymentContract,
  WeeklyPlanning,
} from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { isPaidLeaveReason } from '../../../domain/models/leave-recording/leave/leave-retribution';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { keys } from '../../../~shared/util/types';
import { ContractValidatorType } from './contract';
import { leaveValidator } from './leave';
import { contractPlanningValidator, PlanningValidatorType } from './planning';
import { shiftValidator } from './shift';
import { ClosedPeriodValidatorType, dayValidator } from './temporals';

export const employeeValidator = zod.object({
  id: zod.string(),
  silaeId: zod.string(),
  firstName: zod.string(),
  lastName: zod.string(),
  role: zod.enum(EMPLOYEE_ROLE),
  seniorityDate: zod.string(),
  email: zod.string().optional(),
  phone: zod.string().optional(),
  managerId: zod.string().optional(),
  managerName: zod.string().optional(),
  address: zod
    .object({
      street: zod.string(),
      postalCode: zod.string(),
      city: zod.string(),
    })
    .optional(),
});

export const employeeDataValidator = zod
  .object({
    cleaner: employeeValidator.transform(cleaner =>
      Employee.build({
        ...{ id: '', firstName: '', lastName: '', silaeId: '', role: 'Hotel Staff' },
        ...cleaner,
        seniorityDate: LocalDate.parse(cleaner.seniorityDate),
      })
    ),
    shifts: zod.array(shiftValidator),
    leaves: zod.array(leaveValidator).nullish(),
    plannings: zod.array(contractPlanningValidator),
  })
  .transform(raw => {
    const contractPlanningsGroupedByContractId = raw.plannings.reduce(
      (map, curr) =>
        map.update(curr.contract.id, List<[PlanningValidatorType, ClosedPeriodValidatorType]>(), list =>
          list.push([curr.planning, curr.period])
        ),
      Map<ContractValidatorType['id'], List<[PlanningValidatorType, ClosedPeriodValidatorType]>>()
    );

    return {
      employee: raw.cleaner,
      shifts: (raw.shifts || []).map(shift =>
        Shift.build({
          id: shift.id || 'no id',
          clientId: shift.clientId || 'no client id',
          clientName: shift.clientName || 'no client name',
          startTime: LocalDateTime.of(LocalDate.parse(shift.date), LocalTime.parse(shift.startTime)),
          duration: Duration.parse(shift.duration),
          type: shift.type,
          employeeId: raw.cleaner.silaeId,
        })
      ),
      leaves: (raw.leaves || []).map(leave =>
        Leave.build({
          startTime: LocalTime.parse(leave.startTime),
          endTime: LocalTime.parse(leave.endTime),
          date: LocalDate.parse(leave.date),
          duration: Duration.parse(leave.duration),
          compensation: isPaidLeaveReason(leave.absenceType) ? 'PAID' : 'UNPAID',
          absenceType: leave.absenceType,
        })
      ),
      contracts: contractPlanningsGroupedByContractId.keySeq().map(contractId => {
        // @ts-ignore
        const { contract, planning } = raw.plannings.find(planning => planning.contract.id === contractId);
        const extraDuration = Duration.parse(contract.extraDuration ?? 'PT0M');
        return EmploymentContract.build({
          id: contractId,
          initialId: contract.initialId || 'no id',
          employeeId: raw.cleaner.silaeId,
          startDate: LocalDate.parse(contract.period.start),
          endDate: O.fromNullable(contract.period.end ? LocalDate.parse(contract.period.end) : null),
          overtimeAveragingPeriod: Duration.ofDays(7),
          weeklyTotalWorkedHours: Duration.parse(contract.weeklyHours),
          workedDays: Set(keys(planning).map(d => DayOfWeek[d])),
          type: contract.type,
          subType: contract.subType as ContractSubType,
          extraDuration: contract.subType === 'complement_heure' ? extraDuration : Duration.ZERO,
          weeklyNightShiftHours: EmploymentContract.nightShiftTimeSlots,
          weeklyPlannings: contractPlanningsGroupedByContractId
            .get(contractId, List<[PlanningValidatorType, ClosedPeriodValidatorType]>())
            .reduce((map, curr) => {
              const weeklyPlanning = dayValidator.options.reduce((acc, day) => {
                const slots =
                  curr[0][day]?.map(slot => {
                    let startTime = LocalTime.parse(slot.startTime);
                    return new LocalTimeSlot(startTime, Duration.parse(slot.duration).addTo(startTime));
                  }) || Set<LocalTimeSlot>();
                return acc.set(DayOfWeek[day], Set(slots));
              }, Map<DayOfWeek, Set<LocalTimeSlot>>());

              return map.set(
                new LocalDateRange(LocalDate.parse(curr[1].start), LocalDate.parse(curr[1].end)),
                weeklyPlanning
              );
            }, Map<LocalDateRange, WeeklyPlanning>()),
        });
      }),
    };
  });
