import { DateTimeFormatter, DayOfWeek } from '@js-joda/core';
import { List, Map, Set } from 'immutable';
import { Employee } from '../../../models/employee-registration/employee/employee';
import { LocalTimeSlot } from '../../../models/local-time-slot';
import { Shift } from '../../../models/mission-delivery/shift/shift';
import { WeeklyTimecardRecap } from '../../../models/timecard-computation/weekly-timecard-recap/weekly-timecard-recap';
import { DaySchedule, EmployeeMatch, MatchScore } from './types';

export const TIME_FORMAT = DateTimeFormatter.ofPattern('HH:mm');

export const formatTimeSlot = (item: { timeslot: LocalTimeSlot }): string =>
  `${item.timeslot.startTime.format(TIME_FORMAT)} - ${item.timeslot.endTime.format(TIME_FORMAT)}`;

export const formatDaySchedule = (schedule: DaySchedule, day: DayOfWeek): string => {
  return schedule.get(day)?.map(formatTimeSlot).join(' ') ?? '';
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

export const formatEmployeeMatch = (match: EmployeeMatch): string => {
  const { employee, percentage } = match;
  return `${employee.silaeId} - ${employee.firstName} ${employee.lastName} - ${percentage.toFixed(
    2
  )}%`;
};

export const formatMatches = (matches: List<EmployeeMatch>) => {
  return matches
    .valueSeq()
    .sort((a, b) => b.percentage - a.percentage)
    .map(formatEmployeeMatch)
    .join(',');
};

export const generateCsvLine = (
  benchedEmployee: Employee,
  benchSchedule: DaySchedule,
  matches: List<EmployeeMatch>
): string => {
  const days = DayOfWeek.values()
    .map(day => formatDaySchedule(benchSchedule, day))
    .join(',');

  // return `${benchedEmployee.silaeId},${benchedEmployee.lastName},${benchedEmployee.firstName},${days},${match100},${match80},${match60},${match40},${match20},`;
  return `${benchedEmployee.silaeId},${benchedEmployee.lastName},${
    benchedEmployee.firstName
  },${days},${formatMatches(matches.filter(m => m.score.totalCommon >= 50))}`;
};
