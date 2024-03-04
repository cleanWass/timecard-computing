import zod from 'zod';

export const dayValidator = zod.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);

export const periodValidator = zod.object({
  start: zod.string(),
  end: zod.string().nullish(),
});

export const closedPeriodValidator = zod.object({
  start: zod.string(),
  end: zod.string(),
});

export type ClosedPeriodValidatorType = zod.infer<typeof closedPeriodValidator>;
