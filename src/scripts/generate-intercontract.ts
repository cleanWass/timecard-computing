import { DateTimeFormatter, LocalDate } from '@js-joda/core';
import { generateIntercontract } from '../application/bench-generation/generate-intercontract';
import { LocalDateRange } from '../domain/models/local-date-range';

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

  const period = parseCommandLineArgs();
  await generateIntercontract(period)();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
