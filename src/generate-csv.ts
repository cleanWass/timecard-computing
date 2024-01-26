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

const headers = [
  'Matricule',
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

const period = new LocalDateRange(LocalDate.parse('2023-11-20'), LocalDate.parse('2023-12-17'));

const timecards = pipe(
  TE.tryCatch(
    () => fetchEmployeeWithActiveContractDuringPeriod(period),
    e => {
      console.log(`Fetching from bridge went wrong`, e);
      return new Error(`Fetching from care data parser went wrong ${e}`);
    }
  ),
  TE.map(cleaners =>
    cleaners
      .reduce((acc, current) => (acc.some(t => t.cleanerid === current.cleanerid) ? acc : [...acc, current]), [])
      .map(
        ({ cleanerid: id, silae_id: silaeId, cleanerfullname: fullName, type }) =>
          ({
            silaeId,
            id,
            fullName,
            type,
          }) as {
            silaeId: string;
            id: string;
            fullName: string;
            type: string;
          }
      )
  ),

  TE.chain(cleaners =>
    pipe(
      cleaners,
      TE.traverseSeqArray(
        ({ id, fullName }) =>
          TE.tryCatch(
            () => fetchDataForEmployee(id, period),
            e => new RepositoryFailedCall(`Fetching from care data parser went wrong for cleanerID: ${id} ==> ${e}`)
          ),
        TE.chainW(flow(parsePayload, TE.fromEither)),
        TE.map(
          flow(
            formatPayload,
            computeTimecardForEmployee(period),
            E.mapLeft(e => {
              console.log(`${fullName} ${id} error : `);
              errorCsvStream.write({ Matricule: `${fullName} ${id}`, error: e.message });
              return e;
            }),
            E.map(formatCsv)
          )
        ),
        TE.foldW(
          failed => TE.right(failed),
          result => TE.right(result)
        )
      )
    )
  ),
  TE.fold(
    e => {
      // console.log(e.message);
      return T.never;
    },
    result => {
      return T.of(result);
    }
  )
);

async function main() {
  try {
    const cleanersData = await timecards();
    csvStream.end();
    errorCsvStream.end();
    // await writeCsvData(cleanersData);
    console.log('total', total);
    console.log('failed', failed);
    console.log('successful', successful);
  } catch (e) {
    console.error(e);
  }
}

main().catch(e => console.error(e));
