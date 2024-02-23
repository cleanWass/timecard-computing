import { Map, ValueObject } from 'immutable';
import { EmployeeId } from '../../employee-registration/employee/employee-id';
import { EmploymentContract } from '../../employment-contract-management/employment-contract/employment-contract';
import { EmploymentContractId } from '../../employment-contract-management/employment-contract/employment-contract-id';
import { LocalDateRange } from '../../local-date-range';

export class WorkingPeriod implements ValueObject {
  public static build(params: { employeeId: EmployeeId; employmentContractId: EmploymentContractId; period: LocalDateRange }) {
    return new WorkingPeriod(params.employeeId, params.employmentContractId, params.period);
  }

  private _vo: Map<string, ValueObject | string | number | boolean>;

  private constructor(
    public readonly employeeId: EmployeeId,
    public readonly employmentContractId: EmploymentContractId,
    public readonly period: LocalDateRange
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
