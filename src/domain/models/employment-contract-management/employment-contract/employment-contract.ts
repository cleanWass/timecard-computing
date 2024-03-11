import { DayOfWeek, Duration, LocalDate, LocalTime } from '@js-joda/core';
import { identity, pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { Map, Set, ValueObject } from 'immutable';
import { ClassAttributes } from '../../../../~shared/util/types';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { LocalDateRange } from '../../local-date-range';
import { LocalTimeSlot } from '../../local-time-slot';
import { ContractType } from './contract-type';
import { EmploymentContractId } from './employment-contract-id';
import type { ContractSubType } from './contract-sub-type';

export type WeeklyPlanning = Map<DayOfWeek, Set<LocalTimeSlot>>;

// WeeklyTotalWorkedHours is the number of hours worked in a week.  If subType == "complement_d'heures" then it should integrate extra hours

export class EmploymentContract implements ValueObject {
  static nightShiftTimeSlots: [LocalTimeSlot, LocalTimeSlot] = [
    new LocalTimeSlot(LocalTime.MIN, LocalTime.of(6, 0)),
    new LocalTimeSlot(LocalTime.of(21, 0), LocalTime.MAX),
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
      params.weeklyPlannings,
      params.weeklyNightShiftHours ?? this.nightShiftTimeSlots,
      params.type,
      params.subType,
      params.extraDuration ?? undefined
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
    public readonly weeklyPlannings: Map<LocalDateRange, WeeklyPlanning>,
    public readonly weeklyNightShiftHours: [LocalTimeSlot, LocalTimeSlot],
    public readonly type: ContractType,
    public readonly subType?: ContractSubType,
    public readonly extraDuration?: Duration
  ) {
    this._vo = Map<
      string,
      ValueObject | ContractType | ContractSubType | string | number | boolean | null | undefined
    >()
      .set('id', id)
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
      .set('weeklyPlannings', this.weeklyPlannings)
      .set('type', this.type)
      .set('subType', this.subType || '')
      .set('weeklyNightShiftHours', this.weeklyNightShiftHours?.toString() || '')
      .set('extraDuration', this.extraDuration?.toString());
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

  debug() {
    return `
      id: ${this.id}
      employeeId: ${this.employeeId}
      period: ${this.period(LocalDate.now()).toFormattedString()} 
      planning: ${this.weeklyPlannings
        .map(
          (planning, period) =>
            `
${period.toFormattedString()}
${planning
  .map((slots, day) => `\t\t${day} -> ${slots.isEmpty() ? ' // ' : slots.map(s => s.debug()).join(' | ')}`)
  .join('\n')}`
        )
        .join('\n---------\n')}
    `;
  }
}
