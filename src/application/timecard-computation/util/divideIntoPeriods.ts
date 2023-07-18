import {List} from 'immutable';
import {
  ChronoUnit,
  DayOfWeek,
  LocalDate,
  TemporalAdjusters,
} from '@js-joda/core';
import {EmploymentContract} from '../../../domain/models/employment-contract-management/employment-contract/EmploymentContract';
import {WorkingPeriod} from '../../../domain/models/time-card-computation/working-period/WorkingPeriod';

const {DAYS} = ChronoUnit;
const {MONDAY} = DayOfWeek;

export default (
  {employeeId, id}: EmploymentContract,
  startDate: LocalDate,
  endDate: LocalDate
) => {
  const makePeriod = (start: LocalDate, end: LocalDate) =>
    new WorkingPeriod(employeeId, id, start, end);
  const earliestMonday = startDate.with(TemporalAdjusters.nextOrSame(MONDAY));
  const lastMonday = endDate.with(TemporalAdjusters.previousOrSame(MONDAY));
  const numberOfWeeks = earliestMonday.until(lastMonday, DAYS) / 7;
  const fullWeeks = Array.from(new Array(numberOfWeeks))
    .map(index => earliestMonday.plusDays(index * 7))
    .map(monday => makePeriod(monday, monday.plusWeeks(1)));
  const firstWeekPortion = startDate.isBefore(earliestMonday)
    ? [makePeriod(startDate, earliestMonday)]
    : [];
  const lastWeekPortion = endDate.isAfter(lastMonday)
    ? [makePeriod(lastMonday, endDate)]
    : [];
  return List<WorkingPeriod>([
    ...firstWeekPortion,
    ...fullWeeks,
    ...lastWeekPortion,
  ]);
};
