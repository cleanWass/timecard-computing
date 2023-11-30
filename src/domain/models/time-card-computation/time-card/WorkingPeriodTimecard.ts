import {EmployeeId} from '@domain/models/employee-registration/employee/employee-id';
import {EmploymentContractId} from '@domain/models/employment-contract-management/employment-contract/employment-contract-id';
import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';

import {WorkingPeriodId} from '@domain/models/time-card-computation/working-period/WorkingPeriodId';
import {Duration} from '@js-joda/core';
import {List, Map, ValueObject, Record} from 'immutable';
import { WorkedHoursRate, WorkedHoursResume } from './WorkedHoursRate';

type WorkingPeriodTimecardId = string;

export interface WPTimecard {
  id: WorkingPeriodTimecardId;
  employeeId: EmployeeId;
  contractId: EmploymentContractId;
  workingPeriod: WorkingPeriod;
  workedHours: Record<{[K in WorkedHoursRate]: Duration}>;
}

const test = new WorkedHoursResume()

export class WorkingPeriodTimecard implements ValueObject, WPTimecard {
  private static count = 0;
  public static build(params: {
    employeeId: EmployeeId;
    contractId: EmploymentContractId;
    workingPeriod: WorkingPeriod;
    workedHours?: typeof test;
  }) {
    return new WorkingPeriodTimecard(
      `${WorkingPeriodTimecard.count++}`,
      params.employeeId,
      params.contractId,
      params.workingPeriod,
      params.workedHours ?? new WorkedHoursResume(),
    );
  }

  private readonly _vo: ValueObject;

  private constructor(
    public readonly id: WorkingPeriodTimecardId,
    public readonly employeeId: EmployeeId,
    public readonly contractId: EmploymentContractId,
    public readonly workingPeriod: WorkingPeriod,
    public readonly workedHours: typeof test
  ) {
    this._vo = Map<string, ValueObject | string | number | boolean>()
      .set('id', this.id)
      .set('employeeId', this.employeeId)
      .set('contractId', this.contractId)
      .set('workingPeriod', this.workingPeriod)
      .set('workedHours', this.workedHours);
  }

  equals(other: unknown): boolean {
    return this._vo.equals((other as WorkingPeriodTimecard)?._vo);
  }

  hashCode(): number {
    return this._vo.hashCode();
  }

  register(workedHoursRate: WorkedHoursRate, duration: Duration): WorkingPeriodTimecard {
    return new WorkingPeriodTimecard(
      this.id,
      this.employeeId,
      this.contractId,
      this.workingPeriod,
      this.workedHours.set(workedHoursRate, duration)
    );
  }
}

export type PeriodTimeCard = List<WorkingPeriodTimecard>;
