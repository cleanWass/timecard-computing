import { z } from 'zod';

export const modulationRequestSchema = z.object({
  silaeId: z.string().min(1),
  period: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

export type ModulationRequestDto = z.infer<typeof modulationRequestSchema>;
