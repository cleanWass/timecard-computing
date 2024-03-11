import { LocalDate } from '@js-joda/core';
import axios from 'axios';

import { format } from 'fast-csv';
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import fs from 'fs';
import { formatCsvGroupedByContract } from './application/csv-generation/export-csv';
import { computeTimecardForEmployee } from './application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from './domain/models/local-date-range';
import { formatPayload, parsePayload } from './infrastructure/validation/parse-payload';

const ws_debug = fs.createWriteStream('export_debug.csv');
const ws_single_line = fs.createWriteStream('export_février_2024_single_line.csv');
const ws_multi_lines = fs.createWriteStream('export_février_2024_multi_lines.csv');
const errorFile = fs.createWriteStream('export_error.csv');

export const headers = [
  'Silae Id',
  'Salarié',
  'Fonction',
  'Période',
  'HN',
  'HC10',
  'HC11',
  'HC25',
  'HS25',
  'HS50',
  'HNuit',
  'MajoNuit100',
  'HDim',
  'MajoDim100',
  'NbTicket',
] as const;

const csvStreamDebug = format({ headers: [...headers] });
const csvStreamSingle = format({ headers: [...headers] });
const csvStreamMulti = format({ headers: [...headers] });
const errorCsvStream = format({ headers: ['Matricule', 'error'] });

csvStreamDebug.pipe(ws_debug).on('end', () => process.exit());
csvStreamSingle.pipe(ws_single_line).on('end', () => process.exit());
csvStreamMulti.pipe(ws_multi_lines).on('end', () => process.exit());
errorCsvStream.pipe(errorFile).on('end', () => process.exit());

const log = {
  total: 0,
  failed: 0,
  successful: 0,
};
// const period = new LocalDateRange(LocalDate.parse('2024-01-08'), LocalDate.parse('2024-01-15'));
const periodJanvier = new LocalDateRange(LocalDate.parse('2023-12-18'), LocalDate.parse('2024-01-22'));
const periodFévrier = new LocalDateRange(LocalDate.parse('2024-01-22'), LocalDate.parse('2024-02-18'));

export type CleanerResponse = {
  cleaner: unknown;
  shifts: unknown[];
  leaves: unknown[];
  plannings: unknown[];
};

export const fetchPayrollData = ({ start, end }: LocalDateRange) => {
  const url = 'http://localhost:3000/payroll/' + start.toString() + '/' + end.toString();

  return axios.get(url).then(r => {
    return r.data as CleanerResponse[];
  });
};

const timecards = ({
  period,
  debug = false,
  displayLog = true,
  splitFiles = true,
}: {
  period: LocalDateRange;
  debug?: boolean;
  displayLog?: boolean;
  splitFiles?: boolean;
}) =>
  pipe(
    TE.tryCatch(
      () => fetchPayrollData(period),
      e => {
        console.log(`Fetching cached data went wrong`, e);
        return new Error(`Fetching cached data from care data parser went wrong ${e}`);
      }
    ),
    TE.map(dataCleaners => {
      log.total = dataCleaners.length;
      return dataCleaners;
    }),
    TE.chainW(dataCleaners => {
      return pipe(
        dataCleaners,
        TE.traverseArray(cleaner =>
          pipe(
            cleaner,
            flow(parsePayload, TE.fromEither),
            TE.map(
              flow(
                formatPayload,
                computeTimecardForEmployee(period),
                E.map(formatCsvGroupedByContract),
                E.map(row => {
                  if (debug === true) {
                    row.forEach((value, key) => csvStreamDebug.write(value));
                  } else {
                    if (row.size === 1) {
                      csvStreamSingle.write(row.first());
                    } else {
                      row.forEach((value, key) => csvStreamMulti.write(value));
                    }
                  }

                  log.successful++;
                  console.log(
                    // @ts-ignore
                    `${row.first().Salarié} - ${row.first()['Silae Id']} -  OK ${log.successful}/${
                      log.total
                    } (error : ${log.failed})`
                  );
                  return row;
                })
              )
            )

            // TE.map(
            //   computeTimecardForEmployee(period),
            //   TE.mapLeft(e => [cleaner.cleaner, e])
          )
        )
      );
    })
  );

async function main() {
  try {
    const debug = process.argv.some(arg => ['debug', '-debug', '-d', 'd'].includes(arg));
    await timecards({ debug, period: periodFévrier })();
    csvStreamSingle.end();
    csvStreamMulti.end();
    errorCsvStream.end();

    console.log('total', log.total);
    console.log('failed', log.failed);
    console.log('successful', log.successful);
  } catch (e) {
    console.error(e);
  }
}

main().catch(e => console.error(e));
