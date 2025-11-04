import { DayOfWeek, Duration, LocalDate } from '@js-joda/core';
import { Employee } from '../../models/employee-registration/employee/employee';
import { EmploymentContract } from '../../models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../models/local-date-range';
import { LocalTimeSlot } from '../../models/local-time-slot';
import { WorkingPeriodTimecard } from '../../models/timecard-computation/timecard/working-period-timecard';
import { Set } from 'immutable';

export type IntercontractResult = {
  period: LocalDateRange;
  processedEmployees: number;
  totalAffectationsCreated: number;
  details: ReadonlyArray<{
    employee: Employee;
    affectations: Set<BenchAffectation>;
  }>;
};

export type SlotToCreate = {
  employee: Employee;
  contract: EmploymentContract;
  slot: LocalTimeSlot;
  duration: Duration;
  date: LocalDate;
};

export type BenchAffectation = {
  employee: Employee;
  slot: LocalTimeSlot;
  duration: Duration;
  period: LocalDateRange;
  days: Set<DayOfWeek>;
};

export type AffectationContext = {
  timecard: WorkingPeriodTimecard;
  remainingDuration: Duration;
  currentDay: LocalDate;
  affectations: Set<SlotToCreate>;
};
