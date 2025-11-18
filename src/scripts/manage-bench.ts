import { DateTimeFormatter, LocalDate } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { benchManagementUseCases } from '../application/use-cases/manage-benches/manage-benches.use-case';
import { EnvService } from '../config/env';
import { LocalDateRange } from '../domain/models/local-date-range';
import { makeCareDataParserClient } from '../infrastructure/http/care-data-parser/care-cata-parser.client';

const DATE_FORMAT = 'dd/MM/yy';
const REQUIRED_ARGS_COUNT = 4;

const parseCommandLineArgs = (): LocalDateRange => {
  if (process.argv.length < REQUIRED_ARGS_COUNT) {
    throw new Error(`Usage: node script.js <start_date> <end_date> (format: ${DATE_FORMAT})`);
  }

  const [, , startArg, endArg] = process.argv;
  const formatter = DateTimeFormatter.ofPattern(DATE_FORMAT);

  const start = LocalDate.parse(startArg, formatter);
  const end = LocalDate.parse(endArg, formatter);

  if (start.isAfter(end)) {
    throw new Error('Start date must be before end date');
  }

  return new LocalDateRange(start, end);
};

async function main() {
  console.log('start generatePayrollExports', process.argv[2]);

  const careDataCareClient = makeCareDataParserClient({
    baseUrl: EnvService.get('CARE_DATA_PARSER_URL'),
    apiKey: EnvService.get('CARE_DATA_PARSER_API_KEY'),
  });

  const { removeExtraBenches, generateMissingBenches, computeBenchesMatchingShiftsList } =
    benchManagementUseCases(careDataCareClient);

  const period = parseCommandLineArgs();

  return pipe(
    TE.Do,
    TE.bind('removedBenches', () => removeExtraBenches.execute({ period })),
    TE.bind('generatedBenches', () => generateMissingBenches.execute({ period })),
    TE.bind('benchesMatchingShifts', () => computeBenchesMatchingShiftsList.execute({ period })),
    TE.foldW(
      e => {
        console.log('Error in bench generation', e);
        return T.of(e);
      },
      data => {
        console.log(
          `Bench management completed successfully:
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
