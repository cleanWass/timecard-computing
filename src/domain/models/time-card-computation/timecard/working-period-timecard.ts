import { DayOfWeek, Duration, LocalDate, LocalDateTime, LocalTime, TemporalAdjusters } from '@js-joda/core';
import { List, Map, ValueObject, Set } from 'immutable';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { EmploymentContract } from '../../employment-contract-management/employment-contract/employment-contract';
import { EmploymentContractId } from '../../employment-contract-management/employment-contract/employment-contract-id';
import { LocalTimeSlot } from '../../local-time-slot';
import { Shift } from '../../mission-delivery/shift/shift';
import { WorkingPeriod } from '../working-period/working-period';
import { WorkedHoursRate, WorkedHoursResume, WorkedHoursResumeType } from './worked-hours-rate';

type WorkingPeriodTimecardId = string;

export class WorkingPeriodTimecard implements ValueObject {
  private static count = 0;
  public static build(params: {
    employeeId: EmployeeId;
    contractId: EmploymentContractId;
    workingPeriod: WorkingPeriod;
    workedHours?: WorkedHoursResumeType;
    fakeShifts?: List<Shift>;
  }) {
    return new WorkingPeriodTimecard(
      `${WorkingPeriodTimecard.count++}`,
      params.employeeId,
      params.contractId,
      params.workingPeriod,
      params.workedHours ?? new WorkedHoursResume(),
      List<Shift>()
    );
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: WorkingPeriodTimecardId,
    public readonly employeeId: EmployeeId,
    public readonly contractId: EmploymentContractId,
    public readonly workingPeriod: WorkingPeriod,
    public readonly workedHours: WorkedHoursResumeType,
    public readonly fakeShifts: List<Shift>
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employeeId', this.employeeId)
      .set('contractId', this.contractId)
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
      params.employeeId ?? this.employeeId,
      params.contractId ?? this.contractId,
      params.workingPeriod ?? this.workingPeriod,
      params.workedHours ?? this.workedHours,
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
    return (
      list
        // TODO: when shifts is refactored to class, we can use a builder to generate fake shifts
        .reduce(
          (shifts, day) =>
            shifts.concat(
              contract.weeklyPlanning
                .get(day.dayOfWeek(), Set<LocalTimeSlot>())
                .toList()
                .map(
                  (timeSlot, index) =>
                    ({
                      id: `fake_shift_workingPeriod-${this.id}--${index}`,
                      duration: timeSlot.duration(),
                      employeeId: this.employeeId,
                      startTime: LocalDateTime.of(day, timeSlot.startTime),
                      clientId: 'fake_client',
                    }) satisfies Shift
                )
            ),
          List<Shift>()
        )
    );
  }
}

export type PeriodTimeCard = List<WorkingPeriodTimecard>;
