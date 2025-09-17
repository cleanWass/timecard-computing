import { DayOfWeek, LocalDate, TemporalAdjusters } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { List, Map } from 'immutable';
import * as E from 'fp-ts/Either';
import { Employee } from '../../../domain/models/employee-registration/employee/employee';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WeeklyTimecardRecap } from '../../../domain/models/time-card-computation/weekly-timecard-recap/weekly-timecard-recap';

export const generateWeeklyTimecardRecap = (
  timecards: List<WorkingPeriodTimecard>,
  employee: Employee,
  period: LocalDateRange
) =>
  pipe(
    generateWeeksForPeriod(period),
    E.map(weeks =>
      weeks.reduce((res, week) => {
        const timecardsForWeek = timecards.filter(timecard => week.overlaps(timecard.workingPeriod.period));
        return res.set(
          week,
          WeeklyTimecardRecap.build({
            week,
            employee,
            workingPeriodTimecards: timecardsForWeek,
            workingPeriods: timecardsForWeek.map(tc => tc.workingPeriod),
            employmentContracts: timecardsForWeek.map(tc => tc.contract),
          })
        );
      }, Map<LocalDateRange, WeeklyTimecardRecap>())
    )
  );

export const generateWeeksForPeriod = ({ start, end }: LocalDateRange) => {
  const lowerBoundPeriodToCache = start.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
  const upperBoundPeriodToCache = end.with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));

  let weeks = List() as List<ReturnType<(typeof LocalDateRange)['of']>>;
  let currentMonday = lowerBoundPeriodToCache;
  while (currentMonday.isBefore(upperBoundPeriodToCache)) {
    weeks = weeks.concat(LocalDateRange.of(currentMonday, currentMonday.plusWeeks(1)));
    currentMonday = currentMonday.plusWeeks(1);
  }
  return pipe(weeks.toArray(), E.sequenceArray, E.map(List));
};
