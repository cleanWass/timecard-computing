import { identity } from 'fp-ts/function';
import { pipe } from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { LocalDate, DateTimeFormatter } from '@js-joda/core';
import { List, Set } from 'immutable';
import { computeTimecardForEmployee } from '../application/timecard-computation/compute-timecard-for-employee';
import { AnalyzedShift } from '../domain/models/cost-efficiency/analyzed-shift';
import { LocalDateRange } from '../domain/models/local-date-range';
import { formatTimecardComputationReturn } from '../infrastructure/formatting/format-timecard-response';
import {
  fetchEmployeeDataFromCache,
  fetchTimecardData,
  fetchTimecardDataForEmployees,
  validateApiReturn,
  validateRequestPayload,
} from '../infrastructure/server/timecard-route-service';
import { formatPayload, parsePayload } from '../infrastructure/validation/parse-payload';

const formatDate = (date: LocalDate) => date.format(DateTimeFormatter.ofPattern('dd-MM-yyyy'));

async function main() {
  const start = LocalDate.of(2025, 3, 1);
  const end = LocalDate.of(2025, 4, 1);

  const period = LocalDateRange.of(start, end);

  return pipe(
    period,
    E.map(fetchEmployeeDataFromCache),
    TE.fromEither,
    t => t,
    TE.flattenW,
    t => t,
    // TE.map(cl => [...cl.slice(10, 30)]),
    TE.chainW(
      TE.traverseSeqArray(cleanerData => {
        return pipe(
          TE.Do,
          TE.bind('period', () => pipe(period, TE.fromEither)),
          TE.bind('data', () => pipe(parsePayload(cleanerData), TE.fromEither)),
          TE.bind('timecards', ({ period, data }) =>
            pipe(
              data,
              formatPayload,
              computeTimecardForEmployee(period),
              // E.map(formatTimecardComputationReturn),
              TE.fromEither
            )
          )
        );
      })
    ),
    TE.map(
      result =>
        List(
          result
            .flatMap(t =>
              t.timecards.timecards.map(txc => txc.analyzedShifts || List<AnalyzedShift>()).flat(1)
            )
            .filter(t => t.size > 0)
        ).flatten(false) as List<AnalyzedShift>
    ),
    TE.map(premiumShifts => premiumShifts.groupBy(shift => shift.shift.clientName)),
    TE.map(re =>
      console.log(
        JSON.stringify(
          re.map(l => l.map(s => s.debug())),
          null,
          2
        )
      )
    ),
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
