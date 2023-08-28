import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/EmploymentContract';
import {LocalDateRange} from '@domain/models/localDateRange';
import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';
import {
  ChronoUnit,
  DayOfWeek,
  LocalDate,
  TemporalAdjusters,
} from '@js-joda/core';
import {List} from 'immutable';

const {DAYS} = ChronoUnit;
const {MONDAY} = DayOfWeek;

export const divideIntoPeriods = (
  {employeeId, id, overtimeAveragingPeriod}: EmploymentContract,
  startDate: LocalDate,
  endDate: LocalDate
) => {
  const makePeriod = (startDate: LocalDate, endDate: LocalDate) =>
    WorkingPeriod.build({
      employeeId,
      employmentContractId: id,
      period: new LocalDateRange(startDate, endDate),
    });
  const earliestMonday = startDate.with(TemporalAdjusters.nextOrSame(MONDAY));
  const lastMonday = endDate.with(TemporalAdjusters.previousOrSame(MONDAY));
  const overtimeAveragingPeriodInDays = overtimeAveragingPeriod.toDays();
  const numberOfPeriods =
    earliestMonday.until(lastMonday, DAYS) / overtimeAveragingPeriodInDays;
  const fullPeriods = Array.from(new Array(numberOfPeriods))
    .map((_, index) =>
      earliestMonday.plusDays(index * overtimeAveragingPeriodInDays)
    )
    .map(monday =>
      makePeriod(monday, monday.plusDays(overtimeAveragingPeriodInDays))
    );
  const firstPeriodPortion = startDate.isBefore(earliestMonday)
    ? [makePeriod(startDate, earliestMonday)]
    : [];
  const lastPeriodPortion = endDate.isAfter(lastMonday)
    ? [makePeriod(lastMonday, endDate)]
    : [];
  return List<WorkingPeriod>([
    ...firstPeriodPortion,
    ...fullPeriods,
    ...lastPeriodPortion,
  ]);
};

export const divideContractsIntoPeriods = (
  contracts: List<EmploymentContract>,
  startDate: LocalDate,
  endDate: LocalDate
) => contracts.flatMap(ect => divideIntoPeriods(ect, startDate, endDate));
