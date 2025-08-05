import { DateTimeFormatter, LocalDate } from '@js-joda/core';
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
import {
  fetchDataForEmployee,
  fetchTimecardData,
  fetchTimecardDataForEmployees,
} from './infrastructure/server/timecard-route-service';
import { formatPayload, parsePayload } from './infrastructure/validation/parse-payload';
import { ParseError } from './~shared/error/ParseError';

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

const fetchTimecardData_O = ({ silaeId, period }: { silaeId: string; period: LocalDateRange }) =>
  TE.tryCatchK(
    () => fetchDataForEmployee(silaeId, period),
    e => new ParseError(`Fetching from care data parser went wrong ${e}`)
  )();

export const generateCsvFromUncachedDataForPeriod = ({
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

  let totalBuffer: ReturnType<typeof formatCsvTotal> = [];
  let silaeBuffer: ReturnType<typeof formatCsvSilaeExport> = [];
  let debugBuffer: ReturnType<typeof formatCsvDetails> = [];
  let weeklyBuffer: ReturnType<typeof formatCsvWeekly> = [];

  return pipe(
    fetchTimecardDataForEmployees(period),
    TE.map(dataCleaners => {
      console.log('dataCleaners : ', dataCleaners.length);
      return dataCleaners
        .filter(cle => !!cle?.silaeId)
        .toSorted((a, b) => (a.silaeId || '')?.localeCompare(b.silaeId));
    }),
    TE.chainW(TE.traverseSeqArray(({ silaeId }) => fetchTimecardData_O({ period, silaeId }))),
    TE.chainW(dataCleaners => {
      total = dataCleaners.length;
      return pipe(
        dataCleaners,
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
                  totalBuffer = totalBuffer.concat(formatCsvTotal(results));
                  silaeBuffer = silaeBuffer.concat(formatCsvSilaeExport(results, logger));
                  debugBuffer = debugBuffer.concat(formatCsvDetails(results));
                  weeklyBuffer = weeklyBuffer.concat(formatCsvWeekly(results));

                  successful++;

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
            totalBuffer.forEach(v => csvStreamCompiled.write(v));
            silaeBuffer.forEach(v => csvStreamSilae.write(v));
            debugBuffer.forEach(v => csvStreamDebug.write(v));
            debugBuffer.forEach(v => csvStreamWeekly.write(v));
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

    let start = LocalDate.of(2024, 2, 1);

    const periods = [
      // ['18.12.2023', '31.12.2023'],
      // ['22.01.2024', '31.01.2024'],
      // ['19.02.2024', '29.02.2024'],
      // ['18.03.2024', '31.03.2024'],
      // ['22.04.2024', '30.04.2024'],
      // ['20.05.2024', '31.05.2024'],
      // ['17.06.2024', '30.06.2024'],
      // ['22.07.2024', '31.07.2024'],
      // ['19.08.2024', '31.08.2024'],
      // ['23.09.2024', '30.09.2024'],
      // ['21.10.2024', '31.10.2024'],
      // ['18.11.2024', '30.11.2024'],
      ['16.12.2024', '31.12.2024'],
    ] as const;

    for (const [startStr, endStr] of periods) {
      const start = LocalDate.parse(startStr, DateTimeFormatter.ofPattern('dd.MM.yyyy'));
      const end = LocalDate.parse(endStr, DateTimeFormatter.ofPattern('dd.MM.yyyy'));
      const period = new LocalDateRange(start, end.plusDays(1));

      const env = prepareEnv({
        period,
        debug,
        displayLog: true,
        persistence: 'none',
      });
      if (debug) env.log.logger('start of script');

      const t = await generateCsvFromUncachedDataForPeriod({ debug, period, env })();

      for (const streamName in env.csvStream) {
        env.csvStream[streamName].end();
      }
      if (debug) env.log.logger('end of script');
    }
  } catch (e) {
    console.error(e);
  }
}

// main().catch(e => console.error(e));
