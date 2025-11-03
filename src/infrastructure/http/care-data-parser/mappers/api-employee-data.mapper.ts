import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List } from 'immutable';
import { EmployeeData } from '../../../../application/ports/services/care-data-parser-client';
import { ParseError } from '../../../../~shared/error/parse-error';
import { ValidationError } from '../../../../~shared/error/validation-error';
import { apiEmployeeDataSchema } from '../validation/schemas';

import { validateWithZod } from '../validation/validators';
import { mapApiContractsToContracts } from './contract.mapper';
import { mapApiEmployeeToEmployee } from './employee.mapper';
import { mapApiLeaveToLeave } from './leave.mapper';
import { mapApiShiftToShift } from './shift.mapper';

export const mapApiEmployeeDataToEmployeeData = (
  data: unknown
): E.Either<ValidationError | ParseError, EmployeeData> =>
  pipe(
    validateWithZod(apiEmployeeDataSchema, data, 'EmployeeData'),

    E.chain(validatedData =>
      pipe(
        E.Do,
        E.bind('employee', () => mapApiEmployeeToEmployee(validatedData.cleaner)),
        E.bind('shifts', ({ employee }) =>
          pipe(
            validatedData.shifts,
            E.traverseArray(mapApiShiftToShift(employee)),
            E.map(shifts => List(shifts))
          )
        ),
        E.bind('contracts', ({ employee }) =>
          pipe(
            validatedData.plannings,
            mapApiContractsToContracts(employee),
            E.map(contracts => List(contracts))
          )
        ),
        E.bind('leaves', () =>
          pipe(
            validatedData.leaves,
            E.traverseArray(mapApiLeaveToLeave),
            E.map(leaves => List(leaves))
          )
        )
      )
    )
  );
