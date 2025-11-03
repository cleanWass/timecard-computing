import { z } from 'zod';

export const payrollRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type PayrollRequestDto = z.infer<typeof payrollRequestSchema>;

export const downloadExportRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().min(1),
  fileLabel: z.string().min(1),
});

export type DownloadExportRequestDto = z.infer<typeof downloadExportRequestSchema>;
