import { EmployeeId } from '@domain/models/employee-registration/employee/EmployeeId';
import { ClientId } from '@domain/models/sales-contract-management/client/ClientId';
import {Duration, LocalDateTime} from '@js-joda/core';

import {ServiceContractId} from '@domain/models/sales-contract-management/service-contract/ServiceContractId';
import {RequirementId} from '@domain/models/sales-contract-management/requirement/RequirementId';
import {ShiftId} from './ShiftId';

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
