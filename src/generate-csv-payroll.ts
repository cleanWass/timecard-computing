import { DateTimeFormatter, Duration, LocalDate, LocalTime } from '@js-joda/core';
import axios from 'axios';

import { format } from 'fast-csv';
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';

import fs from 'fs';
import { formatCsv, formatCsvDetails, formatCsvGroupedByContract } from './application/csv-generation/export-csv';
import { computeTimecardForEmployee } from './application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from './domain/models/local-date-range';
import { formatPayload, parsePayload } from './infrastructure/validation/parse-payload';
import { List, Set } from 'immutable';
import { formatDuration, formatDurationAs100 } from './~shared/util/joda-helper';

export const headers = [
  'Silae Id',
  'Salarié',
  'Fonction',
  'Période',
  // 'Durée hebdo',
  // 'Contrat',
  'Manager',
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

export const HeadersDetails = [
  'Silae Id',
  'Salarié',
  'Fonction',
  'Période',
  'Manager',
  '  L',
  '  Ma',
  '  Me',
  '  J',
  '  V',
  '  S',
  '  D',
  'R L',
  'R Ma',
  'R Me',
  'R J',
  'R V',
  'R S',
  'R D',
  'S L',
  'S Ma',
  'S Me',
  'S J',
  'S V',
  'S S',
  'S D',

  // 'Durée hebdo',
  // 'Contrat',
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
];

const prepareScriptEnv = ({
  period,
  debug = false,
  displayLog = true,
  splitFiles = true,
  timestamp = '',
}: {
  period: LocalDateRange;
  debug: boolean;
  displayLog: boolean;
  splitFiles: boolean;
  timestamp: string;
}) => {
  const currentMonth = period.end.month().toString().toLowerCase();
  console.log(currentMonth.toString());
  const currentTime = LocalTime.now().format(DateTimeFormatter.ofPattern('HH:mm'));
  const basePath = `exports/2024/${currentMonth}/${currentTime}`;

  [debug, displayLog, splitFiles, timestamp].forEach(flag => console.log(flag));

  if (!fs.existsSync(basePath)) {
    if (debug) console.log('create directory');
    fs.mkdirSync(basePath, { recursive: true });
  }

  const fileStreams = ['debug', 'total', 'single', 'multi', 'error', 'details'].reduce(
    (acc, type) => {
      const filename = `${basePath}/${currentMonth}-${currentTime}_${type}.csv`;
      acc[type] = fs.createWriteStream(filename);
      return acc;
    },
    {} as Record<string, fs.WriteStream>
  );

  const csvStreamSingle = format({ headers: [...headers] });
  csvStreamSingle.pipe(fileStreams['single']).on('end', () => process.exit());

  const csvStreamMulti = format({ headers: [...headers] });
  csvStreamMulti.pipe(fileStreams['multi']).on('end', () => process.exit());

  const csvStreamTotal = format({ headers: [...headers] });
  csvStreamTotal.pipe(fileStreams['total']).on('end', () => process.exit());

  const errorCsvStream = format({ headers: ['Matricule', 'Employé', 'Durée Intercontrat', 'Période'] });
  errorCsvStream.pipe(fileStreams['error']).on('end', () => process.exit());

  const csvStreamDetails = format({ headers: HeadersDetails });
  csvStreamDetails.pipe(fileStreams['details']).on('end', () => process.exit());

  return {
    csvStreamMulti,
    csvStreamSingle,
    csvStreamTotal,
    errorCsvStream,
    csvStreamDetails,
  };
};

const log = {
  total: 0,
  failed: 0,
  successful: 0,
};

const periods = {
  january: new LocalDateRange(LocalDate.parse('2023-12-18'), LocalDate.parse('2024-01-22')),
  february: new LocalDateRange(LocalDate.parse('2024-01-22'), LocalDate.parse('2024-02-18')),
  march: new LocalDateRange(LocalDate.parse('2024-02-19'), LocalDate.parse('2024-03-17')),
  april: new LocalDateRange(LocalDate.parse('2024-03-18'), LocalDate.parse('2024-04-22')),
  may: new LocalDateRange(LocalDate.parse('2024-04-22'), LocalDate.parse('2024-05-29')),
};

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
  streams: { csvStreamDebug, csvStreamDetails, csvStreamMulti, csvStreamSingle, csvStreamTotal, errorCsvStream },
}: {
  period: LocalDateRange;
  debug?: boolean;
  displayLog?: boolean;
  splitFiles?: boolean;
  streams: ReturnType<typeof prepareScriptEnv>;
}) => {
  console.log('streams', csvStreamSingle);

  return pipe(
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
                E.map(t => {
                  List(t.timecards)
                    .sort((a, b) => a.contract.startDate.compareTo(b.contract.startDate))
                    .forEach(tc => {
                      if (tc.getTotalIntercontractDuration().toMinutes() > 0) {
                        errorCsvStream.write({
                          Matricule: tc.employee.silaeId,
                          Employé: tc.employee.firstName + ' ' + tc.employee.lastName,
                          Période: tc.workingPeriod.period.toFormattedString(),
                          'Durée Intercontrat': formatDurationAs100(
                            tc.getTotalIntercontractDuration() || Duration.ZERO
                          ),
                        });
                      }
                    });
                  if (displayLog) {
                    List(t.timecards)
                      .sortBy(tc => tc.workingPeriod.period.start.toString())
                      .forEach(tc => tc.debug());
                  }
                  return t;
                }),
                E.map(results => {
                  const splitedFiles = formatCsvGroupedByContract(results);
                  if (splitedFiles.size === 1) {
                    csvStreamSingle.write(splitedFiles.first());
                  } else {
                    splitedFiles.forEach((value, key) => csvStreamMulti.write(value));
                  }

                  const total = formatCsv(results);
                  csvStreamTotal.write(total);

                  const details = formatCsvDetails(results);
                  details.forEach((value, key) => csvStreamDetails.write(value));

                  log.successful++;
                  console.log(
                    `${total.Salarié} - ${total['Silae Id']} -  OK ${log.successful}/${log.total} (error : ${log.failed})`
                  );
                  return results;
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
};

async function main() {
  try {
    console.log('start');

    const debug = process.argv.some(arg => ['debug', '-debug', '-d', 'd'].includes(arg));
    const streams = prepareScriptEnv({
      period: periods.may,
      splitFiles: true,
      debug: false,
      displayLog: true,
      timestamp: '',
    });

    await timecards({ debug: false, period: periods.may, streams })();
    for (const streamName in streams) {
      streams[streamName].end();
    }

    console.log('total', log.total);
    console.log('failed', log.failed);
    console.log('successful', log.successful);
  } catch (e) {
    console.error(e);
  }
}

main().catch(e => console.error(e));
