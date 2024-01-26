import { DayOfWeek, Duration, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { List, Map, Set } from 'immutable';
import zod from 'zod';
import { Employee } from '../../domain/models/employee-registration/employee/employee';
import { ContractSubType } from '../../domain/models/employment-contract-management/employment-contract/contract-sub-type';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LeavePeriod } from '../../domain/models/leave-recording/leave/leave-period';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../domain/models/local-time-slot';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { ExtractEitherRightType, keys } from '../../~shared/util/types';

const daySchema = zod.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
const periodSchema = zod.object({ start: zod.string(), end: zod.string().nullish() });
const shiftsFromJSONSchema = zod
  .object({
    date: zod.string().min(1),
    startTime: zod.string(),
    duration: zod.string(),
  })
  .required();

const leavesFromJSONSchema = zod.object({
  period: periodSchema,
  startTime: zod.string(),
  endTime: zod.string(),
});

const employeeSchema = zod.object({
  id: zod.string(),
  firstName: zod.string(),
  lastName: zod.string(),
  seniorityDate: zod.string(),
  email: zod.string().optional(),
  phone: zod.string().optional(),
  address: zod
    .object({
      street: zod.string(),
      postalCode: zod.string(),
      city: zod.string(),
    })
    .optional(),
});
const employeeWithTimecardSchema = zod
  .object({
    cleaner: employeeSchema.transform(cleaner =>
      Employee.build({ ...{ id: '', firstName: '', lastName: '' }, ...cleaner, seniorityDate: LocalDate.parse(cleaner.seniorityDate) })
    ),
    shifts: zod.array(shiftsFromJSONSchema).nullish(),
    leaves: zod.array(leavesFromJSONSchema).nullish(),
    planning: zod.array(
      zod.object({
        contract: zod.object({
          period: periodSchema,
          type: zod.string(),
          subType: zod.string().optional(),
          weeklyHours: zod.string(),
          extraDuration: zod.string().optional(),
        }),
        planning: zod.record(
          daySchema,
          zod.array(
            zod.object({
              startTime: zod.string(),
              duration: zod.string(),
            })
          )
        ),
      })
    ),
  })
  .transform(raw => ({
    cleaner: raw.cleaner,
    shifts: raw.shifts.map(shift =>
      Shift.build({
        id: 'TODO',
        clientId: 'TODO',
        startTime: LocalDateTime.of(LocalDate.parse(shift.date), LocalTime.parse(shift.startTime)),
        duration: Duration.parse(shift.duration),
        employeeId: raw.cleaner.id,
      })
    ),
    leavePeriods: raw.leaves.map(leave => {
      const startTime = LocalTime.parse(leave.startTime);
      const endTime = LocalTime.parse(leave.endTime);
      return LeavePeriod.build({
        id: 'TODO',
        startTime,
        endTime,
        period: new LocalDateRange(LocalDate.parse(leave.period.start), LocalDate.parse(leave.period.end)),
        reason: 'Paid',
        comment: O.some('TODO'),
      });
    }),
    planning: raw.planning.map(p => {
      const extraDuration = Duration.parse(p.contract.extraDuration ?? 'PT0M');
      return EmploymentContract.build({
        employeeId: raw.cleaner.id,
        startDate: LocalDate.parse(p.contract.period.start),
        endDate: O.fromNullable(p.contract.period.end ? LocalDate.parse(p.contract.period.end) : null),
        overtimeAveragingPeriod: Duration.ofDays(7),
        weeklyTotalWorkedHours: Duration.parse(p.contract.weeklyHours).minus(extraDuration),
        workedDays: Set(keys(p.planning).map(d => DayOfWeek[d])),
        subType: p.contract.subType as ContractSubType,
        extraDuration: extraDuration,
        weeklyPlanning: daySchema.options.reduce((acc, day) => {
          const slots =
            p.planning[day]?.map(slot => {
              let startTime = LocalTime.parse(slot.startTime);
              return new LocalTimeSlot(startTime, Duration.parse(slot.duration).addTo(startTime));
            }) || Set<LocalTimeSlot>();
          return acc.set(DayOfWeek[day], Set(slots));
        }, Map<DayOfWeek, Set<LocalTimeSlot>>()),
      });
    }),
  }));

export const formatPayload = (data: ExtractEitherRightType<typeof parsePayload>) => ({
  employee: data.employee,
  shifts: List(data.shifts),
  leavePeriods: List(data.leavePeriods),
  contracts: List(data.contracts),
});

export const parsePayload = (payload: unknown) =>
  pipe(
    employeeWithTimecardSchema.safeParse(payload),
    E.fromPredicate(
      parsedJSON => parsedJSON.success,
      e => new Error(`success : ${e.success} \n Error while parsing payload ${e['error']}`)
    ),
    E.map(parsedJSON => (parsedJSON.success ? parsedJSON.data : null)),
    E.map(raw => ({
      shifts: raw.shifts,
      leavePeriods: raw.leavePeriods,
      contracts: raw.planning,
      employee: raw.cleaner,
    }))
  );
