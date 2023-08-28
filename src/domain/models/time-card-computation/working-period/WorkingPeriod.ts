import {LocalDateRange} from '@domain/models/localDateRange';
import {Map, ValueObject} from 'immutable';

import {EmploymentContractId} from '@domain/models/employment-contract-management/employment-contract/EmploymentContractId';
import {EmployeeId} from '@domain/models/employee-registration/employee/EmployeeId';

export class WorkingPeriod implements ValueObject {
  public static build(params: {
    employeeId: EmployeeId;
    employmentContractId: EmploymentContractId;
    period: LocalDateRange;
  }) {
    return new WorkingPeriod(
      params.employeeId,
      params.employmentContractId,
      params.period
    );
  }

  private _vo: Map<string, ValueObject | string | number | boolean>;

  private constructor(
    public readonly employeeId: EmployeeId,
    public readonly employmentContractId: EmploymentContractId,
    public readonly period: LocalDateRange
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('cleanerId', this.employeeId)
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
}
