import { DayOfWeek, Duration } from '@js-joda/core';
import { List, Map, Set, ValueObject } from 'immutable';
import { formatDuration, formatDurationAs100 } from '../../../../~shared/util/joda-helper';
import { keys } from '../../../../~shared/util/types';
import { Employee } from '../../employee-registration/employee/employee';
import {
  EmploymentContract,
  WeeklyPlanning,
} from '../../employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../leave-recording/leave/leave';
import { LocalTimeSlot } from '../../local-time-slot';
import { Shift } from '../../mission-delivery/shift/shift';
import { TheoreticalShift } from '../../mission-delivery/shift/theorical-shift';
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
    theoreticalShifts?: List<TheoreticalShift>;

    leaves: List<Leave>;

    workedHours?: WorkedHoursRecapType;
    mealTickets?: number;
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
      List<TheoreticalShift>(),
      params.mealTickets ?? 0,
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

    public readonly theoreticalShifts: List<TheoreticalShift>,
    public readonly mealTickets: number,
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employee', this.employee)
      .set('contract', this.contract)
      .set('workingPeriod', this.workingPeriod)
      .set('workingPeriod', this.workingPeriod)
      .set('workedHours', this.workedHours)
      .set('shifts', this.shifts)
      .set('leaves', this.leaves)
      .set('theoreticalShifts', this.theoreticalShifts)
      .set('mealTickets', this.mealTickets);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as WorkingPeriodTimecard)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  getNightOrdinary() {
    return this.weeklyPlanning.reduce(
      (days, slots, day) => (slots.some((slot) => slot.isNight()) ? days.add(day) : days),
      Set<DayOfWeek>(),
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
      params.theoreticalShifts ?? this.theoreticalShifts,
      params.mealTickets ?? this.mealTickets,
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
        Contract: ${formatDuration(this.contract.weeklyTotalWorkedHours)} / week - ${this.contract.subType} ${
          this.contract.extraDuration || ''
        } \n NightWorker : ${this.getNightOrdinary().join(', ')} - SundayWorker : ${
          this.contract.isSundayWorker() ? 'Yes' : 'No'
        }
        WorkedHours: 
            ${this.workedHours
              .toSeq()
              .map((duration, rate) =>
                duration.isZero() ? `` : `${HoursTypeCodes[rate]} -> ${formatDurationAs100(duration)}`,
              )
              .filter((s) => s)
              .join('\n\t\t')}
        Leaves: ${this.leaves
          .sortBy(
            (s) => s.date,
            (a, b) => a.compareTo(b),
          )
          .map((l) => l.debug())
          .join(' | ')}
        Shifts: ${this.shifts
          .sortBy(
            (s) => s.startTime,
            (a, b) => a.compareTo(b),
          )
          .map((s) => s.debug())
          .join(' | ')}
        TheoreticalShifts: ${this.theoreticalShifts.map((s) => s.debug()).join(' | ')}
        _____
        planning: ${this.weeklyPlanning
          .map((slots, day) => `${day} -> ${slots.map((s) => s.debug()).join(' | ')}`)
          .join('\n\t\t')}
      `,
    );
  }

  static getTotalMealTickets(list: List<WorkingPeriodTimecard>) {
    return list.reduce((total, timecard) => total + (timecard.contract.isFullTime() ? 0 : timecard.mealTickets), 0);
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
            {} as { [k in WorkedHoursRate]: Duration },
          ),
        ),
      new WorkedHoursRecap(),
    );
  }
}

export type PeriodTimeCard = List<WorkingPeriodTimecard>;
