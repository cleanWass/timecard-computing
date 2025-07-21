import zod from 'zod';
import { CONTRACT_TYPE } from '../../../domain/models/employment-contract-management/employment-contract/contract-type';
import { LEAVE_REASON } from '../../../domain/models/leave-recording/leave/leave-retribution';
import { closedPeriodValidator, dayValidator, periodValidator } from './temporals';

export const leaveValidator = zod.object({
  id: zod.string().min(1),
  silaeId: zod.string().min(1),
  clientId: zod.string(),
  clientName: zod.string(),
  date: zod.string().min(1),
  startTime: zod.string().min(1),
  endTime: zod.string().min(1),
  duration: zod.string(),
  absenceType: zod.enum(LEAVE_REASON),
});
