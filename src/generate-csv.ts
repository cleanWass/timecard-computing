import { LocalDate } from '@js-joda/core';

import { format } from 'fast-csv';
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';

import fs from 'fs';
import { fetchDataForEmployee, fetchEmployeeWithActiveContractDuringPeriod } from './app';
import { formatCsv } from './application/csv-generation/export-csv';
import { computeTimecardForEmployee } from './application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from './domain/models/local-date-range';
import { formatPayload, parsePayload } from './infrastructure/parsing/parse-payload';
import { RepositoryFailedCall } from './~shared/error/RepositoryFailedCall';

const ws = fs.createWriteStream('export.csv');
const errorFile = fs.createWriteStream('export_error.csv');

export const headers = [
  'Matricule',
  'Silae Id',
  'Salarié',
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

const csvStream = format({ headers: [...headers] });
const errorCsvStream = format({ headers: ['Matricule', 'error'] });

csvStream.pipe(ws).on('end', () => process.exit());
errorCsvStream.pipe(errorFile).on('end', () => process.exit());

const log = {
  total: 0,
  failed: 0,
  successful: 0,
};
// const period = new LocalDateRange(LocalDate.parse('2024-01-08'), LocalDate.parse('2024-01-15'));
const period = new LocalDateRange(LocalDate.parse('2023-12-18'), LocalDate.parse('2024-01-22'));

const timecards = pipe(
  TE.tryCatch(
    () => fetchEmployeeWithActiveContractDuringPeriod(period),
    e => {
      console.log(`Fetching from bridge went wrong`, e);
      return new Error(`Fetching from care data parser went wrong ${e}`);
    }
  ),

  TE.fold(
    e => TE.left(e),
    cleaners =>
      TE.right(
        cleaners
          .reduce(
            (acc, current) => (acc.some(t => t.id === current.id) ? acc : [...acc, current]),
            [] as {
              id: string;
              type: string;
              firstName: string;
              lastName: string;
              silaeId: string;
            }[]
          )
          .map(({ id, silaeId, lastName, firstName, type }) => ({
            silaeId,
            id,
            fullName: `${firstName} ${lastName}`,
            type,
          }))
      )
  ),
  TE.map(cleaners => {
    log.total = cleaners.length;
    console.log('cleaners', log.total);
    return cleaners;
  }),
  TE.chainW(cleaners => {
    return pipe(
      cleaners
        .sort((a, b) => Number.parseInt(a.silaeId) - Number.parseInt(b.silaeId))
        // .filter(c => [949, 950].includes(Number.parseInt(c.silaeId)))
        .map(({ id, fullName }) =>
          // [
          //   '0030Y00000iDfWQQA0',
          // ].map(id =>
          pipe(
            TE.tryCatch(
              () => fetchDataForEmployee(id, period),
              e => {
                log.failed++;
                return new RepositoryFailedCall(`Fetching from care data parser went wrong for cleanerID: ${id} ==> ${e}`);
              }
            ),
            TE.chainW(flow(parsePayload, TE.fromEither)),
            TE.map(
              flow(
                formatPayload,
                computeTimecardForEmployee(period),
                E.mapLeft(e => {
                  log.failed++;
                  // console.log(`${fullName} ${id} error : `);
                  // errorCsvStream.write({ Matricule: `${fullName} ${id}`, error: e.message });
                  return e;
                }),
                // E.map(t => {
                //   t.timecards.forEach(e => e.debug());
                //   return t;
                // }),
                E.map(formatCsv),
                E.map(row => {
                  csvStream.write(row);

                  log.successful++;
                  console.log(`${row['Salarié']} - ${row['Silae Id']} -  OK ${log.successful}/${log.total} (error : ${log.failed})`);
                  return row;
                })
              )
            ),
            TE.foldW(
              failed => TE.left(failed),
              result => TE.right(result)
            )
          )
        ),
      TE.sequenceSeqArray
    );
  }),

  TE.fold(
    e => {
      return T.never;
    },
    result => {
      return T.of(result);
    }
  )
);

async function main() {
  try {
    await timecards();
    csvStream.end();
    errorCsvStream.end();

    console.log('total', log.total);
    console.log('failed', log.failed);
    console.log('successful', log.successful);
  } catch (e) {
    console.error(e);
  }
}

main().catch(e => console.error(e));
