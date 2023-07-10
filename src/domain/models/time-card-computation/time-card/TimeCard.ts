import {Map} from 'immutable';
import {Duration} from '@js-joda/core';

import {WorkingPeriodId} from '../working-period/WorkingPeriodId';
import {WorkedHoursRate} from './WorkedHoursRate';
import {EmploymentContractId} from '../../employment-contract-management/employment-contract/EmploymentContractId';
import {EmployeeId} from '../../employee-registration/agent/EmployeeId';

export type TimeCard = {
  cleanerId: EmployeeId;
  contractId: EmploymentContractId;
  workingPeriodId: WorkingPeriodId;
  workedHours: Map<WorkedHoursRate, Duration>;
};
