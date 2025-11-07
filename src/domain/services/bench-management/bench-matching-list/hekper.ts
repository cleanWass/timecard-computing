import { DateTimeFormatter, DayOfWeek } from '@js-joda/core';
import * as TE from 'fp-ts/TaskEither';
import { List, Map, Set } from 'immutable';
import { Employee } from '../../../models/employee-registration/employee/employee';
import { LocalDateRange } from '../../../models/local-date-range';
import { LocalTimeSlot } from '../../../models/local-time-slot';
import { Shift } from '../../../models/mission-delivery/shift/shift';
import { WeeklyTimecardRecap } from '../../../models/timecard-computation/weekly-timecard-recap/weekly-timecard-recap';
import { CategorizedMatches, DaySchedule, EmployeeMatch, MatchCategory, MatchScore } from './types';

export type MakeGenerateMatchingBenchesListUseCase = {
  execute: (params: { period: LocalDateRange }) => TE.TaskEither<Error, string>;
};

export const TIME_FORMAT = DateTimeFormatter.ofPattern('HH:mm');

export const CATEGORY_LABELS: Record<MatchCategory, string> = {
  match100: 'match100 (100%)',
  match80: 'match80 (80-99%)',
  match60: 'match60 (60-79%)',
  match40: 'match40 (40-59%)',
  match20: 'match20 (20-39%)',
};

export const formatTimeSlot = (item: { timeslot: LocalTimeSlot }): string =>
  `${item.timeslot.startTime.format(TIME_FORMAT)} - ${item.timeslot.endTime.format(TIME_FORMAT)}`;

export const formatDaySchedule = (schedule: DaySchedule, day: DayOfWeek): string => {
  return schedule.get(day)?.map(formatTimeSlot).join(',') ?? '';
};

export const computeMinutesSet = (items: List<{ timeslot: LocalTimeSlot }>): Set<number> => {
  return items.reduce((acc, item) => acc.union(item.timeslot.toMinutesOfDay()), Set<number>());
};

export const calculateMatchScore = (
  benchSchedule: DaySchedule,
  shiftSchedule: Map<DayOfWeek, List<Shift>>
): Map<DayOfWeek, MatchScore> => {
  return benchSchedule.map((benches, day) => {
    const benchMinutes = computeMinutesSet(benches);
    const shiftMinutes = computeMinutesSet(
      shiftSchedule.get(day, List<Shift>()).map(shift => ({ timeslot: shift.getTimeSlot() }))
    );

    return {
      totalCommon: benchMinutes.intersect(shiftMinutes).size,
      totalBench: benchMinutes.size,
      totalActiveShifts: shiftMinutes.size,
    };
  });
};

export const aggregateMatchScore = (dayScores: Map<DayOfWeek, MatchScore>): MatchScore => {
  return dayScores.reduce(
    (acc, score) => ({
      totalCommon: acc.totalCommon + score.totalCommon,
      totalBench: acc.totalBench + score.totalBench,
      totalActiveShifts: acc.totalActiveShifts + score.totalActiveShifts,
    }),
    { totalCommon: 0, totalBench: 0, totalActiveShifts: 0 }
  );
};

export const calculateMatchPercentage = (score: MatchScore): number => {
  return score.totalBench > 0 ? (score.totalCommon / score.totalBench) * 100 : 0;
};

export const getMatchCategory = (percentage: number): MatchCategory => {
  if (percentage === 100) return 'match100';
  if (percentage >= 80) return 'match80';
  if (percentage >= 60) return 'match60';
  if (percentage >= 40) return 'match40';
  return 'match20';
};

export const findBestMatches = (
  benchSchedule: DaySchedule,
  activeEmployeesRecaps: List<WeeklyTimecardRecap>
): List<EmployeeMatch> => {
  return activeEmployeesRecaps
    .map(activeRecap => {
      const shiftSchedule = activeRecap.workingPeriodTimecards
        .flatMap(tc => tc.shifts)
        .groupBy((shift: Shift) => shift.startTime.toLocalDate().dayOfWeek());

      const dayScores = calculateMatchScore(benchSchedule, shiftSchedule);
      const aggregatedScore = aggregateMatchScore(dayScores);
      const percentage = calculateMatchPercentage(aggregatedScore);

      return {
        employee: activeRecap.employee,
        score: aggregatedScore,
        percentage,
      };
    })
    .sortBy(match => -match.percentage)
    .filter(match => match.percentage >= 20);
};

export const categorizeMatches = (matches: List<EmployeeMatch>): CategorizedMatches => {
  return matches.reduce((acc, match) => {
    const category = getMatchCategory(match.percentage);
    return acc.update(category, List<EmployeeMatch>(), list => list.push(match));
  }, Map<MatchCategory, List<EmployeeMatch>>());
};

export const formatEmployeeMatch = (match: EmployeeMatch): string => {
  const { employee, percentage } = match;
  return `${employee.silaeId} - ${employee.firstName} ${employee.lastName} - ${percentage.toFixed(
    2
  )}%`;
};

export const formatCategoryMatches = (
  categorizedMatches: CategorizedMatches,
  category: MatchCategory
): string => {
  const label = CATEGORY_LABELS[category];
  const matches = categorizedMatches.get(category, List<EmployeeMatch>());

  if (matches.isEmpty()) {
    return ``;
  }

  return `${matches.map(formatEmployeeMatch).join('|')}`;
};

export const generateCsvLine = (
  benchedEmployee: Employee,
  benchSchedule: DaySchedule,
  categorizedMatches: CategorizedMatches
): string => {
  const days = DayOfWeek.values()
    .map(day => formatDaySchedule(benchSchedule, day))
    .join(',');

  const match100 = formatCategoryMatches(categorizedMatches, 'match100');
  const match80 = formatCategoryMatches(categorizedMatches, 'match80');
  const match60 = formatCategoryMatches(categorizedMatches, 'match60');
  const match40 = formatCategoryMatches(categorizedMatches, 'match40');
  const match20 = formatCategoryMatches(categorizedMatches, 'match20');

  return `${benchedEmployee.silaeId},${benchedEmployee.lastName},${benchedEmployee.firstName},${days},${match100},${match80},${match60},${match40},${match20},`;
};
