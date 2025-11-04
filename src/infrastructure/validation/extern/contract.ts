import zod, { z } from 'zod';
import { CONTRACT_TYPE } from '../../../domain/models/employment-contract-management/employment-contract/contract-type';
import { periodValidator } from './temporals';

export const contractValidator = zod.object({
  id: zod.string(),
  initialId: zod.string().optional(),
  period: periodValidator,
  type: zod.enum(CONTRACT_TYPE),
  subType: zod.string().nullish(),
  weeklyHours: zod.string(),
  extraDuration: zod.string().nullish(),
  metadata: zod
    .object({
      contractualPlanning: zod
        .record(
          zod.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
          z.array(
            zod.object({
              start: zod.string(),
              end: zod.string(),
            })
          )
        )
        .optional(),
    })
    .optional(),
});

export type ContractValidatorType = zod.infer<typeof contractValidator>;
