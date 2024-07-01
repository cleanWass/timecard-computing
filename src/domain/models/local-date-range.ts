import { ChronoUnit, DateTimeFormatter, Duration, LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { Map, ValueObject } from 'immutable';
import { IllegalArgumentError } from '../~shared/error/illegal-argument-error';

export class LocalDateRange implements ValueObject {
  public static of(
    start: LocalDate, // inclusive
    end: LocalDate // exclusive
  ): E.Either<IllegalArgumentError, LocalDateRange> {
    return end.isAfter(start)
      ? E.right(new LocalDateRange(start, end))
      : E.left(new IllegalArgumentError(`Start (${start}) must be before End (${end}).`));
  }

  private readonly valueObject: ValueObject;

  constructor(
    public readonly start: LocalDate,
    public readonly end: LocalDate
  ) {
    this.valueObject = Map<string, LocalDate>().set('start', this.start).set('end', this.end);
  }

  equals(other: unknown): boolean {
    return this.valueObject.equals((other as LocalDateRange)?.valueObject);
  }

  hashCode(): number {
    return this.valueObject.hashCode();
  }

  toFormattedString(exclusiveEndDate = true) {
    const endDate = exclusiveEndDate ? this.end : this.end.minusDays(1);
    return `${this.start.format(DateTimeFormatter.ofPattern('dd/MM/yy'))} -> ${endDate.format(
      DateTimeFormatter.ofPattern('dd/MM/yy')
    )}`;
  }

  contains(date: LocalDate): boolean {
    return (this.start.isBefore(date) || this.start.isEqual(date)) && this.end.isAfter(date);
  }

  includesDate(date: LocalDate): boolean {
    return (this.start.equals(date) || this.start.isBefore(date)) && this.end.isAfter(date);
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

  duration(): Duration {
    return Duration.between(this.start.atStartOfDay(), this.end.atStartOfDay());
  }

  toLocalDateArray(): Array<LocalDate> {
    return Array.from([...Array(this.numberOfDays() || 0)].keys()).map(current => this.start.plusDays(current));
  }

  startOverlaps(addend: LocalDateRange) {
    return this.includesAddendEnd(addend) && addend.start.isBefore(this.start);
  }

  overlaps(rangeToTest: LocalDateRange) {
    return (
      Math.min(this.end.toEpochDay(), rangeToTest.end.toEpochDay()) -
        Math.max(this.start.toEpochDay(), rangeToTest.start.toEpochDay()) >
      0
    );
  }

  commonRange(rangeToTest: LocalDateRange) {
    if (!this.overlaps(rangeToTest)) return null;
    const start = this.start.isBefore(rangeToTest.start) ? rangeToTest.start : this.start;
    const end = this.end.isBefore(rangeToTest.end) ? this.end : rangeToTest.end;
    return new LocalDateRange(start, end);
  }

  with({ start, end }: { start?: LocalDate; end?: LocalDate }) {
    const newStart = start ?? this.start;
    const newEnd = end ?? this.end;
    return new LocalDateRange(newStart, newEnd);
  }
  private includesAddendEnd(addend: LocalDateRange) {
    return addend.end.isAfter(this.start) && addend.end.isBefore(this.end);
  }

  private includesAddendStart(addend: LocalDateRange) {
    return addend.start.isAfter(this.start) && addend.start.isBefore(this.end);
  }
}
