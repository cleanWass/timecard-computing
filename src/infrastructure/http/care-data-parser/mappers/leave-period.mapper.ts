import { LocalDate, LocalTime } from '@js-joda/core';

import * as A from 'fp-ts/Apply';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { LeavePeriod } from '../../../../domain/models/leave-recording/leave/leave-period';
import { LocalDateRange } from '../../../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../../../domain/models/local-time-slot';
import { ParseError } from '../../../../domain/~shared/error/parse-error';
import { ValidationError } from '../../../../~shared/error/validation-error';
import { apiLeavePeriodsSchema } from '../validation/schemas';
import { validateWithZod } from '../validation/validators';

export const mapApiLeavePeriodToLeavePeriod = (
  data: unknown
): E.Either<ParseError | ValidationError, LeavePeriod> =>
  pipe(
    E.Do,
    E.bind('parsedData', () => validateWithZod(apiLeavePeriodsSchema, data, 'LeavePeriod')),
    E.bind('timeSlot', ({ parsedData }) =>
      pipe(
        A.sequenceS(O.Apply)({
          start: pipe(parsedData.startTime, O.fromNullable, O.map(LocalTime.parse)),
          end: pipe(parsedData.endTime, O.fromNullable, O.map(LocalTime.parse)),
        }),
        O.map(({ start, end }) => LocalTimeSlot.of(start, end)),
        O.sequence(E.Applicative)
      )
    ),
    E.bind(
      'period',
      ({
        parsedData: {
          period: { endDate, startDate },
        },
      }) => {
        const start = E.tryCatch(
          () => LocalDate.parse(startDate),
          error =>
            new ParseError('mapApiLeavePeriodToLeavePeriod ParseError : ' + JSON.stringify(error))
        );
        const end = E.tryCatch(
          () => LocalDate.parse(endDate),
          error =>
            new ParseError('mapApiLeavePeriodToLeavePeriod ParseError : ' + JSON.stringify(error))
        );
        return pipe(
          A.sequenceS(E.Apply)({
            start,
            end,
          }),
          E.chain(({ start, end }) => LocalDateRange.of(start, end))
        );
      }
    ),
    E.map(({ timeSlot, period, parsedData: { id, silaeId, absenceType, employeeId } }) =>
      LeavePeriod.build({
        timeSlot,
        period,
        id,
        silaeId,
        absenceType,
        employeeId,
      })
    )
  );
