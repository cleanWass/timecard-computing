import { LocalDate } from '@js-joda/core';

import { format } from 'fast-csv';
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';

import fs from 'fs';
import { fetchDataForEmployee, fetchEmployeeWithActiveContractDuringPeriod } from './app';
import { formatCsvGroupedByContract } from './application/csv-generation/export-csv';
import { computeTimecardForEmployee } from './application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from './domain/models/local-date-range';
import { formatPayload, parsePayload } from './infrastructure/parsing/parse-payload';
import { RepositoryFailedCall } from './~shared/error/RepositoryFailedCall';

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

const csvStreamSingle = format({ headers: [...headers] });
const csvStreamMulti = format({ headers: [...headers] });
const errorCsvStream = format({ headers: ['Matricule', 'error'] });

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
const periodFévrier = new LocalDateRange(LocalDate.parse('2024-01-22'), LocalDate.parse('2024-02-19'));

let period = periodFévrier;

const timecards = pipe(
  TE.tryCatch(
    () => fetchEmployeeWithActiveContractDuringPeriod(period),
    (e) => {
      console.log(`Fetching from bridge went wrong`, e);
      return new Error(`Fetching from care data parser went wrong ${e}`);
    },
  ),

  TE.fold(
    (e) => TE.left(e),
    (cleaners) =>
      TE.right(
        cleaners
          .reduce(
            (acc, current) => (acc.some((t) => t.silaeId === current.silaeId) ? acc : [...acc, current]),
            [] as {
              id: string;
              type: string;
              firstName: string;
              lastName: string;
              silaeId: string;
            }[],
          )
          .map(({ id, silaeId, lastName, firstName, type }) => ({
            silaeId,
            id,
            fullName: `${firstName} ${lastName}`,
            type,
          })),
      ),
  ),
  TE.map((cleaners) => {
    log.total = cleaners.length;
    return cleaners;
  }),
  TE.chainW((cleaners) => {
    return pipe(
      cleaners
        .sort((a, b) => Number.parseInt(a.silaeId) - Number.parseInt(b.silaeId))
        // .slice(434)
        // .filter((c) => [642].includes(Number.parseInt(c.silaeId)))
        .map(({ silaeId, fullName }) =>
          pipe(
            TE.tryCatch(
              () => fetchDataForEmployee(silaeId, period),
              (e) => {
                log.failed++;
                return new RepositoryFailedCall(
                  `Fetching from care data parser went wrong for silaeId: ${silaeId} ==> ${e}`,
                );
              },
            ),
            TE.chainW(flow(parsePayload, TE.fromEither)),
            TE.map(
              flow(
                formatPayload,
                computeTimecardForEmployee(period),
                E.mapLeft((e) => {
                  log.failed++;
                  return e;
                }),
                E.map(formatCsvGroupedByContract),
                E.map((row) => {
                  if (row.size === 1) {
                    csvStreamSingle.write(row.first());
                  } else {
                    row.forEach((value, key) => csvStreamMulti.write(value));
                  }

                  log.successful++;
                  console.log(`${fullName} - ${silaeId} -  OK ${log.successful}/${log.total} (error : ${log.failed})`);
                  return row;
                }),
              ),
            ),
            TE.foldW(
              (failed) => TE.left(failed),
              (result) => TE.right(result),
            ),
          ),
        ),
      TE.sequenceSeqArray,
    );
  }),

  TE.fold(
    (e) => {
      return T.never;
    },
    (result) => {
      return T.of(result);
    },
  ),
);

async function main() {
  try {
    await timecards();
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

main().catch((e) => console.error(e));
