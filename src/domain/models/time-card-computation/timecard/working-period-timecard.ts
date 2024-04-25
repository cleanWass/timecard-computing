import { DayOfWeek, Duration, LocalDate } from '@js-joda/core';
import { List, Map, Set, ValueObject } from 'immutable';
import { formatDuration, formatDurationAs100 } from '../../../../~shared/util/joda-helper';
import { keys } from '../../../../~shared/util/types';
import { Employee } from '../../employee-registration/employee/employee';
import {
  EmploymentContract,
  WeeklyPlanning,
} from '../../employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../leave-recording/leave/leave';
import { LocalDateRange } from '../../local-date-range';
import { LocalTimeSlot } from '../../local-time-slot';
import { InactiveShift } from '../../mission-delivery/shift/inactive-shift';
import { Shift } from '../../mission-delivery/shift/shift';
import { WorkingPeriod } from '../working-period/working-period';
import { HoursTypeCodes, WorkedHoursRate, WorkedHoursRecap, WorkedHoursRecapType } from './worked-hours-rate';

type WorkingPeriodTimecardId = string;

export class WorkingPeriodTimecard implements ValueObject {
  private static count = 0;
  public static build(params: {
    employee: Employee;
    contract: EmploymentContract;
    workingPeriod: WorkingPeriod;
    weeklyPlanning: WeeklyPlanning;

    shifts: List<Shift>;
    inactiveShifts?: List<InactiveShift>;

    leaves: List<Leave>;

    workedHours?: WorkedHoursRecapType;
    mealTickets?: number;
    rentability?: number;
  }) {
    return new WorkingPeriodTimecard(
      `${WorkingPeriodTimecard.count++}`,
      params.employee,
      params.contract,
      params.workingPeriod,
      params.workedHours ?? new WorkedHoursRecap(),
      params.weeklyPlanning ?? Map<DayOfWeek, Set<LocalTimeSlot>>(),
      params.shifts,
      params.leaves ?? List<Leave>(),
      List<InactiveShift>(),
      params.mealTickets ?? 0,
      params.rentability ?? 0
    );
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: WorkingPeriodTimecardId,
    public readonly employee: Employee,
    public readonly contract: EmploymentContract,
    public readonly workingPeriod: WorkingPeriod,
    public readonly workedHours: WorkedHoursRecapType,
    public readonly weeklyPlanning: WeeklyPlanning,

    public readonly shifts: List<Shift>,

    public readonly leaves: List<Leave>,

    public readonly inactiveShifts: List<InactiveShift>,
    public readonly mealTickets: number,
    public readonly rentability: number
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employee', this.employee)
      .set('contract', this.contract)
      .set('workingPeriod', this.workingPeriod)
      .set('workedHours', this.workedHours)
      .set('shifts', this.shifts)
      .set('leaves', this.leaves)
      .set('inactiveShifts', this.inactiveShifts)
      .set('mealTickets', this.mealTickets)
      .set('rentability', this.rentability);
  }

  getTotalIntercontractDuration() {
    const totalHoursAffected = Duration.ZERO.plus(this.workedHours.TotalWeekly)
      .plus(this.workedHours.TotalLeaves)
      .plus(this.workedHours.TotalInactiveShifts);
    return this.contract.weeklyTotalWorkedHours.minus(totalHoursAffected);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as WorkingPeriodTimecard)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  getNightOrdinary() {
    return this.weeklyPlanning.reduce(
      (days, slots, day) => (slots.some(slot => slot.isNight()) ? days.add(day) : days),
      Set<DayOfWeek>()
    );
  }

  with(params: Partial<WorkingPeriodTimecard>): WorkingPeriodTimecard {
    return new WorkingPeriodTimecard(
      params.id ?? this.id,
      params.employee ?? this.employee,
      params.contract ?? this.contract,
      params.workingPeriod ?? this.workingPeriod,
      params.workedHours ?? this.workedHours,
      params.weeklyPlanning ?? this.weeklyPlanning,
      params.shifts ?? this.shifts,
      params.leaves ?? this.leaves,
      params.inactiveShifts ?? this.inactiveShifts,
      params.mealTickets ?? this.mealTickets,
      params.rentability ?? this.rentability
    );
  }

  register(workedHoursRate: WorkedHoursRate, duration: Duration): WorkingPeriodTimecard {
    return this.with({
      workedHours: this.workedHours.set(workedHoursRate, duration),
    });
  }

  debug() {
    console.log(
      `
        WorkingPeriodTimecard ${this.id} for ${this.employee.firstName} ${this.employee.lastName} (${this.employee.id})
        MealTickets: ${this.mealTickets}
        Period: ${this.workingPeriod.period.toFormattedString()}
        Contract: ${this.contract.id} ${formatDuration(this.contract.weeklyTotalWorkedHours)} / week - ${
          this.contract.subType
        } ${this.contract.extraDuration || ''} \n NightWorker : ${this.getNightOrdinary().join(
          ', '
        )} - SundayWorker : ${this.contract.isSundayWorker() ? 'Yes' : 'No'}
        WorkedHours: 
            ${this.workedHours
              .toSeq()
              .map((duration, rate) =>
                duration.isZero() ? `` : `${HoursTypeCodes[rate]} -> ${formatDurationAs100(duration)}`
              )
              .filter(s => s)
              .join('\n\t\t')}
        Leaves: ${this.leaves
          .sortBy(
            s => s.date,
            (a, b) => a.compareTo(b)
          )
          .map(l => l.debug())
          .join(' | ')}
        Shifts: ${this.shifts
          .sortBy(
            s => s.startTime,
            (a, b) => a.compareTo(b)
          )
          .map(s => s.debug())
          .join(' | ')}
        InactiveShifts: ${this.inactiveShifts.map(s => s.debug()).join(' | ')}
        _____
        planning: ${this.weeklyPlanning
          .map((slots, day) => `${day} -> ${slots.map(s => s.debug()).join(' | ')}`)
          .join('\n\t\t')}
      `
    );
  }

  static getTotalMealTickets(list: List<WorkingPeriodTimecard>) {
    return list.reduce((total, timecard) => total + (timecard.contract.isFullTime() ? 0 : timecard.mealTickets), 0);
  }

  static getTotalWorkingPeriod(list: List<WorkingPeriodTimecard>) {
    const start = list.reduce(
      (res, tc) => (tc.workingPeriod.period.start.isBefore(res) ? tc.workingPeriod.period.start : res),
      LocalDate.MAX
    );
    const end = list.reduce(
      (res, tc) => (tc.workingPeriod.period.end.isAfter(res) ? tc.workingPeriod.period.end : res),
      LocalDate.MIN
    );
    return new LocalDateRange(start, end);
  }

  static getTotalWorkedHours(list: List<WorkingPeriodTimecard>) {
    return list.reduce(
      (total, timecard) =>
        new WorkedHoursRecap(
          keys(HoursTypeCodes).reduce(
            (acc, key) => {
              acc[key] = total[key].plus(timecard.workedHours[key]);
              return acc;
            },
            {} as { [k in WorkedHoursRate]: Duration }
          )
        ),
      new WorkedHoursRecap()
    );
  }
}

export type PeriodTimeCard = List<WorkingPeriodTimecard>;
