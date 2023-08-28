import { IllegalArgumentError } from '@domain/~shared/error/IllegalArgumentError';
import { ChronoUnit, LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { Map, ValueObject } from 'immutable';

export class LocalDateRange implements ValueObject {
  public static of(
    start: LocalDate,
    end: LocalDate
  ): E.Either<IllegalArgumentError, LocalDateRange> {
    return end.isAfter(start)
      ? E.right(new LocalDateRange(start, end))
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
    return this.valueObject.equals((other as LocalDateRange)?.valueObject);
  }

  hashCode(): number {
    return this.valueObject.hashCode();
  }

  toFormattedString() {
    return `${this.start.toString()}->${this.end.toString()}`;
  }

  includesDate(date: LocalDate): boolean {
    return (
      ((this.start.equals(date) || this.start.isBefore(date)) && this.end.isAfter(date)) ||
      this.end.isEqual(date)
    );
  }

  includesRange(range: LocalDateRange): boolean {
    return this.includesDate(range.start) && this.includesDate(range.end);
  }

  endOverlaps(addend: LocalDateRange) {
    return this.includesAddendStart(addend) && addend.end.isAfter(this.end);
  }

  numberOfDays(): number {
    return this.start.until(this.end, ChronoUnit.DAYS);
  }

  toLocalDateArray(): Array<LocalDate> {
    return Array.from([...Array(this.numberOfDays() || 0)].keys()).map((current) => this.start.plusDays(current));
  }

  startOverlaps(addend: LocalDateRange) {
    return this.includesAddendEnd(addend) && addend.start.isBefore(this.start);
  }

  overlaps(rangeToTest: LocalDateRange) {
    return (
      Math.min(this.end.toEpochDay(), rangeToTest.end.toEpochDay()) -
      Math.max(this.start.toEpochDay(), rangeToTest.start.toEpochDay()) >=
      0
    );
  }

  private includesAddendEnd(addend: LocalDateRange) {
    return addend.end.isAfter(this.start) && addend.end.isBefore(this.end);
  }

  private includesAddendStart(addend: LocalDateRange) {
    return addend.start.isAfter(this.start) && addend.start.isBefore(this.end);
  }
}

