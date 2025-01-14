import * as O from 'fp-ts/Option';
import { DateTimeFormatter, LocalDate, TemporalAdjusters } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { LocalDateRange } from './domain/models/local-date-range';
import { keys, values } from './~shared/util/types';
import firstDayOfNextMonth = TemporalAdjusters.firstDayOfNextMonth;

const periods_2025 = {
  Décembre_2024: ['16/11/2024', '19/12/2024'],
  Janvier: ['16/12/2024', '19/01/2025'],
  Février: ['20/01/2025', '16/02/2025'],
  Mars: ['17/02/2025', '23/03/2025'],
  Avril: ['24/03/2025', '20/04/2025'],
  Mai: ['21/04/2025', '18/05/2025'],
  Juin: ['19/05/2025', '22/06/2025'],
  Juillet: ['23/06/2025', '20/07/2025'],
  Août: ['21/07/2025', '17/08/2025'],
  Septembre: ['18/08/2025', '21/09/2025'],
  Octobre: ['22/09/2025', '19/10/2025'],
  Novembre: ['20/10/2025', '16/11/2025'],
  Décembre: ['17/11/2025', '14/12/2025'],
} as const;

export const getPeriodAsDateRanges = (periods: typeof periods_2025) =>
  keys(periods).reduce(
    (res, month) => ({
      ...res,
      [month]: new LocalDateRange(
        LocalDate.parse(periods[month][0], DateTimeFormatter.ofPattern('dd/MM/yyyy')),
        LocalDate.parse(periods[month][1], DateTimeFormatter.ofPattern('dd/MM/yyyy'))
      ),
    }),
    {} as { [k in keyof typeof periods_2025]: LocalDateRange }
  );

export const getComplementaryPeriod = (period: LocalDateRange) =>
  new LocalDateRange(period.end.plusDays(1), period.end.with(firstDayOfNextMonth()));

export const getCurrentPeriodRanges = (periods: ReturnType<typeof getPeriodAsDateRanges>) => {
  const res = pipe(
    periods,
    values,
    ranges => ranges.findIndex(period => period.contains(LocalDate.of(2025, 5, 2))),
    index => (index === -1 ? O.none : O.some(values(periods)[index - 1])),
    O.fold(
      () => 'Pas de période associée à la date actuelle',
      period =>
        `payroll Period : ${period.end.month()} : ${period.toFormattedString()}\ncomplementary period : ${getComplementaryPeriod(
          period
        ).toFormattedString()}`
    )
  );

  return res;
};

export const exportPayrollOnGoogleDrive = null;

export const main = () => {
  const periods = getPeriodAsDateRanges(periods_2025);

  console.log('getCurrentPeriodRanges for current day : ' + LocalDate.now(), getCurrentPeriodRanges(periods));
};

main();
