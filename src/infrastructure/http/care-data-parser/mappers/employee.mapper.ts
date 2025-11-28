import { DayOfWeek, LocalDate, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { Map, Set } from 'immutable';
import { Employee } from '../../../../domain/models/employee-registration/employee/employee';
import { LocalTimeSlot } from '../../../../domain/models/local-time-slot';
import { ParseError } from '../../../../domain/~shared/error/parse-error';
import { ValidationError } from '../../../../~shared/error/validation-error';
import { apiEmployeeSchema } from '../validation/schemas';
import { validateWithZod } from '../validation/validators';
import { dayShortcuts } from './helper';

export const mapApiEmployeeToEmployee = (
  data: unknown
): E.Either<ValidationError | ParseError, Employee> =>
  pipe(
    validateWithZod(apiEmployeeSchema, data, 'Employee'),
    E.chainW(
      ({
        id,
        firstName,
        lastName,
        seniorityDate,
        role,
        silaeId,
        email,
        managerId,
        managerName,
        address,
        phoneNumber,
        availabilityPlanning,
      }) =>
        E.tryCatch(
          () =>
            Employee.build({
              id,
              firstName,
              lastName,
              seniorityDate: LocalDate.parse(seniorityDate),
              role,
              silaeId,
              email,
              managerId,
              phoneNumber,
              managerName,
              address,
              availabilityPlanning: availabilityPlanning
                ? dayShortcuts.reduce((acc, day, index) => {
                    const slots = availabilityPlanning?.[day]?.map(
                      (slot: { start: string; end: string }) => {
                        const startTime = LocalTime.parse(slot.start);
                        const endTime = LocalTime.parse(slot.end);
                        return new LocalTimeSlot(startTime, endTime);
                      }
                    );
                    return acc.set(DayOfWeek.values()[index], Set<LocalTimeSlot>(slots));
                  }, Map<DayOfWeek, Set<LocalTimeSlot>>())
                : Map<DayOfWeek, Set<LocalTimeSlot>>(
                    dayShortcuts.map((d, index) => [
                      DayOfWeek.values()[index],
                      Set<LocalTimeSlot>(),
                    ])
                  ),
            }),
          error => new ParseError(`Failed to build Employee domain object: ${error}`)
        )
    )
  );
