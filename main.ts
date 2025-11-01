import { DateTimeFormatter, LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { List } from 'immutable';
import { prepareEnv } from './src/application/csv-generation/prepare-env';
import { computeTimecardForEmployee } from './src/application/timecard-computation/compute-timecard-for-employee';
import { LocalDateRange } from './src/domain/models/local-date-range';
import { WorkingPeriodTimecard } from './src/domain/models/timecard-computation/timecard/working-period-timecard';
import { HolidayComputationService } from './src/domain/service/holiday-computation/holiday-computation-service';
import { fetchPayrollData, generatePayrollExports } from './src/generate-csv-payroll';
import { formatPayload, parsePayload } from './src/infrastructure/validation/parse-payload';

const period = new LocalDateRange(LocalDate.of(2023, 1, 1), LocalDate.of(2025, 12, 31));
const holidays = new HolidayComputationService().computeHolidaysForLocale('FR-75', period);
pipe(
  holidays,
  E.map(hls =>
    console.log(
      hls
        .sort((a, b) => a.compareTo(b))
        .map(hl => hl.format(DateTimeFormatter.ofPattern('dd-MM-yy')))
        .join('\n')
    )
  )
);

const displayTimecardDebug = (timecards: Readonly<Array<WorkingPeriodTimecard>>) =>
  List(timecards)
    .sortBy(tc => tc.workingPeriod.period.start.toString())
    .forEach(tc => {
      console.log(tc.debug());
      console.log('-------------------');
      console.log(tc.contract.debug());
    });

const generate = pipe(
  TE.tryCatch(
    () => fetchPayrollData(period),
    e => {
      return new Error(`Fetching cached data from care data parser went wrong ${e}`);
    }
  ),

  TE.chainW(dataCleaners => {
    console.log('dataCleaners', dataCleaners.length);
    return pipe(
      // dataCleaners,
      dataCleaners.filter(cleaner => cleaner.cleaner.silaeId === '00001'),
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
                displayTimecardDebug(results.timecards);
                return results;
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
    console.log('start generatePayrollExports');
    const t = await generate();
    console.log('end generatePayrollExports');
  } catch (e) {
    console.error(e);
  }
}

main().catch(e => console.error(e));
