import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import { Duration, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import * as O from 'fp-ts/Option';
import { Employee } from '../../../../domain/models/employee-registration/employee/employee';
import { Shift } from '../../../../domain/models/mission-delivery/shift/shift';
import { ParseError } from '../../../../domain/~shared/error/parse-error';
import { ValidationError } from '../../../../~shared/error/validation-error';
import { apiShiftSchema } from '../validation/schemas';
import { validateWithZod } from '../validation/validators';

export const mapApiShiftToShift =
  (employee: Employee) =>
  (data: unknown): E.Either<ValidationError | ParseError, Shift> =>
    pipe(
      validateWithZod(apiShiftSchema, data, 'Shift'),
      E.chainW(shift =>
        E.tryCatch(
          () =>
            Shift.build({
              id: shift.id || 'no id',
              clientId: shift.clientId || 'no client id',
              clientName: shift.clientName || 'no client name',
              startTime: LocalDateTime.of(
                LocalDate.parse(shift.date),
                LocalTime.parse(shift.startTime)
              ),
              duration: Duration.parse(shift.duration),
              type: shift.type,
              employeeId: employee.silaeId,
              silaeId: employee.silaeId,
              parentAffectationId: O.fromNullable(shift.parentAffectationId),
              precedenceDate: pipe(shift.precedenceDate, O.fromNullable, O.map(LocalDate.parse)),
            }),
          error => new ParseError(`Failed to build Shift domain object: ${error}`)
        )
      )
    );
