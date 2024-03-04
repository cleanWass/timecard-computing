import zod from 'zod';
import { contractValidator } from './contract';
import { closedPeriodValidator, dayValidator } from './temporals';

export const planningValidator = zod.record(
  dayValidator,
  zod.array(
    zod.object({
      startTime: zod.string(),
      duration: zod.string(),
    })
  )
);

export type PlanningValidatorType = zod.infer<typeof planningValidator>;

export const contractPlanningValidator = zod.object({
  contract: contractValidator,
  planning: planningValidator,
  period: closedPeriodValidator,
});
