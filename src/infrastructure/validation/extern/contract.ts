import zod from 'zod';
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
        .string()
        .transform(v => JSON.parse(v))
        .optional(),
    })
    .optional(),
});

export type ContractValidatorType = zod.infer<typeof contractValidator>;
