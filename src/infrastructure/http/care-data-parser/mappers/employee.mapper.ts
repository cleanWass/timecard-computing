import { LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { Employee } from '../../../../domain/models/employee-registration/employee/employee';
import { ParseError } from '../../../../domain/~shared/error/parse-error';
import { ValidationError } from '../../../../~shared/error/validation-error';
import { apiEmployeeSchema } from '../validation/schemas';
import { validateWithZod } from '../validation/validators';

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
              managerName,
              address,
            }),
          error => new ParseError(`Failed to build Employee domain object: ${error}`)
        )
    )
  );
