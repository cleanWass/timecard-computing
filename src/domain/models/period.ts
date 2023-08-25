import { IllegalArgumentError } from '@domain/~shared/error/IllegalArgumentError';
import { LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { Map, ValueObject } from 'immutable';

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
