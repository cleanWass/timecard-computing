import zod from 'zod';

export const shiftValidator = zod
  .object({
    id: zod.string(),
    date: zod.string().min(1),
    type: zod.string(),
    startTime: zod.string(),
    duration: zod.string(),
    clientId: zod.string(),
    clientName: zod.string(),
  })
  .required();
