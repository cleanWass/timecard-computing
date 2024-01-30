import { DateTimeFormatter, Duration, Instant, LocalDate, LocalDateTime, LocalTime, ZoneId } from '@js-joda/core';
import { Interval } from '@js-joda/extra';
import { Map, ValueObject } from 'immutable';
import { TypeProps } from '../../../../~shared/util/types';
import { LeaveReason, PaidLeaveReason, UnpaidLeaveReason } from './leave-reason';
import '@js-joda/timezone';

interface ILeave {
  date: LocalDate;
  startTime: LocalTime;
  endTime: LocalTime;
  duration: Duration;
  compensation: LeaveReason;
  absenceType: PaidLeaveReason | UnpaidLeaveReason;
}

export class Leave implements ValueObject, ILeave {
  public static build({ compensation, date, duration, endTime, startTime, absenceType }: ILeave) {
    return new Leave(date, startTime, endTime, duration, compensation, absenceType);
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly date: LocalDate,
    public readonly startTime: LocalTime,
    public readonly endTime: LocalTime,
    public readonly duration: Duration,
    public readonly compensation: LeaveReason,
    public readonly absenceType: PaidLeaveReason | UnpaidLeaveReason
  ) {
    this._vo = Map<string, TypeProps<Leave>>()
      .set('date', this.date)
      .set('startTime', this.startTime)
      .set('endTime', this.endTime)
      .set('duration', this.duration)
      .set('compensation', this.compensation)
      .set('absenceType', this.absenceType);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as Leave)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  getStartDateTime(): LocalDateTime {
    return LocalDateTime.of(this.date, this.startTime);
  }

  getEndDateTime(): LocalDateTime {
    return LocalDateTime.of(this.date, this.endTime);
  }

  getInterval(): Interval {
    return Interval.of(
      Instant.from(this.getStartDateTime().atZone(ZoneId.of('Europe/Paris'))),
      Instant.from(this.getEndDateTime().atZone(ZoneId.of('Europe/Paris')))
    );
  }

  with(params: Partial<Leave>): Leave {
    return new Leave(
      params.date ?? this.date,
      params.startTime ?? this.startTime,
      params.endTime ?? this.endTime,
      params.duration ?? this.duration,
      params.compensation ?? this.compensation,
      params.absenceType ?? this.absenceType
    );
  }

  debug(): string {
    return `${this.getStartDateTime().format(DateTimeFormatter.ofPattern('HH:mm dd/MM/yy'))} -> ${this.getEndDateTime().format(
      DateTimeFormatter.ofPattern('HH:mm dd/MM/yy')
    )}`;
  }
}
