import { DateTimeFormatter, Duration, Instant, LocalDateTime, ZoneId } from '@js-joda/core';
import { Map, ValueObject } from 'immutable';
import { TypeProps } from '../../../../~shared/util/types';
import { Shift } from '../../mission-delivery/shift/shift';
import { LeaveReason } from './leave-reason';
import '@js-joda/timezone';
import { Interval } from '@js-joda/extra';

export class Leave implements ValueObject {
  public static build(params: { reason: LeaveReason; startTime: LocalDateTime; duration: Duration }) {
    return new Leave(params.reason, params.startTime, params.duration);
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly reason: LeaveReason,
    public readonly startTime: LocalDateTime,
    public readonly duration: Duration
  ) {
    this._vo = Map<string, TypeProps<Leave>>().set('reason', this.reason).set('startTime', this.startTime).set('duration', this.duration);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as Leave)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  getEndTime(): LocalDateTime {
    return this.startTime.plus(this.duration);
  }

  getInterval(): Interval {
    return Interval.of(
      Instant.from(this.startTime.atZone(ZoneId.of('Europe/Paris'))),
      Instant.from(this.getEndTime().atZone(ZoneId.of('Europe/Paris')))
    );
  }

  debug(): string {
    return `${this.startTime.format(DateTimeFormatter.ofPattern('HH:mm dd/MM/yy'))} -> ${this.getEndTime().format(
      DateTimeFormatter.ofPattern('HH:mm dd/MM/yy')
    )}`;
  }
}
