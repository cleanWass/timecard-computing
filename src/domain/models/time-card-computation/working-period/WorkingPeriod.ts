import {Map, ValueObject} from 'immutable';
import {LocalDate} from '@js-joda/core';

import {EmploymentContractId} from '../../employment-contract-management/employment-contract/EmploymentContractId';
import {EmployeeId} from '../../employee-registration/employee/EmployeeId';

export class WorkingPeriod implements ValueObject {
  private static buildValueObject(wp: WorkingPeriod) {
    return Map<string, ValueObject | string>()
      .set('cleanerId', wp.cleanerId)
      .set('workContractId', wp.workContractId)
      .set('startDate', wp.startDate)
      .set('endDate', wp.endDate);
  }

  private valueObject: ValueObject;

  constructor(
    public readonly cleanerId: EmployeeId,
    public readonly workContractId: EmploymentContractId,
    public readonly startDate: LocalDate,
    public readonly endDate: LocalDate
  ) {
    this.valueObject = WorkingPeriod.buildValueObject(this);
  }

  equals(other: unknown): boolean {
    return this.valueObject.equals((other as WorkingPeriod)?.valueObject);
  }

  hashCode(): number {
    return this.valueObject.hashCode();
  }
}
