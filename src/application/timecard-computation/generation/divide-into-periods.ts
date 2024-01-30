import { ChronoUnit, DayOfWeek, LocalDate, TemporalAdjusters } from '@js-joda/core';
import { List } from 'immutable';
import { EmployeeId } from '../../../domain/models/employee-registration/employee/employee-id';
import { EmploymentContract } from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { EmploymentContractId } from '../../../domain/models/employment-contract-management/employment-contract/employment-contract-id';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { WorkingPeriod } from '../../../domain/models/time-card-computation/working-period/working-period';

const { DAYS } = ChronoUnit;
const { MONDAY } = DayOfWeek;

const makePeriod = (employeeId: EmployeeId, employmentContractId: EmploymentContractId) => (startDate: LocalDate, endDate: LocalDate) =>
  WorkingPeriod.build({
    employeeId,
    employmentContractId,
    period: new LocalDateRange(startDate, endDate),
  });

// const generateFirstPeriod = (startDate: , ) => {};

export const divideIntoPeriods = (
  { employeeId, id, overtimeAveragingPeriod }: EmploymentContract,
  startDate: LocalDate,
  endDate: LocalDate
) => {
  const makePeriodForContract = makePeriod(employeeId, id);
  const earliestMonday = startDate.with(TemporalAdjusters.nextOrSame(MONDAY));
  const lastMonday = endDate.with(TemporalAdjusters.previousOrSame(MONDAY));
  const overtimeAveragingPeriodInDays = overtimeAveragingPeriod.toDays();

  if (startDate.isBefore(earliestMonday) && endDate.minusDays(1).isBefore(earliestMonday))
    return List<WorkingPeriod>([makePeriodForContract(startDate, endDate)]);

  const numberOfPeriods = Math.max(earliestMonday.until(lastMonday, DAYS) / overtimeAveragingPeriodInDays, 0);
  const fullPeriods = Array.from(new Array(numberOfPeriods))
    .map((_, index) => earliestMonday.plusDays(index * overtimeAveragingPeriodInDays))
    .map(monday => makePeriodForContract(monday, monday.plusDays(overtimeAveragingPeriodInDays)));
  const firstPeriodPortion = startDate.isBefore(earliestMonday) ? [makePeriodForContract(startDate, earliestMonday)] : [];
  const lastPeriodPortion = endDate.isAfter(lastMonday) ? [makePeriodForContract(lastMonday, endDate)] : [];
  return List<WorkingPeriod>([...firstPeriodPortion, ...fullPeriods, ...lastPeriodPortion]);
};

export const divideContractsIntoPeriods = (contracts: List<EmploymentContract>, startDate: LocalDate, endDate: LocalDate) =>
  contracts.flatMap(ect => divideIntoPeriods(ect, startDate, endDate));
