import { LocalDate } from '@js-joda/core';
import axios from 'axios';

import { format } from 'fast-csv';
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import fs from 'fs';
import { formatCsv, formatCsvGroupedByContract } from './application/csv-generation/export-csv';
import { computeTimecardForEmployee } from './application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from './domain/models/local-date-range';
import { formatPayload, parsePayload } from './infrastructure/validation/parse-payload';
import { List, Set } from 'immutable';

const ws_debug = fs.createWriteStream('export_debug.csv');
const ws_total = fs.createWriteStream('export_mars_2024.csv');
// const ws_single_line = fs.createWriteStream('export_mars_2024_single_line.csv');
// const ws_multi_lines = fs.createWriteStream('export_mars_2024_multi_lines.csv');
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
const csvStreamTotal = format({ headers: [...headers] });
const csvStreamSingle = format({ headers: [...headers] });
const csvStreamMulti = format({ headers: [...headers] });
const errorCsvStream = format({ headers: ['Matricule', 'Employé', 'Durée Intercontrat', 'Période'] });

csvStreamDebug.pipe(ws_debug).on('end', () => process.exit());
csvStreamTotal.pipe(ws_total).on('end', () => process.exit());
// csvStreamSingle.pipe(ws_single_line).on('end', () => process.exit());
// csvStreamMulti.pipe(ws_multi_lines).on('end', () => process.exit());
errorCsvStream.pipe(errorFile).on('end', () => process.exit());

const log = {
  total: 0,
  failed: 0,
  successful: 0,
};

const periodJanvier = new LocalDateRange(LocalDate.parse('2023-12-18'), LocalDate.parse('2024-01-22'));
const periodFévrier = new LocalDateRange(LocalDate.parse('2024-01-22'), LocalDate.parse('2024-02-18'));
const periodMars = new LocalDateRange(LocalDate.parse('2024-02-19'), LocalDate.parse('2024-03-17'));

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
      // @ts-ignore
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
                E.map(t => {
                  List(t.timecards)
                    .sort((a, b) => a.contract.startDate.compareTo(b.contract.startDate))
                    .forEach(tc => {
                      if (tc.getTotalIntercontractDuration().toMinutes() > 0) {
                        errorCsvStream.write({
                          Matricule: tc.employee.silaeId,
                          Employé: tc.employee.firstName + ' ' + tc.employee.lastName,
                          'Durée Intercontrat': tc.getTotalIntercontractDuration().toString(),
                          Période: tc.workingPeriod.period.toFormattedString(),
                        });
                      }
                    });
                  return t;
                }),
                E.map(formatCsv),
                // E.map(row => {
                //   if (debug) {
                //     row.forEach((value, key) => csvStreamDebug.write(value));
                //   } else {
                //     if (row.size === 1) {
                //       csvStreamSingle.write(row.first());
                //     } else {
                //       row.forEach((value, key) => csvStreamMulti.write(value));
                //     }
                //   }
                //   log.successful++;
                //   console.log(
                //     `${row.first().Salarié} - ${row?.first()['Silae Id']} -  OK ${log.successful}/${
                //       log.total
                //     } (error : ${log.failed})`
                //   );
                //   return row;
                // }),
                E.map(row => {
                  csvStreamTotal.write(row);

                  log.successful++;
                  console.log(
                    `${row.Salarié} - ${row['Silae Id']} -  OK ${log.successful}/${log.total} (error : ${log.failed})`
                  );
                  return row;
                }),
                E.mapLeft(e => {
                  console.log(`error for ${cleaner.cleaner.firstName} + ${cleaner.cleaner.lastName} ${e}`);
                  log.failed++;
                  return e;
                })
              )
            )
          )
        )
      );
    })
  );

async function main() {
  try {
    console.log('start');
    const debug = process.argv.some(arg => ['debug', '-debug', '-d', 'd'].includes(arg));
    await timecards({ debug, period: periodMars })();
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
