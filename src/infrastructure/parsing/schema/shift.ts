import zod from 'zod';

export const shiftValidator = zod
  .object({
    date: zod.string().min(1),
    startTime: zod.string(),
    duration: zod.string(),
  })
  .required();
