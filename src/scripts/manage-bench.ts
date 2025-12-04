import { DateTimeFormatter, LocalDate } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { benchManagementUseCases } from '../application/use-cases/manage-benches/manage-benches.use-case';
import { createS3Client } from '../config/aws.config';
import { EnvService } from '../config/env';
import { LocalDateRange } from '../domain/models/local-date-range';
import makeCareDataParserClient from '../infrastructure/http/care-data-parser/care-cata-parser.client';
import { makeS3Service } from '../infrastructure/storage/s3/s3.service';
import { getFirstDayOfWeek } from '../~shared/util/joda-helper';

const DATE_FORMAT = 'dd/MM/yy';
const REQUIRED_ARGS_COUNT = 3;

const parseCommandLineArgs = (): LocalDateRange => {
  if (process.argv.length < REQUIRED_ARGS_COUNT) {
    throw new Error(`Usage: node script.js <start_date> <end_date> (format: ${DATE_FORMAT})`);
  }

  const [, , startArg] = process.argv;
  const formatter = DateTimeFormatter.ofPattern(DATE_FORMAT);

  const start = getFirstDayOfWeek(LocalDate.parse(startArg, formatter));

  return new LocalDateRange(start, start.plusWeeks(9));
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
    makeRemoveBenchesDuringLeavePeriodsUseCase,
  } = benchManagementUseCases(careDataCareClient);

  const period = parseCommandLineArgs();

  return pipe(
    TE.Do,
    // TE.bind('benchesDuringLeavePeriods', () =>
    //   makeRemoveBenchesDuringLeavePeriodsUseCase.execute({ period })
    // ),
    // TE.tapIO(() => () => console.log('Removed benches during leave periods')),
    // TE.bind('removedBenches', () => removeExtraBenches.execute({ period })),
    // TE.tapIO(() => () => console.log('Removed exceeding benches')),
    // TE.bind('generatedBenches', () => generateMissingBenches.execute({ period })),
    // TE.tapIO(() => () => console.log('Generated missing benches')),
    // TE.bind('benchesMatchingShifts', () =>
    //   computeBenchesMatchingShiftsList(s3Service).execute({ period })
    // ),
    TE.bind('benchManagementList', () =>
      makeGenerateBenchManagementListUseCase(s3Service).execute({ period })
    ),
    TE.tapIO(() => () => console.log('Generated bench management list')),
    TE.foldW(
      e => {
        console.log('Error in bench generation', e);
        return T.of(e);
      },
      data => {
        console.log(
          `Bench management completed successfully: 
          ${data.benchManagementList.map(u => u.location).join('\n')}
          `
          // ${data.removedBenches.flatMap(({ benches }) => benches.toArray()).length} removed benches
          // ${data.generatedBenches.totalAffectationsCreated} generated benches
          // ${data.benchesMatchingShifts}
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
