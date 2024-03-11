import zod from 'zod';
import { SHIFT_REASON } from '../../../domain/models/mission-delivery/shift/shift-reason';

export const shiftValidator = zod
  .object({
    id: zod.string(),
    date: zod.string().min(1),
    type: zod.enum(SHIFT_REASON),
    startTime: zod.string(),
    duration: zod.string(),
    clientId: zod.string(),
    clientName: zod.string(),
  })
  .required();
