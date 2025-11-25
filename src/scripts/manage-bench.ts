import { DateTimeFormatter, LocalDate, LocalTime } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { benchManagementUseCases } from '../application/use-cases/manage-benches/manage-benches.use-case';
import { createS3Client } from '../config/aws.config';
import { EnvService } from '../config/env';
import { LocalDateRange } from '../domain/models/local-date-range';
import { LocalTimeSlot } from '../domain/models/local-time-slot';
import makeCareDataParserClient from '../infrastructure/http/care-data-parser/care-cata-parser.client';
import { makeS3Service } from '../infrastructure/storage/s3/s3.service';
import { getFirstDayOfWeek } from '../~shared/util/joda-helper';
import { Set } from 'immutable';

const DATE_FORMAT = 'dd/MM/yy';
const REQUIRED_ARGS_COUNT = 3;

const parseCommandLineArgs = (): LocalDateRange => {
  if (process.argv.length < REQUIRED_ARGS_COUNT) {
    throw new Error(`Usage: node script.js <start_date> <end_date> (format: ${DATE_FORMAT})`);
  }

  const [, , startArg] = process.argv;
  const formatter = DateTimeFormatter.ofPattern(DATE_FORMAT);

  const start = getFirstDayOfWeek(LocalDate.parse(startArg, formatter));

  return new LocalDateRange(start, start.plusWeeks(8).plusDays(1));
};

async function main() {
  console.log('start generatePayrollExports', process.argv[2]);

  const careDataCareClient = makeCareDataParserClient({
    baseUrl: EnvService.get('CARE_DATA_PARSER_URL'),
    apiKey: EnvService.get('CARE_DATA_PARSER_API_KEY'),
  });

  const s3Client = createS3Client();
  const s3Service = makeS3Service(s3Client);

  const {
    removeExtraBenches,
    generateMissingBenches,
    computeBenchesMatchingShiftsList,
    makeGenerateBenchManagementListUseCase,
  } = benchManagementUseCases(careDataCareClient);

  const period = parseCommandLineArgs();

  const ts1 = new LocalTimeSlot(LocalTime.of(12, 0), LocalTime.of(13, 0));
  const ts2 = new LocalTimeSlot(LocalTime.of(12, 0), LocalTime.of(13, 0));
  console.log(ts1.equals(ts2));
  console.log(
    Set([ts1, ts2])
      .map(ts => ts.toString())
      .toArray()
  );

  return pipe(
    TE.Do,
    TE.bind('removedBenches', () => removeExtraBenches.execute({ period })),
    TE.bind('generatedBenches', () => generateMissingBenches.execute({ period })),
    TE.bind('benchesMatchingShifts', () =>
      computeBenchesMatchingShiftsList(s3Service).execute({ period })
    ),
    TE.bind('benchManagementList', () =>
      makeGenerateBenchManagementListUseCase(s3Service).execute({ period })
    ),
    TE.foldW(
      e => {
        console.log('Error in bench generation', e);
        return T.of(e);
      },
      data => {
        console.log(
          `Bench management completed successfully: ${data.benchesMatchingShifts}
          ${data.removedBenches.flatMap(({ benches }) => benches.toArray()).length} removed benches
          ${data.generatedBenches.totalAffectationsCreated} generated benches
          `
        );
        return T.of(data);
      }
    )
  )();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
