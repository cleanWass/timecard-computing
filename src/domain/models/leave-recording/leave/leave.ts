import { Duration, Instant, LocalDateTime, LocalTime } from '@js-joda/core';
import { Interval } from '@js-joda/extra';
import * as O from 'fp-ts/Option';
import { Map, ValueObject } from 'immutable';
import { LocalDateRange } from '../../local-date-range';

import { LeaveId } from './leave-id';
import { LeaveReason } from './leave-reason';

export type ILeave = {
  id: LeaveId;
  reason: LeaveReason;
  startTime: LocalTime;
  endTime: LocalTime;
  period: LocalDateRange;
  comment: O.Option<string>;
};

export class Leave implements ValueObject, ILeave {
  public static build(params: {
    id: LeaveId;
    reason: LeaveReason;
    startTime: LocalTime;
    endTime: LocalTime;
    period: LocalDateRange;
    comment: O.Option<string>;
  }) {
    return new Leave(params.id, params.reason, params.startTime, params.endTime, params.period, params.comment);
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: LeaveId,
    public readonly reason: LeaveReason,
    public readonly startTime: LocalTime,
    public readonly endTime: LocalTime,
    public readonly period: LocalDateRange,
    public readonly comment: O.Option<string>
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean | O.Option<string>>()
      .set('id', this.id)
      .set('reason', this.reason)
      .set('startTime', this.startTime)
      .set('endTime', this.endTime)
      .set('period', this.period)
      .set('comment', this.comment);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as Leave)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  with(params: Partial<Leave>): Leave {
    return new Leave(
      params.id ?? this.id,
      params.reason ?? this.reason,
      params.startTime ?? this.startTime,
      params.endTime ?? this.endTime,
      params.period ?? this.period,
      params.comment ?? this.comment
    );
  }

  getInterval(): Interval {
    return Interval.of(
      Instant.from(LocalDateTime.of(this.period.start, this.startTime)),
      Instant.from(LocalDateTime.of(this.period.end, this.endTime))
    );
  }
}
