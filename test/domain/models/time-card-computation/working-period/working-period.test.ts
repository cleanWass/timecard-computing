import { ChronoUnit, Duration, LocalDate } from '@js-joda/core';
import { EmploymentContract } from '../../../../../src/domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../../../../src/domain/models/local-date-range';
import { WorkingPeriod } from '../../../../../src/domain/models/timecard-computation/working-period/working-period';

const localDateRange = new LocalDateRange(LocalDate.of(2024, 6, 1), LocalDate.of(2024, 8, 1));
const localDateRangeCopy = new LocalDateRange(LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 7));

describe('LocalDateRange', () => {
  describe('.equals', () => {
    it('returns true with identical objects', () => {
      expect(localDateRange.equals(localDateRangeCopy)).toBe(true);
    });
  });

  describe('.divideIntoPeriods', () => {
    // it('returns an array of periods', () => {
    //   console.log(localDateRange.toFormattedString());
    //   console.log(
    //     localDateRange
    //       .divideIntoLocalDateRange(ChronoUnit.MONTHS)
    //       .map(range => range.toFormattedString())
    //       .toArray()
    //   );
    //   expect(localDateRange.divideIntoLocalDateRange(ChronoUnit.MONTHS)).toBe(true);
    // });
    it('splits a range into Calendar Week', () => {
      console.log(localDateRange.toFormattedString());
      console.log(
        localDateRange
          .divideIntoCalendarWeeks()
          .map(range => range.toFormattedString())
          .toArray()
      );
      console.log('numbersOfDays', localDateRangeCopy.numberOfDays());
      expect(
        localDateRange
          .divideIntoCalendarWeeks()
          .map(rge => rge.toFormattedString())
          .toArray()
      ).toStrictEqual([
        '01/06/24 -> 03/06/24',
        '03/06/24 -> 10/06/24',
        '10/06/24 -> 17/06/24',
        '17/06/24 -> 24/06/24',
        '24/06/24 -> 01/07/24',
        '01/07/24 -> 08/07/24',
        '08/07/24 -> 15/07/24',
        '15/07/24 -> 22/07/24',
        '22/07/24 -> 29/07/24',
        '29/07/24 -> 05/08/24',
      ]);
    });
    it('splits a range into Calendar Months', () => {
      console.log(localDateRange.toFormattedString());
      console.log(
        localDateRange
          .divideIntoCalendarMonths()
          .map(range => range.toFormattedString())
          .toArray()
      );
      expect(localDateRange.divideIntoCalendarMonths()).toBe(true);
    });
  });
});
