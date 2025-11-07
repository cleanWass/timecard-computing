import { DayOfWeek } from '@js-joda/core';
import { List, Map } from 'immutable';
import { Employee } from '../../../models/employee-registration/employee/employee';
import { LocalTimeSlot } from '../../../models/local-time-slot';

export type DaySchedule = Map<DayOfWeek, List<{ timeslot: LocalTimeSlot }>>;

export type MatchScore = {
  totalCommon: number;
  totalBench: number;
  totalActiveShifts: number;
};

export type EmployeeMatch = {
  employee: Employee;
  score: MatchScore;
  percentage: number;
};

export type MatchCategory = 'match100' | 'match80' | 'match60' | 'match40' | 'match20';

export type CategorizedMatches = Map<MatchCategory, List<EmployeeMatch>>;
