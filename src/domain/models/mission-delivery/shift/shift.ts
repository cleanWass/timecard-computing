import {Duration, LocalDateTime} from '@js-joda/core';
import {EmployeeId} from '../../employee-registration/employee/employee-id';
import {ClientId} from '../../sales-contract-management/client/client-id';
import {RequirementId} from '../../sales-contract-management/requirement/requirement-id';
import {ServiceContractId} from '../../sales-contract-management/service-contract/service-contract-id';
import {ShiftId} from './shift-id';

export type Shift = {
  id: ShiftId;
  serviceContractId?: ServiceContractId;
  requirementIds?: RequirementId[];
  startTime: LocalDateTime;
  duration: Duration;
  clientId: ClientId;
  employeeId: EmployeeId;
  replacedShiftId?: ShiftId;
};
