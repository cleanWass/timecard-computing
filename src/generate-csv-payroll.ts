import { LocalDate, Month } from '@js-joda/core';
import axios from 'axios';
import * as E from 'fp-ts/Either';

import { flow, pipe } from 'fp-ts/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import { List } from 'immutable';
import {
  formatCsvDetails,
  formatCsvSilaeExport,
  formatCsvTotal,
  formatCsvWeekly,
} from './application/csv-generation/export-csv';
import { prepareEnv } from './application/csv-generation/prepare-env';
import { computeTimecardForEmployee } from './application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from './domain/models/local-date-range';
import { WorkingPeriodTimecard } from './domain/models/time-card-computation/timecard/working-period-timecard';
import { BillingPeriodDefinitionService } from './domain/service/billing-period-definition/billing-period-definition-service';
import { formatPayload, parsePayload } from './infrastructure/validation/parse-payload';

const periods = {
  january: new LocalDateRange(LocalDate.parse('2023-12-18'), LocalDate.parse('2024-01-22')),
  february: new LocalDateRange(LocalDate.parse('2024-01-22'), LocalDate.parse('2024-02-18')),
  march: new LocalDateRange(LocalDate.parse('2024-02-19'), LocalDate.parse('2024-03-17')),
  april: new LocalDateRange(LocalDate.parse('2024-03-18'), LocalDate.parse('2024-04-22')),
  may: new LocalDateRange(LocalDate.parse('2024-04-22'), LocalDate.parse('2024-05-20')),
  june: new LocalDateRange(LocalDate.parse('2024-05-20'), LocalDate.parse('2024-06-16')),
  july: new LocalDateRange(LocalDate.parse('2024-06-17'), LocalDate.parse('2024-07-21')),
  september: new LocalDateRange(LocalDate.parse('2024-08-19'), LocalDate.parse('2024-09-22')),
  test: new LocalDateRange(LocalDate.parse('2025-06-21'), LocalDate.parse('2025-05-19')),
};

export type CleanerResponse = {
  cleaner: unknown & { firstName: string; lastName: string; silaeId: string };
  shifts: unknown[];
  leaves: unknown[];
  plannings: unknown[];
};

const displayTimecardDebug = (
  timecards: Readonly<Array<WorkingPeriodTimecard>>,
  logger: ReturnType<typeof prepareEnv>['log']['logger']
) =>
  List(timecards)
    .sortBy(tc => tc.workingPeriod.period.start.toString())
    .forEach(tc => {
      logger(tc.debug());
      logger('-------------------');
      logger(tc.contract.debug());
    });

export const fetchPayrollData = async ({ start, end }: LocalDateRange) => {
  const url = `${
    process.env.CARE_DATA_PARSER_URL || 'http://localhost:3000'
  }/payroll/${start.toString()}/${end.toString()}`;

  const r = await axios.get(url);
  return r.data as CleanerResponse[];
};

export const generatePayrollExports = ({
  period,
  debug = false,
  displayLog = true,
  env: {
    csvStream: { csvStreamDebug, csvStreamSilae, csvStreamWeekly, csvStreamCompiled },
    log: { total, failed, successful, logger },
  },
}: {
  period: LocalDateRange;
  debug?: boolean;
  displayLog?: boolean;
  env: ReturnType<typeof prepareEnv>;
}) => {
  if (debug) logger('start generatePayrollExports');

  let silaeBuffer: ReturnType<typeof formatCsvSilaeExport> = [];
  let debugBuffer: ReturnType<typeof formatCsvDetails> = [];
  let weeklyBuffer: ReturnType<typeof formatCsvWeekly> = [];
  let totalBuffer: ReturnType<typeof formatCsvTotal> = [];

  return pipe(
    TE.tryCatch(
      () => fetchPayrollData(period),
      e => {
        if (debug) logger(`Fetching cached data went wrong ${e}`);
        return new Error(`Fetching cached data from care data parser went wrong ${e}`);
      }
    ),
    TE.chainW(dataCleaners => {
      total = dataCleaners.length;
      return pipe(
        dataCleaners,
        // dataCleaners.filter(cleaner => cleaner.cleaner.silaeId === '00406'),
        TE.traverseArray(cleaner =>
          pipe(
            cleaner,
            parsePayload,
            TE.fromEither,
            TE.map(
              flow(
                formatPayload,
                computeTimecardForEmployee(period),
                E.map(results => {
                  if (displayLog) displayTimecardDebug(results.timecards, logger);
                  logger(`
                  ---------------------------------------------------------
                  Contracts
                  
                  ${results.contracts
                    .sortBy(a => a.startDate.toString())
                    .map(c => c.debug())
                    .join('\n')}
                  ---------------------------------------------------------
                  `);

                  silaeBuffer = silaeBuffer.concat(formatCsvSilaeExport(results, logger));
                  debugBuffer = debugBuffer.concat(formatCsvDetails(results));
                  weeklyBuffer = weeklyBuffer.concat(formatCsvWeekly(results));
                  totalBuffer = totalBuffer.concat(formatCsvTotal(results));

                  successful++;
                  if (debug)
                    logger(
                      `${results.employee.firstName} ${results.employee.lastName} - ${results.employee.silaeId} -  OK ${successful}/${total} (error : ${failed})`
                    );
                  return results;
                }),
                E.mapLeft(e => {
                  logger(
                    `error for ${cleaner.cleaner.firstName} + ${cleaner.cleaner.lastName} ${e}`
                  );
                  failed++;
                  return e;
                })
              )
            )
          )
        )
      );
    }),
    TE.tap(t => {
      if (debug) logger(` total : ${total}\nfailed : ${failed}\nsuccessful : ${successful}`);
      return TE.right(t);
    }),
    TE.chainW(results =>
      pipe(
        results,
        RA.sequence(E.Applicative),
        E.fold(
          e => {
            logger(`error for ${e}`);
            return TE.left(e);
          },
          values => {
            silaeBuffer.forEach(v => csvStreamSilae.write(v));
            debugBuffer.forEach(v => csvStreamDebug.write(v));
            weeklyBuffer.forEach(v => csvStreamWeekly.write(v));
            totalBuffer.forEach(v => csvStreamCompiled.write(v));
            return TE.of(values);
          }
        )
      )
    )
  );
};

const { DECEMBER, JANUARY, FEBRUARY, MAY, MARCH, APRIL, JUNE } = Month;

async function main() {
  try {
    const debug = process.argv.some(arg => ['--debug', '-d'].includes(arg));
    const periods2025 = new BillingPeriodDefinitionService().getBillingPeriodForMonths({
      // months: [JANUARY, FEBRUARY, MARCH, APRIL, MAY, JUNE],
      months: [MAY],
      year: '2025',
    });
    await pipe(
      periods2025,
      TE.fromEither,
      TE.chain(
        TE.traverseSeqArray(period => {
          const env = prepareEnv({
            period,
            debug,
            displayLog: true,
            persistence: 'logs',
          });
          if (debug) env.log.logger('start of script');

          return pipe(
            generatePayrollExports({ debug, period, env }),
            TE.chain(() => {
              // End all streams
              for (const streamName in env.csvStream) {
                env.csvStream[streamName].end();
              }

              // Wait for all streams to finish writing before proceeding to the next period
              return TE.tryCatch(
                async () => {
                  if (debug) env.log.logger('waiting for streams to finish...');
                  await env.waitForStreamsToFinish();
                  if (debug) env.log.logger('all streams finished');
                  return true;
                },
                error => new Error(`Error waiting for streams to finish: ${error}`)
              );
            }),
            TE.tap(() => {
              if (debug) env.log.logger('end of script');
              return TE.right(undefined);
            })
          );
        })
      )
    )();
  } catch (e) {
    console.error(e);
  }
}
main()
  .then(() => console.log('Job completed successfully'))
  .catch(e => console.error('Unhandled error:', e))
  .finally(() => {
    console.log('Exiting process...');
  });
