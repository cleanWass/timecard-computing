import { z } from 'zod';
import { closedPeriodValidator, dayValidator } from '../../../validation/extern/temporals';
import { apiContractSchema } from './contract.schema';

export const apiPlanningSchema = z.record(
  dayValidator,
  z.array(
    z.object({
      startTime: z.string(),
      duration: z.string(),
    })
  )
);

export type ApiPlanning = z.infer<typeof apiPlanningSchema>;

export const apiScheduledContractSchema = z.object({
  type: z.enum(['Incumbent', 'OneOff', 'Handyman', 'Replacement']),
  contract: apiContractSchema,
  planning: apiPlanningSchema,
  period: closedPeriodValidator,
});

export type ApiScheduledContract = z.infer<typeof apiScheduledContractSchema>;
