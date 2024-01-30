import { DayOfWeek, Duration, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { List, Map, Set } from 'immutable';
import zod from 'zod';
import { Employee } from '../../domain/models/employee-registration/employee/employee';
import { ContractSubType } from '../../domain/models/employment-contract-management/employment-contract/contract-sub-type';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../domain/models/leave-recording/leave/leave';
import { LeavePeriod } from '../../domain/models/leave-recording/leave/leave-period';
import { isPaidLeaveReason } from '../../domain/models/leave-recording/leave/leave-reason';
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
  date: zod.string().min(1),
  startTime: zod.string().min(1),
  endTime: zod.string().min(1),
  duration: zod.string(),
  absenceType: zod.enum([
    'HOLIDAY',
    'ILLNESS',
    'CONSERVATORY_LAID_OFF',
    'DISCIPLINARY_LAID_OFF',
    'LEAVE ABSENCE_PAID',
    'MATERNITY LEAVE',
    'PARENTAL LEAVE',
    'PATERNITY LEAVE',
    'SABBATICAL_LEAVE',
    'UNAUTHORIZED_LEAVE',
    'UNAUTHORIZED_LEAVE_UNPAID',
    'UNPAYED_LEAVE',
    'WORK_ILLNESS',
    'WORK_INJURY',
    'CLOSED_SITE',
    'COMMUTE INJURY',
    'FAMILY_LEAVE',
    'PAYED_LEAVE',
    'SICK_CHILD',
    'TRAINING_LEAVE',
  ]),
});

const employeeSchema = zod.object({
  id: zod.string(),
  silaeId: zod.string(),
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
      Employee.build({
        ...{ id: '', firstName: '', lastName: '', silaeId: '' },
        ...cleaner,
        seniorityDate: LocalDate.parse(cleaner.seniorityDate),
      })
    ),
    shifts: zod.array(shiftsFromJSONSchema).nullish(),
    leaves: zod.array(leavesFromJSONSchema).nullish(),
    planning: zod.array(
      zod.object({
        contract: zod.object({
          period: periodSchema,
          type: zod.string(),
          subType: zod.string().nullish(),
          weeklyHours: zod.string(),
          extraDuration: zod.string().nullish(),
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
  .transform(raw => {
    return {
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
      leaves: raw.leaves.map(leave =>
        Leave.build({
          startTime: LocalTime.parse(leave.startTime),
          endTime: LocalTime.parse(leave.endTime),
          date: LocalDate.parse(leave.date),
          duration: Duration.parse(leave.duration),
          compensation: isPaidLeaveReason(leave.absenceType) ? 'PAID' : 'UNPAID',
          absenceType: leave.absenceType,
        })
      ),
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
    };
  });

export const formatPayload = (data: ExtractEitherRightType<typeof parsePayload>) => ({
  employee: data.employee,
  shifts: List(data.shifts),
  leaves: List(data.leaves),
  contracts: List(data.contracts),
});

export const parsePayload = (payload: unknown) => {
  return pipe(
    employeeWithTimecardSchema.safeParse(payload),
    E.fromPredicate(
      parsedJSON => parsedJSON.success,
      e => {
        let error = new Error(`success : ${e.success} \n Error while parsing payload ${e['error']}`);
        console.log(error);
        return error;
      }
    ),
    E.map(parsedJSON => (parsedJSON.success ? parsedJSON.data : null)),
    E.mapLeft(e => console.log('error while parsing', e)),
    E.map(({ leaves, planning, shifts, cleaner }) => {
      return {
        shifts,
        leaves,
        contracts: planning,
        employee: cleaner,
      };
    })
  );
};
