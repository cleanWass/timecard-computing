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
      .map(y => {
        const g = (y % 19) + 1;
        const c = ~~(y / 100) + 1;
        const l = ~~((3 * c) / 4) - 12;
        let m = 3;
        let e = (11 * g + 20 + ~~((8 * c + 5) / 25) - 5 - l) % 30;
        let d;
        if (e < 0) {
          e += 30;
        }
        if ((e === 25 && g > 11) || e === 24) {
          e++;
        }
        d = 44 - e;
        if (d < 21) {
          d += 30;
        }
        if ((d += 7 - ((~~((5 * y) / 4) - l - 10 + d) % 7)) > 31) {
          d -= 31;
          m = 4;
        }
        return LocalDate.of(y, m, d).plusDays(dayShift);
      })
      .has(localDate);

const supportedCodes = Array.from(new Array(95))
  .map((_, index) => `FR-${index}`)
  .filter(code => !['FR-57', 'FR-67', 'FR-68'].includes(code));

export class HolidayComputationService {
  computeHolidaysForLocale(
    iso31662Code: string,
    period: Period
  ): E.Either<IllegalArgumentError, Set<LocalDate>> {
    return supportedCodes.includes(iso31662Code)
      ? E.right(this.computeFrIdfDates(period))
      : E.left(
          new IllegalArgumentError(
            `Cannot compute holidays for ISO 3166-2 code ${iso31662Code}. Supported codes are ${supportedCodes}.`
          )
        );
  }

  private computeFrIdfDates(period: Period): Set<LocalDate> {
    const numberOfDays = period.start.until(period.end, ChronoUnit.DAYS);
    const daysInPeriod = Array.from(new Array(numberOfDays))
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
      easterComputationSpecificationPlus(0, yearsInPeriod),
      easterComputationSpecificationPlus(39, yearsInPeriod),
    ];
    const collection = daysInPeriod.filter(date =>
      specs.some(matches => matches(date))
    );
    return Set<LocalDate>(collection);
  }
}
