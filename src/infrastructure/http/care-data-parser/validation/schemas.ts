import { LocalDate } from '@js-joda/core';
import zod, { z } from 'zod';
import { EMPLOYEE_ROLE } from '../../../../domain/models/employee-registration/employee/employee-role';
import { LEAVE_REASON } from '../../../../domain/models/leave-recording/leave/leave-retribution';
import { SHIFT_REASON } from '../../../../domain/models/mission-delivery/shift/shift-reason';
import { apiScheduledContractSchema } from './scheduled-contract.schema';

export const apiEmployeeSchema = z.object({
  id: zod.string(),
  silaeId: zod.string(),
  firstName: zod.string(),
  lastName: zod.string(),
  role: zod.enum(EMPLOYEE_ROLE),
  seniorityDate: zod.string(),
  email: zod.string().optional(),
  phoneNumber: zod.string().optional(),
  managerId: zod.string().optional(),
  managerName: zod.string().optional(),
  address: zod
    .object({
      street: zod.string(),
      postalCode: zod.string(),
      city: zod.string(),
    })
    .optional(),
  availabilityPlanning: zod
    .record(
      zod.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
      z.array(
        zod.object({
          start: zod.string(),
          end: zod.string(),
        })
      )
    )
    .optional(),
  generateIntercontract: zod.boolean().optional(),
});

export type ApiEmployee = z.infer<typeof apiEmployeeSchema>;

export const apiShiftSchema = z.object({
  id: zod.string().nullish(),
  date: zod.string().min(1),
  type: zod.enum(SHIFT_REASON),
  startTime: zod.string(),
  duration: zod.string(),
  clientId: zod.string().nullish(),
  clientName: zod.string().nullish(),
  parentAffectationId: zod.string().nullish(),
  precedenceDate: zod.string().nullish(),
});

export type ApiShift = z.infer<typeof apiShiftSchema>;

export const apiLeaveSchema = z.object({
  id: zod.string().min(1),
  silaeId: zod.string().min(1),
  clientId: zod.string(),
  clientName: zod.string(),
  date: zod.string().min(1),
  // date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: zod.string().min(1),
  // start_time: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: zod.string().min(1),
  // end_time: z.string().regex(/^\d{2}:\d{2}$/),
  duration: zod.string(),
  absenceType: zod.enum(LEAVE_REASON),
});

export type ApiLeave = z.infer<typeof apiLeaveSchema>;

export const apiLeavePeriodsSchema = z.object({
  id: zod.string().min(1),
  startTime: zod.string().nullish(),
  endTime: zod.string().nullish(),
  period: zod.object({
    start: zod.string(),
    end: zod.string().optional().default(LocalDate.MAX.toString()),
  }),
  employeeId: zod.string(),
  silaeId: zod.string(),
  absenceType: zod.enum(LEAVE_REASON),
});

export type ApiLeavePeriods = z.infer<typeof apiLeavePeriodsSchema>;

export const apiEmployeeDataSchema = z.object({
  cleaner: apiEmployeeSchema,
  shifts: z.array(apiShiftSchema),
  plannings: z.array(apiScheduledContractSchema),
  leaves: z.array(apiLeaveSchema),
  leavePeriods: z.array(apiLeavePeriodsSchema).optional().default([]),
});

export type ApiEmployeeData = z.infer<typeof apiEmployeeDataSchema>;

export const apiIntercontractEmployeesSchema = z.object({
  silae_ids: z.array(z.string().min(1)),
  period: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});
