import { EmployeeId } from '@domain/models/employee-registration/employee/EmployeeId';
import { LocalDateRange } from '@domain/models/localDateRange';
import { LocalTimeSlot } from '@domain/models/localTimeSlot';
import { DayOfWeek, Duration, LocalDate } from '@js-joda/core';
import { identity, pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { Map, Set, ValueObject } from 'immutable';
import { EmploymentContractId } from './EmploymentContractId';

export class EmploymentContract implements ValueObject {
  public static build(params: {
    id: EmploymentContractId;
    employeeId: EmployeeId;
    startDate: LocalDate;
    endDate: O.Option<LocalDate>;
    overtimeAveragingPeriod: Duration;
    weeklyTotalWorkedHours: Duration;
    weeklyNightShiftHours: Duration;
    workedDays: Set<DayOfWeek>;
    weeklyPlanning: Map<DayOfWeek, Set<LocalTimeSlot>>
  }) {
    return new EmploymentContract(
      params.id,
      params.employeeId,
      params.startDate,
      params.endDate,
      params.overtimeAveragingPeriod,
      params.weeklyTotalWorkedHours,
      params.weeklyNightShiftHours,
      params.workedDays,
      params.weeklyPlanning
    );
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: EmploymentContractId,
    public readonly employeeId: EmployeeId,
    public readonly startDate: LocalDate,
    public readonly endDate: O.Option<LocalDate>,
    public readonly overtimeAveragingPeriod: Duration,
    public readonly weeklyTotalWorkedHours: Duration,
    public readonly weeklyNightShiftHours: Duration,
    public readonly workedDays: Set<DayOfWeek>,
    public readonly weeklyPlanning: Map<DayOfWeek, Set<LocalTimeSlot>>

) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employeeId', this.employeeId)
      .set('startDate', this.startDate)
      .set(
        'endDate',
        pipe(
          this.endDate,
          O.map(d => d.toString()),
          O.getOrElse(() => '')
        )
      )
      .set('overtimeAveragingPeriod', this.overtimeAveragingPeriod.toString())
      .set('weeklyTotalWorkedHours', this.weeklyTotalWorkedHours.toString())
      .set('weeklyNightShiftHours', this.weeklyNightShiftHours.toString())
      .set('workedDays', this.workedDays)
      .set('weeklyPlanning', this.weeklyPlanning)
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as EmploymentContract)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }
  period(defaultEndDate: LocalDate): LocalDateRange {
    return new LocalDateRange(this.startDate, pipe(
      this.endDate,
      O.match(() => defaultEndDate, identity)
    )
  )}
}
