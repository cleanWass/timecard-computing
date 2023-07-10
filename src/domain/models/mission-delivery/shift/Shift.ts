import {Duration, LocalDateTime} from '@js-joda/core';

import {ServiceContractId} from '../../sales-contract-management/service-contract/ServiceContractId';
import {RequirementId} from '../../sales-contract-management/requirement/RequirementId';
import {ShiftId} from './ShiftId';

export type Shift = {
  id: ShiftId;
  serviceContractId: ServiceContractId;
  requirementIds: RequirementId[];
  startTime: LocalDateTime;
  duration: Duration;
};
