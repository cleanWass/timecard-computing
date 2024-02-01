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

// const period = new LocalDateRange(LocalDate.parse('2023-11-20'), LocalDate.parse('2023-12-17'));
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
          .reduce((acc, current) => (acc.some(t => t.cleanerid === current.cleanerid) ? acc : [...acc, current]), [])
          .map(({ cleanerid: id, silae_id: silaeId, cleanerfullname: fullName, type }) => ({
            silaeId,
            id,
            fullName,
            type,
          }))
      )
  ),
  TE.map(cleaners => {
    // console.log('cleaners', cleaners.slice(0, 10));
    log.total = cleaners.length;
    return cleaners;
  }),
  TE.chainW(cleaners => {
    return pipe(
      // cleaners
      // .sort((a, b) => Number.parseInt(a.silaeId) - Number.parseInt(b.silaeId))
      // .filter(c => [].includes(Number.parseInt(c.silaeId)))
      // .map(({ id, fullName }) =>
      [
        '0031n00002VSSs5AAH',
        '003AX000001gR75YAE',
        '0031n000027vVGeAAM',
        '0031n00002aLnC8AAK',
        '003AX000004oy76YAA',
        '003AX000002vhoGYAQ',
        '003AX0000033KaRYAU',
        '003AX000003j8CDYAY',
        '003AX000003mumdYAA',
        '003AX000003myIzYAI',
        '003AX000003nbGbYAI',
        '003AX000003nlHdYAI',
        '003AX000003PgI4YAK',
        '003AX000003rM29YAE',
        '003AX000003uAc4YAE',
        '003AX000003ugKsYAI',
        '003AX000003zYtvYAE',
        '003AX00000411CqYAI',
        '003AX0000042txxYAA',
        '003AX0000045IIXYA2',
        '003AX0000048cgwYAA',
        '003AX00000468tkYAA',
        '003AX0000048sxZYAQ',
        '003AX000004ATcjYAG',
        '003AX000004AQnAYAW',
        '003AX000004B5AyYAK',
        '003AX000003xb2MYAQ',
        '003AX000004BFc5YAG',
        '003AX0000043o3UYAQ',
        '003AX0000045HRzYAM',
        '003AX000004CanGYAS',
        '003AX000004CSfZYAW',
        '003AX000004uNWlYAM',
        '003AX000003VIXrYAO',
        '003AX000004H1JBYA0',
        '003AX000004IIlzYAG',
        '0031n0000214GYrAAM',
        '003AX000004KiTZYA0',
        '003AX000004Ltf9YAC',
        '003AX000004OQK8YAO',
        '003AX000004PYRQYA4',
        '003AX000004PcPPYA0',
        '003AX000004QZwNYAW',
        '003AX000004uR0gYAE',
        '003AX000004Qa1YYAS',
        '003AX000004SMFDYA4',
        '003AX000004SLQIYA4',
        '003AX000004SdWcYAK',
        '003AX000004TCQ2YAO',
        '003AX000004T2VDYA0',
        '003AX000004Uv0DYAS',
        '003AX000004sf5mYAA',
        '003AX000004smB2YAI',
        '003AX000004je22YAA',
        '003AX000004T4iNYAS',
        '003AX000004VQr1YAG',
        '003AX000004WHYQYA4',
        '003AX000004WfV8YAK',
        '003AX000004Xb6dYAC',
        '003AX0000041IKfYAM',
        '003AX0000041IK2YAM',
        '003AX000004bEAaYAM',
        '003AX000004dtvpYAA',
        '003AX000004dv2oYAA',
        '003AX000004dwYZYAY',
        '003AX000004dvPoYAI',
        '003AX000004fGFeYAM',
        '003AX000004fHFXYA2',
        '003AX000004fFz6YAE',
        '003AX000004fLTRYA2',
        '003AX000004fMMLYA2',
        '003AX000004fOkhYAE',
        '003AX000004ptXfYAI',
        '003AX000004skapYAA',
        '003AX000004sWYlYAM',
        '003AX000004txj7YAA',
        '003AX000004kt4rYAA',
        '003AX000004kvSuYAI',
        '003AX000004kydlYAA',
        '003AX000004siZ3YAI',
        '003AX000004uKiJYAU',
        '003AX000004wHCWYA2',
        '003AX000004wnqLYAQ',
        '003AX000004wzDrYAI',
        '003AX000004wXXqYAM',
        '003AX000005O1IFYA0',
        '003AX000005OuExYAK',
        '003AX000005OzsSYAS',
        '003AX000005P24JYAS',
        '003AX000005P5hRYAS',
        '003AX000005P7hdYAC',
        '003AX000005P7T3YAK',
        '003AX000005Q56NYAS',
        '003AX000005QDgyYAG',
        '003AX000004OShZYAW',
        '003AX000004sUFLYA2',
        '003AX000005QBivYAG',
        '003AX000005QBrOYAW',
        '003AX000005QRyaYAG',
        '003AX000005QQa0YAG',
        '003AX000005QknZYAS',
        '003AX000005Qr5XYAS',
        '0030Y00000KBjrBQAT',
        '003AX000005RD5xYAG',
        '003AX000005RZr5YAG',
      ].map(id =>
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
              E.map(t => {
                t.timecards.forEach(e => e.debug());
                return t;
              }),
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
    const cleanersData = await timecards();
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
