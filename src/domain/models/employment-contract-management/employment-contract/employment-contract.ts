import { DayOfWeek, Duration, LocalDate, LocalTime } from '@js-joda/core';
import { identity, pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { Map, Set, ValueObject } from 'immutable';
import { ClassAttributes } from '../../../../~shared/util/types';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { LocalDateRange } from '../../local-date-range';
import { LocalTimeSlot } from '../../local-time-slot';
import { EmploymentContractId } from './employment-contract-id';
import type { ContractSubType } from './contract-sub-type';

export class EmploymentContract implements ValueObject {
  private static nightShiftTimeSlots: [LocalTimeSlot, LocalTimeSlot] = [
    new LocalTimeSlot(LocalTime.MIN, LocalTime.of(4, 0)),
    new LocalTimeSlot(LocalTime.of(20, 0), LocalTime.MAX),
  ];

  public static build(params: ClassAttributes<EmploymentContract>) {
    return new EmploymentContract(
      params.id,
      params.employeeId,
      params.startDate,
      params.endDate,
      params.overtimeAveragingPeriod,
      params.weeklyTotalWorkedHours,
      params.workedDays,
      params.weeklyPlanning,
      params.subType,
      params.extraDuration ?? null,
      params.weeklyNightShiftHours ?? this.nightShiftTimeSlots
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
    public readonly workedDays: Set<DayOfWeek>,
    public readonly weeklyPlanning: Map<DayOfWeek, Set<LocalTimeSlot>>,
    public readonly subType?: ContractSubType,
    public readonly extraDuration?: Duration,
    public readonly weeklyNightShiftHours?: [LocalTimeSlot, LocalTimeSlot]
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
      .set('workedDays', this.workedDays)
      .set('weeklyPlanning', this.weeklyPlanning)
      .set('subType', this.subType)
      .set('weeklyNightShiftHours', this.weeklyNightShiftHours.toString())
      .set('extraDuration', this.extraDuration?.toString() ?? null);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as EmploymentContract)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }
  period(defaultEndDate: LocalDate): LocalDateRange {
    return new LocalDateRange(
      this.startDate,
      pipe(
        this.endDate,
        O.match(() => defaultEndDate, identity)
      )
    );
  }

  isNightWorker(): boolean {
    return this.weeklyPlanning.some(slots => slots.some(slot => slot.isNight()));
  }

  isSundayWorker(): boolean {
    return this.workedDays.includes(DayOfWeek.SUNDAY);
  }

  isExtraHours(): boolean {
    return this.subType === 'complement_heure';
  }

  isFullTime(): boolean {
    return this.weeklyTotalWorkedHours.equals(Duration.ofHours(35));
  }

  with(params: ClassAttributes<EmploymentContract>) {
    return EmploymentContract.build(params);
  }
}
