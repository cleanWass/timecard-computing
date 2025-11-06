import { DateTimeFormatter, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import '@js-joda/timezone';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { Map, ValueObject } from 'immutable';
import { formatLocalDate } from '../../../../~shared/util/joda-helper';
import { LocalDateRange } from '../../local-date-range';
import { LocalTimeSlot } from '../../local-time-slot';

import { LeaveId } from './leave-id';
import { PaidLeaveReason, UnpaidLeaveReason } from './leave-retribution';

export type ILeavePeriod = {
  id: LeaveId;
  timeSlot: O.Option<LocalTimeSlot>;
  period: LocalDateRange;
  employeeId: string;
  silaeId: string;
  absenceType: PaidLeaveReason | UnpaidLeaveReason;
};

export class LeavePeriod implements ValueObject, ILeavePeriod {
  public static build({ absenceType, employeeId, id, period, silaeId, timeSlot }: ILeavePeriod) {
    return new LeavePeriod(id, employeeId, silaeId, period, timeSlot, absenceType);
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: LeaveId,
    public readonly employeeId: string,
    public readonly silaeId: string,
    public readonly period: LocalDateRange,
    public readonly timeSlot: O.Option<LocalTimeSlot>,
    public readonly absenceType: PaidLeaveReason | UnpaidLeaveReason
  ) {
    this._vo = Map<
      string,
      ValueObject | string | number | boolean | O.Option<string | LocalTimeSlot>
    >()
      .set('id', this.id)
      .set('employeeId', this.employeeId)
      .set('silaeId', this.silaeId)
      .set('period', this.period)
      .set('timeSlot', this.timeSlot)
      .set('absenceType', this.absenceType);
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
      params.employeeId ?? this.employeeId,
      params.silaeId ?? this.silaeId,
      params.period ?? this.period,
      params.timeSlot ?? this.timeSlot,
      params.absenceType ?? this.absenceType
    );
  }

  debug(): string {
    return `${formatLocalDate({ date: this.period.start })} -> ${formatLocalDate({
      date: this.period.end.minusDays(1),
    })} --> ${this.absenceType}${pipe(
      this.timeSlot,
      O.fold(
        () => '',
        slot => ` ${slot.debug()}`
      )
    )}`;
  }
}
