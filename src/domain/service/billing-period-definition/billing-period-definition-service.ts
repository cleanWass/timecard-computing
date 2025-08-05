import { DateTimeFormatter, LocalDate, Month } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { Map } from 'immutable';
import { LocalDateRange } from '../../models/local-date-range';
import * as E from 'fp-ts/lib/Either';
import * as A from 'fp-ts/lib/Array';

type GetImmutableMapKeyType<T> = T extends Map<infer K, any> ? K : never;

const {
  JANUARY,
  FEBRUARY,
  MARCH,
  APRIL,
  MAY,
  JUNE,
  JULY,
  AUGUST,
  SEPTEMBER,
  OCTOBER,
  NOVEMBER,
  DECEMBER,
} = Month;

const getPeriodAsDateRanges = (months: typeof BILLING_PERIODS_2025 | typeof BILLING_PERIODS_2024) =>
  months.map(
    period =>
      new LocalDateRange(
        LocalDate.parse(period[0], DateTimeFormatter.ofPattern('dd/MM/yyyy')),
        LocalDate.parse(period[1], DateTimeFormatter.ofPattern('dd/MM/yyyy')).plusDays(1)
      )
  );

const BILLING_PERIODS_2024 = Map([
  [JANUARY, ['18/12/2023', '21/01/2024']],
  [FEBRUARY, ['22/01/2024', '18/02/2024']],
  [MARCH, ['19/02/2024', '17/03/2024']],
  [APRIL, ['18/03/2024', '21/04/2024']],
  [MAY, ['22/04/2024', '19/05/2024']],
  [JUNE, ['20/05/2024', '16/06/2024']],
  [JULY, ['17/06/2024', '21/07/2024']],
  [AUGUST, ['22/07/2024', '18/08/2024']],
  [SEPTEMBER, ['19/08/2024', '15/09/2024']],
  [OCTOBER, ['16/09/2024', '20/10/2024']],
  [NOVEMBER, ['21/10/2024', '15/11/2024']],
  [DECEMBER, ['16/11/2024', '19/12/2024']],
]);

const BILLING_PERIODS_2025 = Map([
  [JANUARY, ['16/12/2024', '19/01/2025']],
  [FEBRUARY, ['20/01/2025', '16/02/2025']],
  [MARCH, ['17/02/2025', '23/03/2025']],
  [APRIL, ['24/03/2025', '20/04/2025']],
  [MAY, ['21/04/2025', '18/05/2025']],
  [JUNE, ['19/05/2025', '22/06/2025']],
  [JULY, ['23/06/2025', '20/07/2025']],
  [AUGUST, ['21/07/2025', '17/08/2025']],
  [SEPTEMBER, ['18/08/2025', '21/09/2025']],
  [OCTOBER, ['22/09/2025', '19/10/2025']],
  [NOVEMBER, ['20/10/2025', '16/11/2025']],
  [DECEMBER, ['17/11/2025', '14/12/2025']],
]);

const BILLING_PERIODS = Map({ '2025': BILLING_PERIODS_2025, '2024': BILLING_PERIODS_2024 }).map(
  (months, year) => getPeriodAsDateRanges(months)
);

const BILLING_PERIODS_2025_AS_LOCAL_DATE_RANGES = getPeriodAsDateRanges(BILLING_PERIODS_2025);

export class BillingPeriodDefinitionService {
  getBillingPeriods() {
    return BILLING_PERIODS;
  }

  getBillingPeriodForMonth(month: Month, year: GetImmutableMapKeyType<typeof BILLING_PERIODS>) {
    return pipe(
      E.tryCatch(
        () => BILLING_PERIODS.get(year),
        () => new Error('Billing periods not found')
      ),
      E.chainW(periods =>
        pipe(
          E.fromNullable(new Error(`Billing periods for ${year} not found`))(periods),
          E.chainW(p =>
            pipe(
              p.get(month),
              E.fromNullable(new Error(`Billing period for ${month} in ${year} not found`))
            )
          )
        )
      )
    );
  }

  getBillingPeriodForMonths({
    months,
    year,
  }: {
    months: Month[];
    year: GetImmutableMapKeyType<typeof BILLING_PERIODS>;
  }) {
    return pipe(
      E.tryCatch(
        () => BILLING_PERIODS.get(year),
        () => new Error('Billing periods not found')
      ),
      E.chainW(periods =>
        pipe(
          E.fromNullable(new Error(`Billing periods for ${year} not found`))(periods),
          E.chainW(p =>
            pipe(
              months,
              A.traverse(E.Applicative)(month =>
                pipe(
                  p.get(month),
                  E.fromNullable(new Error(`Billing period for ${month} in ${year} not found`))
                )
              )
            )
          )
        )
      )
    );
  }
}
