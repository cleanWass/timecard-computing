import {EmployeeId} from '@domain/models/employee-registration/employee/employee-id';
import {ClientId} from '@domain/models/sales-contract-management/client/client-id';
import {RequirementId} from '@domain/models/sales-contract-management/requirement/requirement-id';

import {ServiceContractId} from '@domain/models/sales-contract-management/service-contract/service-contract-id';
import {Duration, LocalDateTime} from '@js-joda/core';
import {ShiftId} from './shift-id';

export type Shift = {
  id: ShiftId;
  serviceContractId: ServiceContractId;
  requirementIds: RequirementId[];
  startTime: LocalDateTime;
  duration: Duration;
  clientId: ClientId;
  employeeId: EmployeeId;
  replacedShiftId?: ShiftId;
};
