import { Duration, LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { Map, Set } from 'immutable';
import { fetchEmployeeWithActiveContractDuringPeriod, fetchDataForEmployee } from './app';
import { computeTimecardForEmployee } from './application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from './domain/models/local-date-range';
import { WorkingPeriodTimecard } from './domain/models/time-card-computation/timecard/working-period-timecard';
import { ParseError } from './domain/~shared/error/parse-error';
import { formatPayload, parsePayload } from './infrastructure/parsing/parse-payload';

import fs from 'fs';

import { format } from 'fast-csv';
import { RepositoryFailedCall } from './~shared/error/RepositoryFailedCall';
import { formatDurationAs100 } from './~shared/util/joda-helper';

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

const period = new LocalDateRange(LocalDate.parse('2023-11-20'), LocalDate.parse('2023-12-17'));

let total = 0;
let failed = 0;
let successful = 0;

console.log(period.toFormattedString());
const timecards = pipe(
  TE.tryCatch(
    () => fetchEmployeeWithActiveContractDuringPeriod(period),
    e => {
      console.log(`Fetching from bridge went wrong`, e);
      return new Error(`Fetching from care data parser went wrong ${e}`);
    }
  ),
  TE.chainW(cleaners => {
    const curatedCleaner = cleaners
      .reduce((acc, current) => (acc.some(t => t.cleanerid === current.cleanerid) ? acc : [...acc, current]), [])
      .map(({ cleanerid: id, silae_id: silaeId, cleanerfullname: fullName, type }) => ({
        silaeId,
        id,
        fullName,
        type,
      }));
    console.log('curatedCleaner', curatedCleaner.slice(90, 100));
    total = curatedCleaner.length;
    return pipe(
      curatedCleaner.map(({ id, fullName }) =>
        pipe(
          TE.tryCatch(
            () => fetchDataForEmployee(id, period),
            e => {
              failed++;
              return new RepositoryFailedCall(`Fetching from care data parser went wrong for cleanerID: ${id} ==> ${e}`);
            }
          ),
          TE.chainW(flow(parsePayload, TE.fromEither)),
          TE.map(
            flow(
              formatPayload,
              computeTimecardForEmployee(period),
              E.mapLeft(e => {
                failed++;
                console.log(`${fullName} ${id} error : `);
                errorCsvStream.write({ Matricule: `${fullName} ${id}`, error: e.message });
                return e;
              }),
              E.map(row => {
                const groupedTc = row.timecards.groupBy(tc => tc.contract);
                const totalTcs = WorkingPeriodTimecard.getTotal(row.timecards);
                csvStream.write({
                  Matricule: row.employee.id || '0',
                  Salarié: row.employee.firstName + ' ' + row.employee.lastName || '0',
                  Période: row.contracts.first().period(row.period.end).toFormattedString(),
                  HN: formatDurationAs100(totalTcs.TotalNormal) || '0',
                  HC10: formatDurationAs100(totalTcs.TenPercentRateComplementary) || '0',
                  HC11: formatDurationAs100(totalTcs.ElevenPercentRateComplementary) || '0',
                  HC25: formatDurationAs100(totalTcs.TwentyFivePercentRateComplementary) || '0',
                  HS25: formatDurationAs100(totalTcs.TwentyFivePercentRateSupplementary) || '0',
                  HS50: formatDurationAs100(totalTcs.FiftyPercentRateSupplementary) || '0',
                  HNuit: formatDurationAs100(totalTcs.NightShiftContract) || '0',
                  MajoNuit100: formatDurationAs100(totalTcs.NightShiftAdditional) || '0',
                  HDim: formatDurationAs100(totalTcs.SundayContract) || '0',
                  MajoDim100: formatDurationAs100(totalTcs.SundayAdditional) || '0',
                });

                successful++;
                console.log(`${row.employee.firstName} ${row.employee.lastName} OK ${successful}/${total} (error : ${failed})`);
                return row;
              })
            )
          ),
          TE.foldW(
            failed => TE.right(failed),
            result => TE.right(result)
          )
        )
      ),
      TE.sequenceSeqArray
    );
  }),
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
