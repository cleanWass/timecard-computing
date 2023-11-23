import {IllegalArgumentError} from '@domain/~shared/error/illegal-argument-error';
import {Duration, LocalTime} from '@js-joda/core';
import * as E from 'fp-ts/Either';
import {Map, Set, ValueObject} from 'immutable';

export class LocalTimeSlot implements ValueObject {
  public static of(
    startTime: LocalTime,
    endTime: LocalTime
  ): E.Either<IllegalArgumentError, LocalTimeSlot> {
    return endTime.isAfter(startTime)
      ? E.right(new LocalTimeSlot(startTime, endTime))
      : E.left(
          new IllegalArgumentError(
            `Start (${startTime}) must be before End (${endTime}).`
          )
        );
  }

  private readonly valueObject: ValueObject;

  constructor(
    public readonly startTime: LocalTime,
    public readonly endTime: LocalTime
  ) {
    this.valueObject = Map<string, LocalTime>()
      .set('startTime', this.startTime)
      .set('endTime', this.endTime);
  }

  equals(other: LocalTimeSlot): boolean {
    return this.valueObject.equals(other?.valueObject);
  }

  hashCode(): number {
    return this.valueObject.hashCode();
  }

  subtract(addend: LocalTimeSlot): Set<LocalTimeSlot> {
    const result = Set<LocalTimeSlot>();
    if (
      addend.startTime.equals(this.startTime) &&
      addend.endTime.isBefore(this.endTime)
    ) {
      return result.add(new LocalTimeSlot(addend.endTime, this.endTime));
    } else if (
      addend.startTime.isAfter(this.startTime) &&
      addend.endTime.equals(this.endTime)
    ) {
      return result.add(new LocalTimeSlot(this.startTime, addend.startTime));
    } else if (!this.isConcurrentOf(addend)) {
      return result.add(this);
    } else if (this.includes(addend)) {
      return result
        .add(new LocalTimeSlot(this.startTime, addend.startTime))
        .add(new LocalTimeSlot(addend.endTime, this.endTime));
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
      (addend.startTime.isAfter(this.startTime) ||
        addend.startTime.equals(this.startTime)) &&
      (addend.endTime.isBefore(this.endTime) ||
        addend.endTime.equals(this.endTime))
    );
  }

  isIncludedInclusivelyIn(addend: LocalTimeSlot) {
    return addend.includesInclusive(this);
  }

  includes(addend: LocalTimeSlot) {
    return (
      addend.startTime.isAfter(this.startTime) &&
      addend.endTime.isBefore(this.endTime)
    );
  }

  isIncludedIn(addend: LocalTimeSlot) {
    return addend.includes(this);
  }

  endOverlaps(addend: LocalTimeSlot) {
    return (
      this.includesAddendStart(addend) && addend.endTime.isAfter(this.endTime)
    );
  }

  endOverlapsInclusive(addend: LocalTimeSlot) {
    return (
      (this.includesAddendStart(addend) ||
        addend.startTime.equals(this.endTime)) &&
      addend.endTime.isAfter(this.endTime)
    );
  }

  startOverlaps(addend: LocalTimeSlot) {
    return (
      this.includesAddendEnd(addend) &&
      addend.startTime.isBefore(this.startTime)
    );
  }

  startOverlapsInclusive(addend: LocalTimeSlot) {
    return (
      (this.includesAddendEnd(addend) ||
        addend.endTime.equals(this.startTime)) &&
      addend.startTime.isBefore(this.startTime)
    );
  }

  overlaps(addend: LocalTimeSlot) {
    return this.endOverlaps(addend) || this.startOverlaps(addend);
  }

  overlapsInclusive(addend: LocalTimeSlot) {
    return (
      this.endOverlapsInclusive(addend) || this.startOverlapsInclusive(addend)
    );
  }

  isConcurrentOf(addend: LocalTimeSlot) {
    return (
      this.equals(addend) ||
      this.overlaps(addend) ||
      this.includes(addend) ||
      this.isIncludedIn(addend)
    );
  }

  isConcurrentOfInclusive(addend: LocalTimeSlot) {
    return (
      this.equals(addend) ||
      this.overlapsInclusive(addend) ||
      this.includes(addend) ||
      this.isIncludedIn(addend)
    );
  }

  plusMinutes(slotDurationInMinutes: number) {
    return new LocalTimeSlot(
      this.startTime.plusMinutes(slotDurationInMinutes),
      this.endTime.plusMinutes(slotDurationInMinutes)
    );
  }

  duration() {
    return Duration.between(this.startTime, this.endTime);
  }

  private includesAddendEnd(addend: LocalTimeSlot) {
    return (
      addend.endTime.isAfter(this.startTime) &&
      addend.endTime.isBefore(this.endTime)
    );
  }

  private includesAddendStart(addend: LocalTimeSlot) {
    return (
      addend.startTime.isAfter(this.startTime) &&
      addend.startTime.isBefore(this.endTime)
    );
  }
}
