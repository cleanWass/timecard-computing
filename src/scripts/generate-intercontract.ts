import * as E from 'fp-ts/Either';
import { DateTimeFormatter, LocalDate } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { makeManageIntercontractUseCase } from '../application/use-cases/manage-intercontract/manage-intercontract.use-case';
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

  return new LocalDateRange(start, end.plusDays(1));
};

async function main(): Promise<void> {
  console.log('start generatePayrollExports', process.argv[2]);

  const careDataCareClient = makeCareDataParserClient({
    baseUrl: EnvService.get('CARE_DATA_PARSER_URL'),
    apiKey: EnvService.get('CARE_DATA_PARSER_API_KEY'),
  });
  const useCase = makeManageIntercontractUseCase(careDataCareClient);

  const period = parseCommandLineArgs();
  const result = await useCase.execute({ period })();
  console.log(
    'end generatePayrollExports',
    pipe(
      result,
      E.foldW(
        error => error,
        result => `${result.processedEmployees} processed employees with ${
          result.totalAffectationsCreated
        } intercontracts created
        ${result.details
          .map(
            d =>
              `${d.employee.firstName} ${d.employee.lastName} ${d.employee.silaeId}: ${d.affectations.size} affectations created`
          )
          .join('\n')}
        
        `
      )
    )
  );
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
