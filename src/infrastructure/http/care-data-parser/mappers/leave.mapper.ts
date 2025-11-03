import { Duration, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { Leave } from '../../../../domain/models/leave-recording/leave/leave';
import { isPaidLeaveReason } from '../../../../domain/models/leave-recording/leave/leave-retribution';
import { ParseError } from '../../../../domain/~shared/error/parse-error';
import { ValidationError } from '../../../../~shared/error/validation-error';
import { apiLeaveSchema } from '../validation/schemas';
import { validateWithZod } from '../validation/validators';

export const mapApiLeaveToLeave = (data: unknown): E.Either<ParseError | ValidationError, Leave> =>
  pipe(
    validateWithZod(apiLeaveSchema, data, 'Leave'),
    E.chain(
      ({
        absenceType,
        clientId = 'no client id',
        clientName = 'no client name',
        date,
        duration,
        endTime,
        id,
        silaeId: employeeId,
        startTime,
      }) =>
        E.tryCatch(
          () =>
            Leave.build({
              id,
              employeeId,
              clientId,
              clientName,
              absenceType,
              startTime: LocalTime.parse(startTime),
              endTime: LocalTime.parse(endTime),
              date: LocalDate.parse(date),
              duration: Duration.parse(duration),
              compensation: isPaidLeaveReason(absenceType) ? 'PAID' : 'UNPAID',
            }),
          error => new ParseError(`Failed to build Shift domain object: ${error}`)
        )
    )
  );
