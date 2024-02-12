import { ChronoUnit, DateTimeFormatter, Duration, Instant, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { Map, Set, ValueObject } from 'immutable';
import { IllegalArgumentError } from '../~shared/error/illegal-argument-error';
import { Interval } from '@js-joda/extra';

export class LocalTimeSlot implements ValueObject {
  public static of(startTime: LocalTime, endTime: LocalTime): E.Either<IllegalArgumentError, LocalTimeSlot> {
    return endTime.isAfter(startTime)
      ? E.right(new LocalTimeSlot(startTime, endTime))
      : E.left(new IllegalArgumentError(`Start (${startTime}) must be before End (${endTime}).`));
  }

  private readonly valueObject: ValueObject;

  constructor(
    public readonly startTime: LocalTime,
    public readonly endTime: LocalTime
  ) {
    this.valueObject = Map<string, LocalTime>().set('startTime', this.startTime).set('endTime', this.endTime);
  }

  equals(other: LocalTimeSlot): boolean {
    return this.valueObject.equals(other?.valueObject);
  }

  hashCode(): number {
    return this.valueObject.hashCode();
  }

  subtract(addend: LocalTimeSlot): Set<LocalTimeSlot> {
    const result = Set<LocalTimeSlot>();
    if (addend.startTime.equals(this.startTime) && addend.endTime.isBefore(this.endTime)) {
      return result.add(new LocalTimeSlot(addend.endTime, this.endTime));
    } else if (addend.startTime.isAfter(this.startTime) && addend.endTime.equals(this.endTime)) {
      return result.add(new LocalTimeSlot(this.startTime, addend.startTime));
    } else if (!this.isConcurrentOf(addend)) {
      return result.add(this);
    } else if (this.includes(addend)) {
      return result.add(new LocalTimeSlot(this.startTime, addend.startTime)).add(new LocalTimeSlot(addend.endTime, this.endTime));
    } else if (this.startOverlaps(addend)) {
      return result.add(new LocalTimeSlot(addend.endTime, this.endTime));
    } else if (this.endOverlaps(addend)) {
      return result.add(new LocalTimeSlot(this.startTime, addend.startTime));
    }
    return result;
  }

  add(addend: LocalTimeSlot): Set<LocalTimeSlot> {
    const result = Set<LocalTimeSlot>();
    if (this.includesInclusive(addend) || this.equals(addend)) {
      return result.add(this);
    } else if (this.isIncludedInclusivelyIn(addend)) {
      return result.add(addend);
    } else if (!this.isConcurrentOfInclusive(addend)) {
      return result.add(this).add(addend);
    } else if (this.startOverlapsInclusive(addend)) {
      return result.add(new LocalTimeSlot(addend.startTime, this.endTime));
    } else if (this.endOverlapsInclusive(addend)) {
      return result.add(new LocalTimeSlot(this.startTime, addend.endTime));
    }
    return result;
  }

  includesInclusive(addend: LocalTimeSlot) {
    return (
      (addend.startTime.isAfter(this.startTime) || addend.startTime.equals(this.startTime)) &&
      (addend.endTime.isBefore(this.endTime) || addend.endTime.equals(this.endTime))
    );
  }

  isIncludedInclusivelyIn(addend: LocalTimeSlot) {
    return addend.includesInclusive(this);
  }

  includes(addend: LocalTimeSlot) {
    return addend.startTime.isAfter(this.startTime) && addend.endTime.isBefore(this.endTime);
  }

  isIncludedIn(addend: LocalTimeSlot) {
    return addend.includes(this);
  }

  endOverlaps(addend: LocalTimeSlot) {
    return this.includesAddendStart(addend) && addend.endTime.isAfter(this.endTime);
  }

  endOverlapsInclusive(addend: LocalTimeSlot) {
    return (this.includesAddendStart(addend) || addend.startTime.equals(this.endTime)) && addend.endTime.isAfter(this.endTime);
  }

  startOverlaps(addend: LocalTimeSlot) {
    return this.includesAddendEnd(addend) && addend.startTime.isBefore(this.startTime);
  }

  startOverlapsInclusive(addend: LocalTimeSlot) {
    return (this.includesAddendEnd(addend) || addend.endTime.equals(this.startTime)) && addend.startTime.isBefore(this.startTime);
  }

  overlaps(addend: LocalTimeSlot) {
    return (
      Math.min(this.endTime.toSecondOfDay(), addend.endTime.toSecondOfDay()) -
        Math.max(this.startTime.toSecondOfDay(), addend.startTime.toSecondOfDay()) >=
      0
    );
  }

  contains(other: LocalTimeSlot) {
    return this.startTime.isBefore(other.startTime) && this.endTime.isAfter(other.endTime);
  }

  overlapsInclusive(addend: LocalTimeSlot) {
    return this.endOverlapsInclusive(addend) || this.startOverlapsInclusive(addend);
  }

  isConcurrentOf(addend: LocalTimeSlot) {
    return this.equals(addend) || this.overlaps(addend) || this.includes(addend) || this.isIncludedIn(addend);
  }

  isConcurrentOfInclusive(addend: LocalTimeSlot) {
    return this.equals(addend) || this.overlapsInclusive(addend) || this.includes(addend) || this.isIncludedIn(addend);
  }

  plusMinutes(slotDurationInMinutes: number) {
    return new LocalTimeSlot(this.startTime.plusMinutes(slotDurationInMinutes), this.endTime.plusMinutes(slotDurationInMinutes));
  }

  duration() {
    return this.endTime === LocalTime.MIN
      ? Duration.between(this.startTime, LocalTime.MAX.truncatedTo(ChronoUnit.MINUTES)).plus(Duration.ofMinutes(1))
      : Duration.between(this.startTime, this.endTime);
  }

  asInterval(startDate: LocalDate, endDate?: LocalDate): Interval {
    return Interval.of(
      Instant.from(LocalDateTime.of(startDate, this.startTime)),
      Instant.from(LocalDateTime.of(endDate ?? startDate, this.endTime))
    );
  }

  commonRange(rangeToTest: LocalTimeSlot) {
    if (!this.overlaps(rangeToTest)) return null;
    const start = this.startTime.isBefore(rangeToTest.startTime) ? rangeToTest.startTime : this.startTime;
    const end = this.endTime.isBefore(rangeToTest.endTime) ? this.endTime : rangeToTest.endTime;
    return new LocalTimeSlot(start, end);
  }

  isNight() {
    return this.endTime.isAfter(LocalTime.of(20, 0)) || this.startTime.isBefore(LocalTime.of(6, 0));
  }

  debug() {
    return `${this.startTime.format(DateTimeFormatter.ofPattern('HH:mm'))} -> ${this.endTime.format(
      DateTimeFormatter.ofPattern('HH:mm')
    )} (${this.duration().toMinutes()} minutes)`;
  }

  private includesAddendEnd(addend: LocalTimeSlot) {
    return addend.endTime.isAfter(this.startTime) && addend.endTime.isBefore(this.endTime);
  }

  private includesAddendStart(addend: LocalTimeSlot) {
    return addend.startTime.isAfter(this.startTime) && addend.startTime.isBefore(this.endTime);
  }
}
