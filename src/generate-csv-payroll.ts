import { LocalDate } from '@js-joda/core';
import axios from 'axios';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';

import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { List } from 'immutable';
import { formatCsv, formatCsvDetails, formatCsvSilaeExport } from './application/csv-generation/export-csv';
import { prepareEnv } from './application/csv-generation/prepare-env';
import { computeTimecardForEmployee } from './application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from './domain/models/local-date-range';
import { WorkingPeriodTimecard } from './domain/models/time-card-computation/timecard/working-period-timecard';
import { formatPayload, parsePayload } from './infrastructure/validation/parse-payload';

const periods = {
  january: new LocalDateRange(LocalDate.parse('2023-12-18'), LocalDate.parse('2024-01-22')),
  february: new LocalDateRange(LocalDate.parse('2024-01-22'), LocalDate.parse('2024-02-18')),
  march: new LocalDateRange(LocalDate.parse('2024-02-19'), LocalDate.parse('2024-03-17')),
  april: new LocalDateRange(LocalDate.parse('2024-03-18'), LocalDate.parse('2024-04-22')),
  may: new LocalDateRange(LocalDate.parse('2024-04-22'), LocalDate.parse('2024-05-20')),
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
    cvsStream: { csvStreamFull, csvStreamSilae, csvStreamTotal },
    log: { total, failed, successful, logger },
  },
}: {
  period: LocalDateRange;
  debug?: boolean;
  displayLog?: boolean;
  env: ReturnType<typeof prepareEnv>;
}) => {
  if (debug) logger('start generatePayrollExports');

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
        // dataCleaners.filter(cleaner => cleaner.cleaner.silaeId === '00159'),
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

                  csvStreamTotal.write(formatCsv(results));
                  formatCsvDetails(results).forEach((value, key) => csvStreamFull.write(value));
                  formatCsvSilaeExport(results, logger).forEach((value, key) => csvStreamSilae.write(value));

                  successful++;
                  if (debug)
                    logger(
                      `${results.employee.firstName} ${results.employee.lastName} - ${results.employee.silaeId} -  OK ${successful}/${total} (error : ${failed})`
                    );
                  return results;
                }),
                E.mapLeft(e => {
                  logger(`error for ${cleaner.cleaner.firstName} + ${cleaner.cleaner.lastName} ${e}`);
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
            logger(`values for ${values}`);
            return TE.of(values);
          }
        )
      )
    )
  );
};

async function main() {
  try {
    const debug = process.argv.some(arg => ['--debug', '-d'].includes(arg));
    const env = prepareEnv({
      period: periods.may,
      debug,
      displayLog: false,
    });
    if (debug) env.log.logger('start of script');

    const t = await generatePayrollExports({ debug, period: periods.may, env })();
    for (const streamName in env.cvsStream) {
      env.cvsStream[streamName].end();
    }
    if (debug) env.log.logger('end of script');
  } catch (e) {
    console.error(e);
  }
}

main().catch(e => console.error(e));
