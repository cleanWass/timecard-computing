import { identity } from 'fp-ts/function';
import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { LocalDate, DateTimeFormatter } from '@js-joda/core';
import { computeTimecardForEmployee } from '../application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from '../domain/models/local-date-range';
import { formatTimecardComputationReturn } from '../infrastructure/formatting/format-timecard-response';
import {
  fetchTimecardData,
  fetchTimecardDataForEmployees,
  validateApiReturn,
  validateRequestPayload,
} from '../infrastructure/server/timecard-route-service';

const formatDate = (date: LocalDate) => date.format(DateTimeFormatter.ofPattern('dd-MM-yyyy'));

async function main() {
  const start = LocalDate.of(2025, 3, 1);
  const end = LocalDate.of(2025, 4, 1);

  return pipe(
    LocalDateRange.of(start, end),
    E.map(fetchTimecardDataForEmployees),
    TE.fromEither,
    TE.flattenW,
    TE.map(cl => [...cl.slice(10, 30).map(c => c.silaeId), '01483']),
    TE.chainW(
      TE.traverseSeqArray(silaeId => {
        return pipe(
          TE.Do,
          TE.bind('period', () => TE.of(new LocalDateRange(start, end))),
          TE.bind('raw', () =>
            fetchTimecardData({
              silaeId,
              period: new LocalDateRange(start, end),
            })
          ),
          TE.bind('data', ({ raw }) => pipe(raw, validateApiReturn, TE.fromEither)),
          TE.bind('timecards', ({ period, data }) =>
            pipe(
              data,
              computeTimecardForEmployee(period),
              // E.map(formatTimecardComputationReturn),
              TE.fromEither
            )
          )
        );
      })
    ),
    TE.map(result => {
      console.log(
        JSON.stringify(
          result
            .map(t => t.timecards.timecards.map(txc => txc.analyzedShifts?.map(s => s.debug())))
            .flat(Infinity)
            .filter(identity),
          null,
          2
        )
      );
      return result;
    }),
    TE.mapLeft(error => {
      console.error('Error:', error);
      return error;
    })
  )();
}

main()
  .then(() => console.log('Job completed successfully'))
  .catch(e => console.error('Unhandled error:', e))
  .finally(() => {
    console.log('Exiting process...');
    process.exit(0);
  });
