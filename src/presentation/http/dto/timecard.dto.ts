import { z } from 'zod';

export const timecardRequestSchema = z.object({
  silaeId: z.string().min(1),
  period: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  prospectiveShifts: z.array(z.any()).default([]),
});

export type TimecardRequestDto = z.infer<typeof timecardRequestSchema>;
