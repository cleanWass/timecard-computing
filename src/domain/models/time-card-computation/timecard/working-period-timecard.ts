import { DateTimeFormatter, DayOfWeek, Duration, LocalDateTime, TemporalAdjusters } from '@js-joda/core';
import { List, Map, Set, ValueObject } from 'immutable';
import { formatDuration, formatDurationAs100 } from '../../../../~shared/util/joda-helper';
import { Employee } from '../../employee-registration/employee/employee';
import { EmploymentContract } from '../../employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../leave-recording/leave/leave';
import { LeavePeriod } from '../../leave-recording/leave/leave-period';
import { LocalTimeSlot } from '../../local-time-slot';
import { Shift } from '../../mission-delivery/shift/shift';
import { TheoreticalShift } from '../../mission-delivery/shift/theorical-shift';
import { WorkingPeriod } from '../working-period/working-period';
import { HoursTypeCodes, WorkedHoursRate, WorkedHoursResume, WorkedHoursResumeType } from './worked-hours-rate';

type WorkingPeriodTimecardId = string;

export class WorkingPeriodTimecard implements ValueObject {
  private static count = 0;
  public static build(params: {
    employee: Employee;
    contract: EmploymentContract;
    workingPeriod: WorkingPeriod;

    shifts: List<Shift>;
    theoreticalShifts?: List<TheoreticalShift>;

    leaves?: List<Leave>;
    leavePeriods: List<LeavePeriod>;

    workedHours?: WorkedHoursResumeType;
  }) {
    return new WorkingPeriodTimecard(
      `${WorkingPeriodTimecard.count++}`,
      params.employee,
      params.contract,
      params.workingPeriod,
      params.workedHours ?? new WorkedHoursResume(),
      params.shifts,
      params.leaves ?? List<Leave>(),
      params.leavePeriods,
      List<TheoreticalShift>()
    );
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: WorkingPeriodTimecardId,
    public readonly employee: Employee,
    public readonly contract: EmploymentContract,
    public readonly workingPeriod: WorkingPeriod,
    public readonly workedHours: WorkedHoursResumeType,

    public readonly shifts: List<Shift>,

    public readonly leaves: List<Leave>,
    public readonly leavePeriods: List<LeavePeriod>,

    public readonly theoreticalShifts: List<TheoreticalShift>
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employee', this.employee)
      .set('contract', this.contract)
      .set('workingPeriod', this.workingPeriod)
      .set('workedHours', this.workedHours)
      .set('shifts', this.shifts)
      .set('leaves', this.leaves)
      .set('leavePeriods', this.leavePeriods)
      .set('theoreticalShifts', this.theoreticalShifts);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as WorkingPeriodTimecard)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  with(params: Partial<WorkingPeriodTimecard>): WorkingPeriodTimecard {
    return new WorkingPeriodTimecard(
      params.id ?? this.id,
      params.employee ?? this.employee,
      params.contract ?? this.contract,
      params.workingPeriod ?? this.workingPeriod,
      params.workedHours ?? this.workedHours,
      params.shifts ?? this.shifts,
      params.leaves ?? this.leaves,
      params.leavePeriods ?? this.leavePeriods,
      params.theoreticalShifts ?? this.theoreticalShifts
    );
  }

  register(workedHoursRate: WorkedHoursRate, duration: Duration): WorkingPeriodTimecard {
    return this.with({ workedHours: this.workedHours.set(workedHoursRate, duration) });
  }

  debug() {
    console.log(
      `
        WorkingPeriodTimecard ${this.id} for ${this.employee.firstName} ${this.employee.lastName} (${this.employee.id})
        Period: ${this.workingPeriod.period.toFormattedString()}
        Contract: ${formatDuration(this.contract.weeklyTotalWorkedHours)} / week - NightWorker : ${
          this.contract.isNightWorker() ? 'Yes' : 'No'
        } - SundayWorker : ${this.contract.isSundayWorker() ? 'Yes' : 'No'}
        WorkedHours: 
            ${this.workedHours
              .toSeq()
              .map((duration, rate) => (duration.isZero() ? `` : `${HoursTypeCodes[rate]} -> ${formatDurationAs100(duration)}`))
              .filter(s => s)
              .join('\n\t\t\t')}
        Leaves: ${this.leaves.map(l => l.debug()).join(' | ')}
        LeavePeriods: ${this.leavePeriods.map(l => l.debug()).join(' | ')}
        Shifts: ${this.shifts.map(s => s.debug()).join(' | ')}
        TheoreticalShifts: ${this.theoreticalShifts.map(s => s.debug()).join(' | ')}
      `
    );
  }

  generateTheoreticalShifts(contract: EmploymentContract) {
    let list = List(
      this.workingPeriod.period
        .with({
          start: this.workingPeriod.period.start.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)),
          end: this.workingPeriod.period.start
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
            .plusDays(contract.overtimeAveragingPeriod.toDays()),
        })
        .toLocalDateArray()
    ).filter(d => !this.workingPeriod.period.contains(d));
    return list.reduce(
      (shifts, day) =>
        shifts.concat(
          contract.weeklyPlanning
            .get(day.dayOfWeek(), Set<LocalTimeSlot>())
            .toList()
            .map((timeSlot, index) =>
              Shift.build({
                id: `fictional_shift_workingPeriod-${this.id}--${index}`,
                duration: timeSlot.duration(),
                employeeId: this.employee.id,
                startTime: LocalDateTime.of(day, timeSlot.startTime),
                clientId: 'fake_client',
              })
            )
        ),
      List<Shift>()
    );
  }
}

export type PeriodTimeCard = List<WorkingPeriodTimecard>;
