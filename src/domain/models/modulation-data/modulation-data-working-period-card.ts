import { DayOfWeek, Duration, LocalDate } from '@js-joda/core';
import { List, Map, Set, ValueObject } from 'immutable';
import { formatDuration, formatDurationAs100 } from '../../../~shared/util/joda-helper';
import { keys } from '../../../~shared/util/types';
import { Employee } from '../employee-registration/employee/employee';
import {
  EmploymentContract,
  WeeklyPlanning,
} from '../employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../leave-recording/leave/leave';
import { LocalDateRange } from '../local-date-range';
import { LocalTimeSlot } from '../local-time-slot';
import { InactiveShift } from '../mission-delivery/shift/inactive-shift';
import { Shift } from '../mission-delivery/shift/shift';
import {
  HoursTypeCodes,
  WorkedHoursRate,
  WorkedHoursRecap,
  WorkedHoursRecapType,
} from '../cost-efficiency/worked-hours-rate';
import { WorkingPeriod } from '../time-card-computation/working-period/working-period';
import {
  SurchargedHoursPool,
  SurchargedHoursPoolRate,
  SurchargedHoursPoolType,
} from './surcharged-hours-pool';

const HALF_YEAR_PERIOD_TOTAL_WORKING_HOURS = 1607 / 2;
const BASE_FULL_TIME_WORKING_HOURS = 35;
export const MODULATED_FULL_TIME_DURATION = Duration.ofHours(30).plusMinutes(54);

type ModulationDataWorkingPeriodCardId = string;

export class ModulationDataWorkingPeriodCard implements ValueObject {
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
    surchargedHoursPool?: SurchargedHoursPoolType;
    mealTickets?: number;
  }) {
    return new ModulationDataWorkingPeriodCard(
      `${ModulationDataWorkingPeriodCard.count++}`,
      params.employee,
      params.contract,
      params.workingPeriod,
      params.workedHours ?? new WorkedHoursRecap(),
      params.surchargedHoursPool ?? new SurchargedHoursPool(),
      params.weeklyPlanning ?? Map<DayOfWeek, Set<LocalTimeSlot>>(),
      params.shifts,
      params.leaves ?? List<Leave>(),
      List<InactiveShift>(),
      params.mealTickets ?? 0
    );
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: ModulationDataWorkingPeriodCardId,
    public readonly employee: Employee,
    public readonly contract: EmploymentContract,
    public readonly workingPeriod: WorkingPeriod,
    public readonly workedHours: WorkedHoursRecapType,
    public readonly surchargedHoursPool: SurchargedHoursPoolType,
    public readonly weeklyPlanning: WeeklyPlanning,
    public readonly shifts: List<Shift>,
    public readonly leaves: List<Leave>,
    public readonly inactiveShifts: List<InactiveShift>,
    public readonly mealTickets: number
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employee', this.employee)
      .set('contract', this.contract)
      .set('workingPeriod', this.workingPeriod)
      .set('workedHours', this.workedHours)
      .set('surchargedHoursPool', this.surchargedHoursPool)
      .set('shifts', this.shifts)
      .set('leaves', this.leaves)
      .set('inactiveShifts', this.inactiveShifts)
      .set('mealTickets', this.mealTickets);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as ModulationDataWorkingPeriodCard)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  getNightOrdinary() {
    return this.contract.type === 'CDD'
      ? Set(DayOfWeek.values())
      : this.weeklyPlanning.reduce(
          (days, slots, day) => (slots.some(slot => slot.isNight()) ? days.add(day) : days),
          Set<DayOfWeek>()
        );
  }

  getModulatedInProportionWorkingTime(
    halfYearPeriodTotalWorkingHours = HALF_YEAR_PERIOD_TOTAL_WORKING_HOURS
  ) {
    return Duration.ofMinutes(
      Math.floor(
        (((halfYearPeriodTotalWorkingHours / BASE_FULL_TIME_WORKING_HOURS) *
          this.contract.weeklyTotalWorkedHours.toMinutes()) /
          26) *
          (this.workingPeriod.period.numberOfDays() / 7)
      )
    );
  }

  with(params: Partial<ModulationDataWorkingPeriodCard>): ModulationDataWorkingPeriodCard {
    return new ModulationDataWorkingPeriodCard(
      params.id ?? this.id,
      params.employee ?? this.employee,
      params.contract ?? this.contract,
      params.workingPeriod ?? this.workingPeriod,
      params.workedHours ?? this.workedHours,
      params.surchargedHoursPool ?? this.surchargedHoursPool,
      params.weeklyPlanning ?? this.weeklyPlanning,
      params.shifts ?? this.shifts,
      params.leaves ?? this.leaves,
      params.inactiveShifts ?? this.inactiveShifts,
      params.mealTickets ?? this.mealTickets
    );
  }

  addSurchargedHoursToPool(rate: SurchargedHoursPoolRate, duration: Duration) {
    return this.with({ surchargedHoursPool: this.surchargedHoursPool.set(rate, duration) });
  }

  register(workedHoursRate: WorkedHoursRate, duration: Duration): ModulationDataWorkingPeriodCard {
    return this.with({
      workedHours: this.workedHours.set(workedHoursRate, duration),
    });
  }

  debug({ showPlanning = false }: { showPlanning?: boolean } = {}): string {
    return `
        ModulationDataWorkingPeriodCard ${this.id} for ${this.employee.firstName} ${
          this.employee.lastName
        } (${this.employee.silaeId})
        Period: ${this.workingPeriod.period.toFormattedString()}
        InProportionWorkingTime: ${formatDurationAs100(this.getModulatedInProportionWorkingTime())}
        MealTickets: ${this.mealTickets} 
        Contract: ${this.contract.id} ${formatDuration(
          this.contract.weeklyTotalWorkedHours
        )} / week - ${this.contract.subType} ${this.contract.extraDuration || ''} 
           NightWorker : ${this.getNightOrdinary().join(', ')} - SundayWorker : ${
             this.contract.isSundayWorker() ? 'Yes' : 'No'
           }
          ----------------------
            WorkedHours: 
            ${this.workedHours
              .toSeq()
              .map((duration, rate) =>
                duration.isZero()
                  ? ``
                  : `${HoursTypeCodes[rate]} -> ${formatDurationAs100(duration)}`
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
         ----------------------
          total worked hours: ${formatDuration(
            this.shifts.reduce((total, shift) => total.plus(shift.duration), Duration.ZERO)
          )}
         ----------------------
          surcharged hours pool: 
            ${this.surchargedHoursPool
              .toSeq()
              .map((duration, rate) =>
                duration.isZero()
                  ? ``
                  : `${HoursTypeCodes[rate]} -> ${formatDurationAs100(duration)}`
              )
              .filter(s => s)
              .join('\n\t\t')}
         ----------------------
          ${
            showPlanning
              ? `planning: ${this.weeklyPlanning
                  .map((slots, day) => `${day} -> ${slots.map(s => s.debug()).join(' | ')}`)
                  .join('\n\t\t')}`
              : ''
          }
      `;
  }

  static getTotalMealTickets(list: List<ModulationDataWorkingPeriodCard>) {
    return list.reduce(
      (total, timecard) => total + (timecard.contract.isFullTime() ? 0 : timecard.mealTickets),
      0
    );
  }

  static getTotalWorkingPeriod(list: List<ModulationDataWorkingPeriodCard>) {
    const start = list.reduce(
      (res, tc) =>
        tc.workingPeriod.period.start.isBefore(res) ? tc.workingPeriod.period.start : res,
      LocalDate.MAX
    );
    const end = list.reduce(
      (res, tc) => (tc.workingPeriod.period.end.isAfter(res) ? tc.workingPeriod.period.end : res),
      LocalDate.MIN
    );
    return new LocalDateRange(start, end);
  }

  static getTotalWorkedHours(list: List<ModulationDataWorkingPeriodCard>) {
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

export type PeriodTimeCard = List<ModulationDataWorkingPeriodCard>;
