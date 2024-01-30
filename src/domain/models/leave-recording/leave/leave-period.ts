import { DateTimeFormatter, Duration, Instant, LocalDateTime, LocalTime, ZoneId } from '@js-joda/core';
import { Interval } from '@js-joda/extra';
import '@js-joda/timezone';
import * as O from 'fp-ts/Option';
import { Map, ValueObject } from 'immutable';
import { LocalDateRange } from '../../local-date-range';
import { Shift } from '../../mission-delivery/shift/shift';

import { LeaveId } from './leave-id';
import { LeaveReason } from './leave-reason';

export type ILeavePeriod = {
  id: LeaveId;
  reason: LeaveReason;
  startTime: LocalTime;
  endTime: LocalTime;
  period: LocalDateRange;
  comment: O.Option<string>;
};

export class LeavePeriod implements ValueObject, ILeavePeriod {
  public static build(params: {
    id: LeaveId;
    reason: LeaveReason;
    startTime: LocalTime;
    endTime: LocalTime;
    period: LocalDateRange;
    comment: O.Option<string>;
  }) {
    return new LeavePeriod(params.id, params.reason, params.startTime, params.endTime, params.period, params.comment);
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
    return this._vo.equals((other as LeavePeriod)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  with(params: Partial<LeavePeriod>): LeavePeriod {
    return new LeavePeriod(
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
      Instant.from(LocalDateTime.of(this.period.start, this.startTime).atZone(ZoneId.of('Europe/Paris'))),
      Instant.from(LocalDateTime.of(this.period.end.minusDays(1), this.endTime).atZone(ZoneId.of('Europe/Paris')))
    );
  }

  containsShift(shift: Shift): boolean {
    return this.getInterval().contains(Instant.from(shift.startTime.atZone(ZoneId.of('Europe/Paris'))));
  }

  debug(): string {
    return `${LocalDateTime.of(this.period.start, this.startTime).format(
      DateTimeFormatter.ofPattern('HH:mm dd/MM/yy')
    )} -> ${LocalDateTime.of(this.period.end.minusDays(1), this.endTime).format(DateTimeFormatter.ofPattern('HH:mm dd/MM/yy'))} --> ${
      this.reason
    }`;
  }
}
