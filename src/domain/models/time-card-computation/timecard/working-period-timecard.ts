import { DayOfWeek, Duration, LocalDateTime, TemporalAdjusters } from '@js-joda/core';
import { List, Map, Set, ValueObject } from 'immutable';
import { Employee } from '../../employee-registration/employee/employee';
import { EmploymentContract } from '../../employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../leave-recording/leave/leave';
import { LocalTimeSlot } from '../../local-time-slot';
import { Shift } from '../../mission-delivery/shift/shift';
import { WorkingPeriod } from '../working-period/working-period';
import { WorkedHoursRate, WorkedHoursResume, WorkedHoursResumeType } from './worked-hours-rate';

type WorkingPeriodTimecardId = string;

export class WorkingPeriodTimecard implements ValueObject {
  private static count = 0;
  public static build(params: {
    employee: Employee;
    contract: EmploymentContract;
    workingPeriod: WorkingPeriod;

    shifts: List<Shift>;
    leaves: List<Leave>;

    fakeShifts?: List<Shift>;
    workedHours?: WorkedHoursResumeType;
  }) {
    return new WorkingPeriodTimecard(
      `${WorkingPeriodTimecard.count++}`,
      params.employee,
      params.contract,
      params.workingPeriod,
      params.workedHours ?? new WorkedHoursResume(),
      params.shifts,
      params.leaves,
      List<Shift>()
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

    public readonly fakeShifts: List<Shift>
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employee', this.employee)
      .set('contract', this.contract)
      .set('workingPeriod', this.workingPeriod)
      .set('workedHours', this.workedHours)
      .set('fakeShifts', this.fakeShifts);
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
      params.fakeShifts ?? this.fakeShifts
    );
  }

  register(workedHoursRate: WorkedHoursRate, duration: Duration): WorkingPeriodTimecard {
    return this.with(this.workedHours.set(workedHoursRate, duration));
  }

  generateFakeShifts(contract: EmploymentContract) {
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
                id: `fake_shift_workingPeriod-${this.id}--${index}`,
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
