import { List, Map, ValueObject } from 'immutable';
import { Employee } from '../../employee-registration/employee/employee';
import { EmploymentContract } from '../../employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../local-date-range';
import { WorkingPeriod } from '../working-period/working-period';
import { WeeklyTimecardRecapId } from './weekly-timecard-recap-id';
import { WorkingPeriodTimecard } from '../timecard/working-period-timecard';

export class WeeklyTimecardRecap implements ValueObject {
  private static count = 0;
  public static build({
    id = `WTR-${WeeklyTimecardRecap.count++}`,
    week,
    employee,
    workingPeriods,
    employmentContracts,
    workingPeriodTimecards,
  }: {
    id?: WeeklyTimecardRecapId;
    week: LocalDateRange;
    employee: Employee;
    workingPeriods: List<WorkingPeriod>;
    employmentContracts: List<EmploymentContract>;
    workingPeriodTimecards: List<WorkingPeriodTimecard>;
  }) {
    return new WeeklyTimecardRecap(
      id,
      employee,
      week,
      workingPeriods,
      employmentContracts,
      workingPeriodTimecards
    );
  }

  private _vo: Map<string, ValueObject | string | number | boolean>;

  private constructor(
    public readonly id: WeeklyTimecardRecapId,
    public readonly employee: Employee,
    public readonly week: LocalDateRange,
    public readonly workingPeriods: List<WorkingPeriod>,
    public readonly employmentContracts: List<EmploymentContract>,
    public readonly workingPeriodTimecards: List<WorkingPeriodTimecard>
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employee', this.employee)
      .set('employmentContracts', this.employmentContracts)
      .set('week', this.week)
      .set('workingPeriodTimecards', this.workingPeriodTimecards)
      .set('workingPeriods', this.workingPeriods);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as WeeklyTimecardRecap)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  toString(): string {
    return JSON.stringify(this._vo.toJSON());
  }

  debug(): string {
    return `
  WeeklyTimecardRecap # ${this.id}
  employee: ${this.employee.firstName} ${this.employee.lastName} - (${this.employee.silaeId}
  contracts: ${this.employmentContracts.map(c => c.debug()).join('\n')}
  week: ${this.week.toFormattedString()}
  workingPeriods: ${this.workingPeriods.map(wp => wp.toString()).join('\n')}
  workingPeriodTimecards: ${this.workingPeriodTimecards.map(wpt => wpt.id).join(', ')}
    `;
  }

  getTotalWorkedHours() {
    return WorkingPeriodTimecard.getTotalWorkedHours(this.workingPeriodTimecards);
  }

  getTotalMealTickets() {
    return WorkingPeriodTimecard.getTotalMealTickets(this.workingPeriodTimecards);
  }

  with(params: Partial<WeeklyTimecardRecap>): WeeklyTimecardRecap {
    return new WeeklyTimecardRecap(
      params.id ?? this.id,
      params.employee ?? this.employee,
      params.week ?? this.week,
      params.workingPeriods ?? this.workingPeriods,
      params.employmentContracts ?? this.employmentContracts,
      params.workingPeriodTimecards ?? this.workingPeriodTimecards
    );
  }
}
