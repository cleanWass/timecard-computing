import {
  DateTimeFormatter,
  Duration,
  Instant,
  LocalDate,
  LocalDateTime,
  LocalTime,
  ZoneId,
} from '@js-joda/core';
import { Interval } from '@js-joda/extra';
import { Map, ValueObject } from 'immutable';
import { TypeProps } from '../../../../~shared/util/types';
import { LocalTimeSlot } from '../../local-time-slot';
import { LeaveRetribution, PaidLeaveReason, UnpaidLeaveReason } from './leave-retribution';
import '@js-joda/timezone';

interface ILeave {
  id: string;
  date: LocalDate;
  startTime: LocalTime;
  endTime: LocalTime;
  duration: Duration;
  employeeId: string;
  clientId: string;
  clientName: string;
  compensation: LeaveRetribution;
  absenceType: PaidLeaveReason | UnpaidLeaveReason;
}

export class Leave implements ValueObject, ILeave {
  public static build({
    id,
    employeeId,
    compensation,
    date,
    duration,
    endTime,
    startTime,
    absenceType,
    clientName,
    clientId,
  }: ILeave) {
    return new Leave(
      id,
      employeeId,
      date,
      startTime,
      endTime,
      duration,
      compensation,
      absenceType,
      clientId,
      clientName
    );
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: string,
    public readonly employeeId: string,
    public readonly date: LocalDate,
    public readonly startTime: LocalTime,
    public readonly endTime: LocalTime,
    public readonly duration: Duration,
    public readonly compensation: LeaveRetribution,
    public readonly absenceType: PaidLeaveReason | UnpaidLeaveReason,
    public readonly clientId: string,
    public readonly clientName: string
  ) {
    this._vo = Map<string, TypeProps<Leave>>()
      .set('id', id)
      .set('date', this.date)
      .set('startTime', this.startTime)
      .set('endTime', this.endTime)
      .set('duration', this.duration)
      .set('compensation', this.compensation)
      .set('absenceType', this.absenceType)
      .set('employeeId', this.employeeId)
      .set('clientId', this.clientId)
      .set('clientName', this.clientName);
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

  getTimeSlot() {
    return new LocalTimeSlot(this.startTime, this.endTime);
  }

  with(params: Partial<Leave>): Leave {
    return new Leave(
      params.id ?? this.id,
      params.employeeId ?? this.employeeId,
      params.date ?? this.date,
      params.startTime ?? this.startTime,
      params.endTime ?? this.endTime,
      params.duration ?? this.duration,
      params.compensation ?? this.compensation,
      params.absenceType ?? this.absenceType,
      params.clientId ?? this.clientId,
      params.clientName ?? this.clientName
    );
  }

  debug(): string {
    return `${this.getStartDateTime().format(
      DateTimeFormatter.ofPattern('HH:mm dd/MM/yy')
    )} -> ${this.getEndDateTime().format(DateTimeFormatter.ofPattern('HH:mm dd/MM/yy'))}`;
  }
}
