import { Duration, LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { Map } from 'immutable';
import { fetchAllCleaners, fetchDataForEmployee } from './app';
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
const errorCsvStream = format({ headers: [...headers] });

csvStream.pipe(ws).on('end', () => process.exit());
errorCsvStream.pipe(ws).on('end', () => process.exit());

const period = new LocalDateRange(LocalDate.parse('2023-11-20'), LocalDate.parse('2023-12-17'));

let total = 0;
let failed = 0;
let successful = 0;

const timecards1 = pipe(
  TE.tryCatch(
    () => fetchAllCleaners(),
    e => new Error(`Fetching from care data parser went wrong ${e}`)
  ),
  TE.chain(cleaners => {
    total = cleaners.length;
    return pipe(
      cleaners,
      TE.traverseSeqArray(({ id, firstName, lastName }) =>
        pipe(
          TE.tryCatch(
            () => fetchDataForEmployee(id, period),
            e => {
              failed++;
              return new RepositoryFailedCall(`Fetching data went wrong for cleanerID: ${id} ==> ${e}`);
            }
          ),
          TE.chainW(flow(parsePayload, TE.fromEither)),
          TE.map(
            flow(
              formatPayload,
              computeTimecardForEmployee(period),
              E.mapLeft(e => {
                console.log(`${firstName} ${lastName} error: ${e}`);
                failed++;
                return e;
              }),
              E.map(row => {
                const groupedTc = row.timecards.groupBy(tc => tc.contract);

                groupedTc.forEach((tcs, contract) => {
                  csvStream.write({
                    Matricule: row.employee.id || '0',
                    Salarié: row.employee.firstName + ' ' + row.employee.lastName || '0',
                    Période: contract.period(row.period.end).toFormattedString(),
                    HN: formatDurationAs100(tcs.reduce((res, tc) => res.plus(tc.workedHours.TotalNormal), Duration.ZERO)) || '0',
                    HC10:
                      formatDurationAs100(tcs.reduce((res, tc) => res.plus(tc.workedHours.TenPercentRateComplementary), Duration.ZERO)) ||
                      '0',
                    HC11:
                      formatDurationAs100(
                        tcs.reduce((res, tc) => res.plus(tc.workedHours.ElevenPercentRateComplementary), Duration.ZERO)
                      ) || '0',
                    HC25:
                      formatDurationAs100(
                        tcs.reduce((res, tc) => res.plus(tc.workedHours.TwentyFivePercentRateComplementary), Duration.ZERO)
                      ) || '0',
                    HS25:
                      formatDurationAs100(
                        tcs.reduce((res, tc) => res.plus(tc.workedHours.TwentyFivePercentRateSupplementary), Duration.ZERO)
                      ) || '0',
                    HS50:
                      formatDurationAs100(tcs.reduce((res, tc) => res.plus(tc.workedHours.FiftyPercentRateSupplementary), Duration.ZERO)) ||
                      '0',
                    HNuit: formatDurationAs100(tcs.reduce((res, tc) => res.plus(tc.workedHours.NightShiftContract), Duration.ZERO)) || '0',
                    MajoNuit100:
                      formatDurationAs100(tcs.reduce((res, tc) => res.plus(tc.workedHours.NightShiftAdditional), Duration.ZERO)) || '0',
                    HDim: formatDurationAs100(tcs.reduce((res, tc) => res.plus(tc.workedHours.SundayContract), Duration.ZERO)) || '0',
                    MajoDim100:
                      formatDurationAs100(tcs.reduce((res, tc) => res.plus(tc.workedHours.SundayAdditional), Duration.ZERO)) || '0',
                  });
                });
                console.log(`${row.employee.firstName} ${row.employee.lastName} OK ${successful}/${total} (error : ${failed})`);
                successful++;
                return row;
              })
            )
          )
        )
      )
    );
  }),
  TE.fold(
    e => {
      console.error(e);
      return T.never;
    },
    result => {
      return T.of(result);
    }
  )
);

const timecards = pipe(
  TE.tryCatch(
    () => fetchAllCleaners(),
    e => new Error(`Fetching from care data parser went wrong ${e}`)
  ),
  TE.chainW(cleaners => {
    total = cleaners.length;
    return pipe(
      cleaners.map(({ id, firstName, lastName }) =>
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
                console.log(`${firstName} ${lastName} error : `);
                errorCsvStream.write({ Matricule: firstName + ' ' + lastName, error: e.message });
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
    // await writeCsvData(cleanersData);
    console.log('total', total);
    console.log('failed', failed);
    console.log('successful', successful);
  } catch (e) {
    console.error(e);
  }
}

main().catch(e => console.error(e));
