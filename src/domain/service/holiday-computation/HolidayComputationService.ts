import * as E from 'fp-ts/lib/Either';
import {Map, Set, ValueObject} from 'immutable';
import {ChronoUnit, LocalDate, Month, MonthDay, Year} from '@js-joda/core';

import {IllegalArgumentError} from '../../~shared/error/IllegalArgumentError';

const {JANUARY, MAY, JULY, AUGUST, NOVEMBER, DECEMBER} = Month;
const {of} = MonthDay;

type HolidaySpecification = (d: LocalDate) => boolean;

export class Period implements ValueObject {
  public static of(
    start: LocalDate,
    end: LocalDate
  ): E.Either<IllegalArgumentError, Period> {
    return end.isAfter(start)
      ? E.right(new Period(start, end))
      : E.left(
          new IllegalArgumentError(
            `Start (${start}) must be before End (${end}).`
          )
        );
  }

  private readonly valueObject: ValueObject;

  constructor(
    public readonly start: LocalDate,
    public readonly end: LocalDate
  ) {
    this.valueObject = Map<string, LocalDate>()
      .set('start', this.start)
      .set('end', this.end);
  }

  equals(other: unknown): boolean {
    return this.valueObject.equals((other as Period)?.valueObject);
  }

  hashCode(): number {
    return this.valueObject.hashCode();
  }
}

const monthDaySpecification = (monthDay: MonthDay) => (localDate: LocalDate) =>
  monthDay.equals(MonthDay.of(localDate.month(), localDate.dayOfMonth()));

const easterComputationSpecificationPlus =
  (dayShift: number, years: Set<Year>) => (localDate: LocalDate) =>
    years
      .map(year => year.value())
      .map(year => {
        const n = year % 19;
        const c = Math.trunc(year / 100);
        const u = year % 100;
        const s = Math.trunc(c / 4);
        const t = c % 4;
        const p = Math.trunc((c + 8) / 25);
        const q = Math.trunc((c - p + 1) / 3);
        const e = (19 * n + c - s - q + 15) % 30;
        const b = Math.trunc(u / 4);
        const d = u % 4;
        const L = (2 * t + 2 * b - e - d + 32) % 7;
        const h = Math.trunc((n + 11 * e + 22 * L) / 451);
        const m = Math.trunc((e + L - 7 * h + 114) / 31);
        const j = 1 + ((e + L - 7 * h + 114) % 31);
        return LocalDate.of(year, m, j + dayShift);
      })
      .has(localDate);

export class HolidayComputationService {
  computeHolidaysForLocale(
    subdivisionCode: string,
    period: Period
  ): E.Either<IllegalArgumentError, Set<LocalDate>> {
    return subdivisionCode === 'FR-IDF'
      ? E.right(this.computeFrIdfDates(period))
      : E.left(
          new IllegalArgumentError(
            'Cannot compute holidays for other locales than FR-IDF'
          )
        );
  }

  private computeFrIdfDates(period: Period): Set<LocalDate> {
    const numberOfDays = period.start.until(period.end, ChronoUnit.DAYS);
    const daysInPeriod = Array(numberOfDays)
      .map((_, index) => index)
      .map(num => period.start.plusDays(num));
    const yearsInPeriod = Set<Year>(
      daysInPeriod.map(day => Year.of(day.year()))
    );
    const specs: HolidaySpecification[] = [
      monthDaySpecification(of(JANUARY, 1)),
      monthDaySpecification(of(MAY, 1)),
      monthDaySpecification(of(MAY, 8)),
      monthDaySpecification(of(JULY, 14)),
      monthDaySpecification(of(AUGUST, 15)),
      monthDaySpecification(of(NOVEMBER, 1)),
      monthDaySpecification(of(NOVEMBER, 11)),
      monthDaySpecification(of(DECEMBER, 25)),
      easterComputationSpecificationPlus(1, yearsInPeriod),
      easterComputationSpecificationPlus(39, yearsInPeriod),
    ];
    return Set<LocalDate>(
      daysInPeriod.filter(date => specs.some(matches => matches(date)))
    );
  }
}
