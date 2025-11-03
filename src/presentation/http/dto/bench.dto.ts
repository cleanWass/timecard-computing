import { z } from 'zod';

export const intercontractRequestSchema = z.object({
  startDate: z.string().regex(/^\d{2}\/\d{2}\/\d{2}$/), // dd/MM/yy
  endDate: z.string().regex(/^\d{2}\/\d{2}\/\d{2}$/),
});

export type IntercontractRequestDto = z.infer<typeof intercontractRequestSchema>;
