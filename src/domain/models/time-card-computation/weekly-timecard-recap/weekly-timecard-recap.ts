import { List, Map, ValueObject } from 'immutable';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { EmploymentContract } from '../../employment-contract-management/employment-contract/employment-contract';
import { EmploymentContractId } from '../../employment-contract-management/employment-contract/employment-contract-id';
import { LocalDateRange } from '../../local-date-range';
import { WorkingPeriod } from '../working-period/working-period';
import { WorkingPeriodTimecard } from './working-period-timecard';

export class WeeklyTimecardRecap implements ValueObject {
  public static build(params: {
    employeeId: EmployeeId;
    employmentContractId: EmploymentContractId;
    period: LocalDateRange;
  }) {
    return new WeeklyTimecardRecap(params.employeeId, params.employmentContractId, params.period);
  }

  private _vo: Map<string, ValueObject | string | number | boolean>;

  private constructor(
    public readonly id: WeeklyTimecardRecapId,
    public readonly employeeId: EmployeeId,
    public readonly employmentContracts: List<EmploymentContractId>,
    public readonly week: LocalDateRange,
    public readonly workingPeriodTimecards: List<WorkingPeriodTimecard['id']>,
    public readonly workingPeriod: List<WorkingPeriod['id']>
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('employeeId', this.employeeId)
      .set('employmentContractId', this.employmentContractId)
      .set('period', this.period);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as WorkingPeriod)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  toString(): string {
    return JSON.stringify(this._vo.toJSON());
  }

  isComplete({ overtimeAveragingPeriod }: EmploymentContract) {
    return this.period.duration().equals(overtimeAveragingPeriod);
  }

  with(params: Partial<WorkingPeriod>): WorkingPeriod {
    return new WorkingPeriod(
      params.employeeId ?? this.employeeId,
      params.employmentContractId ?? this.employmentContractId,
      params.period ?? this.period
    );
  }
}
