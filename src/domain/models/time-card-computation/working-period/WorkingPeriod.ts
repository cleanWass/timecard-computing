import {LocalDate} from '@js-joda/core';

import {EmploymentContractId} from '../../employment-contract-management/employment-contract/EmploymentContractId';
import {EmployeeId} from '../../employee-registration/agent/EmployeeId';
import {WorkingPeriodId} from './WorkingPeriodId';

export type WorkingPeriod = {
  id: WorkingPeriodId;
  cleanerId: EmployeeId;
  workContractId: EmploymentContractId;
  startDate: LocalDate;
  endDate: LocalDate;
};
