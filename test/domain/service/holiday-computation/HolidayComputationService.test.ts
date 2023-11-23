import { LocalDateRange } from '@domain/models/local-date-range';
import * as E from 'fp-ts/lib/Either';
import {Set} from 'immutable';
import {LocalDate, Month} from '@js-joda/core';

import {
  HolidayComputationService,
} from '@domain/service/holiday-computation/holiday-computation-service';
import forceRight from '../../../~shared/util/forceRight';

const {of} = LocalDate;
const {JANUARY, APRIL, MAY, JULY, AUGUST, OCTOBER, NOVEMBER, DECEMBER} = Month;

const easterMondays = [
  '2000-04-23',
  '2001-04-15',
  '2002-03-31',
  '2003-04-20',
  '2004-04-11',
  '2005-03-27',
  '2006-04-16',
  '2007-04-08',
  '2008-03-23',
  '2009-04-12',
  '2010-04-04',
  '2011-04-24',
  '2012-04-08',
  '2013-03-31',
  '2014-04-20',
  '2015-04-05',
  '2016-03-27',
  '2017-04-16',
  '2018-04-01',
  '2019-04-21',
  '2020-04-12',
  '2021-04-04',
  '2022-04-17',
  '2023-04-09',
  '2024-03-31',
  '2025-04-20',
  '2026-04-05',
  '2027-03-28',
  '2028-04-16',
  '2029-04-01',
  '2030-04-21',
  '2031-04-13',
  '2032-03-28',
  '2033-04-17',
  '2034-04-09',
  '2035-03-25',
  '2036-04-13',
  '2037-04-05',
  '2038-04-25',
  '2039-04-10',
  '2040-04-01',
];

const ascensionThursdays = easterMondays.map(d =>
  LocalDate.parse(d).plusDays(39).toString()
);

const periodOf = (start: LocalDate, end: LocalDate) =>
  forceRight(
    new HolidayComputationService().computeHolidaysForLocale(
      'FR-75',
      forceRight(LocalDateRange.of(start, end))
    )
  );
const expectPeriodToBeEmpty = (start: LocalDate, end: LocalDate) => {
  expect(periodOf(start, end).isEmpty()).toBe(true);
};

const expectPeriodToContain = (
  start: LocalDate,
  end: LocalDate,
  expectedHoliday: LocalDate
) => {
  expect(periodOf(start, end).contains(expectedHoliday)).toBe(true);
};

const expectPeriodToContainOnly = (
  start: LocalDate,
  end: LocalDate,
  expectedHoliday: LocalDate
) => {
  expect(
    periodOf(start, end).equals(Set<LocalDate>().add(expectedHoliday))
  ).toBe(true);
};

describe('HolidayComputationService', () => {
  describe('happy path', () => {
    describe('when provided with FR-75 code', () => {
      it('returns an empty set if no holiday is found within period', () => {
        expectPeriodToBeEmpty(of(2023, JANUARY, 2), of(2023, JANUARY, 10));
      });

      it('contains the 1st of January', () => {
        expectPeriodToContainOnly(
          of(2022, DECEMBER, 26),
          of(2023, JANUARY, 10),
          of(2023, JANUARY, 1)
        );
      });

      it('contains the 1st of May', () => {
        expectPeriodToContainOnly(
          of(2023, APRIL, 29),
          of(2023, MAY, 7),
          of(2023, MAY, 1)
        );
      });

      it('contains the 8th of May', () => {
        expectPeriodToContainOnly(
          of(2023, MAY, 3),
          of(2023, MAY, 12),
          of(2023, MAY, 8)
        );
      });

      it('contains the 14th of July', () => {
        expectPeriodToContainOnly(
          of(2023, JULY, 10),
          of(2023, JULY, 25),
          of(2023, JULY, 14)
        );
      });

      it('contains the 15th of August', () => {
        expectPeriodToContainOnly(
          of(2023, AUGUST, 7),
          of(2023, AUGUST, 20),
          of(2023, AUGUST, 15)
        );
      });

      it('contains the 1st of November', () => {
        expectPeriodToContainOnly(
          of(2023, OCTOBER, 28),
          of(2023, NOVEMBER, 5),
          of(2023, NOVEMBER, 1)
        );
      });

      it('contains the 11th of November', () => {
        expectPeriodToContainOnly(
          of(2023, NOVEMBER, 5),
          of(2023, NOVEMBER, 16),
          of(2023, NOVEMBER, 11)
        );
      });

      it('contains the 25th of December', () => {
        expectPeriodToContainOnly(
          of(2023, DECEMBER, 19),
          of(2023, DECEMBER, 29),
          of(2023, DECEMBER, 25)
        );
      });

      it('contains Easter Mondays', () => {
        easterMondays
          .map(date => LocalDate.parse(date))
          .forEach(easterMonday => {
            const start = of(easterMonday.year(), JANUARY, 1);
            const end = of(easterMonday.year() + 1, JANUARY, 1);
            expectPeriodToContain(start, end, easterMonday);
          });
      });

      it('contains Ascension Thursdays', () => {
        ascensionThursdays
          .map(date => LocalDate.parse(date))
          .forEach(ascensionThursdays => {
            const start = of(ascensionThursdays.year(), JANUARY, 1);
            const end = of(ascensionThursdays.year() + 1, JANUARY, 1);
            expectPeriodToContain(start, end, ascensionThursdays);
          });
      });
      it('contains 2024 holidays', () => {
        const year = 2024;
        periodOf(of(year, JANUARY, 1), of(year + 1, JANUARY, 1)).equals(
          Set<LocalDate>([
            of(year, JANUARY, 1),
            of(year, APRIL, 1),
            of(year, MAY, 1),
            of(year, MAY, 9),
            of(year, MAY, 20),
            of(year, JULY, 14),
            of(year, AUGUST, 15),
            of(year, NOVEMBER, 1),
            of(year, NOVEMBER, 11),
            of(year, DECEMBER, 25),
          ])
        );
      });

      it('contains 2023 holidays', () => {
        const year = 2023;
        periodOf(of(year, JANUARY, 1), of(2024, JANUARY, 1)).equals(
          Set<LocalDate>([
            of(year, JANUARY, 1),
            of(year, APRIL, 10),
            of(year, MAY, 1),
            of(year, MAY, 8),
            of(year, MAY, 18),
            of(year, JULY, 14),
            of(year, AUGUST, 15),
            of(year, NOVEMBER, 1),
            of(year, NOVEMBER, 11),
            of(year, DECEMBER, 25),
          ])
        );
      });
    });
  });

  describe('unsupported code', () => {
    describe('when provided with FR-57 code', () => {
      it('returns a Left<IllegalArgumentError>', () => {
        const result = new HolidayComputationService().computeHolidaysForLocale(
          'FR-57',
          forceRight(LocalDateRange.of(of(2023, JANUARY, 1), of(2024, JANUARY, 1)))
        );
        expect(E.isLeft(result)).toBe(true);
      });
    });
  });
});
