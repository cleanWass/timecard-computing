import { DateTimeFormatter, DayOfWeek } from '@js-joda/core';
import { flow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { List, Map, Set } from 'immutable';
import { Employee } from '../../../domain/models/employee-registration/employee/employee';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { WeeklyTimecardRecap } from '../../../domain/models/timecard-computation/weekly-timecard-recap/weekly-timecard-recap';
import { CareDataParserClient } from '../../ports/services/care-data-parser-client';
import { computeTimecardForEmployee } from '../../timecard-computation/compute-timecard-for-employee';

const compact = <T>(arr: (T | null | undefined)[]): T[] => arr.filter((v): v is T => v != null);

type DaySchedule = Map<DayOfWeek, List<{ timeslot: LocalTimeSlot }>>;

type MatchScore = {
  totalCommon: number;
  totalBench: number;
  totalActiveShifts: number;
};

type EmployeeMatch = {
  employee: Employee;
  score: MatchScore;
  percentage: number;
};

type MatchCategory = 'match100' | 'match80' | 'match60' | 'match40' | 'match20';

type CategorizedMatches = Map<MatchCategory, List<EmployeeMatch>>;

export type MakeGenerateMatchingBenchesListUseCase = {
  execute: (params: { period: LocalDateRange }) => TE.TaskEither<Error, string>;
};

const TIME_FORMAT = DateTimeFormatter.ofPattern('HH:mm');

const CATEGORY_LABELS: Record<MatchCategory, string> = {
  match100: 'match100 (100%)',
  match80: 'match80 (80-99%)',
  match60: 'match60 (60-79%)',
  match40: 'match40 (40-59%)',
  match20: 'match20 (20-39%)',
};

// Helpers
const formatTimeSlot = (item: { timeslot: LocalTimeSlot }): string =>
  `${item.timeslot.startTime.format(TIME_FORMAT)} - ${item.timeslot.endTime.format(TIME_FORMAT)}`;

const formatDaySchedule = (schedule: DaySchedule, day: DayOfWeek): string => {
  return schedule.get(day)?.map(formatTimeSlot).join(',') ?? '';
};

const computeMinutesSet = (items: List<{ timeslot: LocalTimeSlot }>): Set<number> => {
  return items.reduce((acc, item) => acc.union(item.timeslot.toMinutesOfDay()), Set<number>());
};

const calculateMatchScore = (
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

const aggregateMatchScore = (dayScores: Map<DayOfWeek, MatchScore>): MatchScore => {
  return dayScores.reduce(
    (acc, score) => ({
      totalCommon: acc.totalCommon + score.totalCommon,
      totalBench: acc.totalBench + score.totalBench,
      totalActiveShifts: acc.totalActiveShifts + score.totalActiveShifts,
    }),
    { totalCommon: 0, totalBench: 0, totalActiveShifts: 0 }
  );
};

const calculateMatchPercentage = (score: MatchScore): number => {
  return score.totalBench > 0 ? (score.totalCommon / score.totalBench) * 100 : 0;
};

const getMatchCategory = (percentage: number): MatchCategory => {
  if (percentage === 100) return 'match100';
  if (percentage >= 80) return 'match80';
  if (percentage >= 60) return 'match60';
  if (percentage >= 40) return 'match40';
  return 'match20';
};

const findBestMatches = (
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

const categorizeMatches = (matches: List<EmployeeMatch>): CategorizedMatches => {
  return matches.reduce((acc, match) => {
    const category = getMatchCategory(match.percentage);
    return acc.update(category, List<EmployeeMatch>(), list => list.push(match));
  }, Map<MatchCategory, List<EmployeeMatch>>());
};

const formatEmployeeMatch = (match: EmployeeMatch): string => {
  const { employee, percentage } = match;
  return `${employee.silaeId} - ${employee.firstName} ${employee.lastName} - ${percentage.toFixed(
    2
  )}%`;
};

const formatCategoryMatches = (
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

const generateCsvLine = (
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

export const makeGenerateMatchingBenchesListUseCase = (
  careDataParserClient: CareDataParserClient
): MakeGenerateMatchingBenchesListUseCase => ({
  execute: ({ period }) =>
    pipe(
      TE.Do,
      TE.bind('benchedEmployees', () =>
        careDataParserClient.getEmployeesWithBenchGeneration(period)
      ),
      TE.bind('benchedTimecards', ({ benchedEmployees }) =>
        pipe(
          benchedEmployees,
          TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither))
        )
      ),
      TE.bind('activeEmployees', ({ benchedEmployees }) =>
        pipe(
          careDataParserClient.getAllActiveEmployeesData(period),
          TE.map(allActive => {
            const benchedIds = Set(benchedEmployees.map(e => e.employee.silaeId));
            return allActive.filter(e => !benchedIds.has(e.employee.silaeId));
          })
        )
      ),
      TE.bind('activeTimecards', ({ activeEmployees }) =>
        pipe(
          activeEmployees,
          TE.traverseArray(flow(computeTimecardForEmployee(period), TE.fromEither))
        )
      ),
      TE.bind('weeks', () => TE.of(period.divideIntoCalendarWeeks())),
      TE.map(({ weeks, benchedTimecards, activeTimecards }) => {
        return weeks
          .map(week => {
            const benchedRecaps = List(
              compact(
                benchedTimecards.map(data =>
                  data.weeklyRecaps.find(recap => recap.week.equals(week))
                )
              )
            );

            const activeRecaps = List(
              compact(
                activeTimecards.map(data =>
                  data.weeklyRecaps.find(recap => recap.week.equals(week))
                )
              )
            );

            return benchedRecaps
              .map(benchedRecap => {
                const benchSchedule = benchedRecap.workingPeriodTimecards
                  .flatMap(tc => tc.benches)
                  .groupBy(b => b.date.dayOfWeek());

                const matches = findBestMatches(benchSchedule, activeRecaps);

                const categorizedMatches = categorizeMatches(matches);

                return generateCsvLine(benchedRecap.employee, benchSchedule, categorizedMatches);
              })
              .join('\n');
          })
          .join('\n');
      }),

      TE.chainFirst(result => TE.fromIO(() => console.log(result)))
    ),
});
