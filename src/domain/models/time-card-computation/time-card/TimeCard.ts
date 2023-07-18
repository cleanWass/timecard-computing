import {Map} from 'immutable';
import {Duration} from '@js-joda/core';

import {WorkingPeriodId} from '@domain/models/time-card-computation/working-period/WorkingPeriodId';
import {EmploymentContractId} from '@domain/models/employment-contract-management/employment-contract/EmploymentContractId';
import {EmployeeId} from '@domain/models/employee-registration/employee/EmployeeId';
import {WorkedHoursRate} from './WorkedHoursRate';

export type TimeCard = {
  cleanerId: EmployeeId;
  contractId: EmploymentContractId;
  workingPeriodId: WorkingPeriodId;
  workedHours: Map<WorkedHoursRate, Duration>;
};
