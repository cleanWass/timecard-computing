import {EmployeeId} from '@domain/models/employee-registration/employee/EmployeeId';
import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/EmploymentContract';
import {EmploymentContractId} from '@domain/models/employment-contract-management/employment-contract/EmploymentContractId';
import {LocalDateRange} from '@domain/models/localDateRange';
import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';
import {
  ChronoUnit,
  DayOfWeek,
  LocalDate,
  TemporalAdjusters,
} from '@js-joda/core';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/function';
import {List} from 'immutable';

const {DAYS} = ChronoUnit;
const {MONDAY} = DayOfWeek;

const makePeriod =
  (employeeId: EmployeeId, employmentContractId: EmploymentContractId) =>
  (startDate: LocalDate, endDate: LocalDate) =>
    WorkingPeriod.build({
      employeeId,
      employmentContractId,
      period: new LocalDateRange(startDate, endDate),
    });

// const generateFirstPeriod = (startDate: , ) => {};

export const divideIntoPeriods = (
  {employeeId, id, overtimeAveragingPeriod}: EmploymentContract,
  startDate: LocalDate,
  endDate: LocalDate
) => {
  const makePeriodForEmployee = makePeriod(employeeId, id);
  const earliestMonday = startDate.with(TemporalAdjusters.nextOrSame(MONDAY));
  const lastMonday = endDate.with(TemporalAdjusters.previousOrSame(MONDAY));
  const overtimeAveragingPeriodInDays = overtimeAveragingPeriod.toDays();
  const numberOfPeriods =
    earliestMonday.until(lastMonday, DAYS) / overtimeAveragingPeriodInDays;
  const fullPeriods =
    numberOfPeriods <= 0
      ? E.left('')
      : E.right(
          List(new Array(numberOfPeriods))
            .map((_, index) =>
              earliestMonday.plusDays(index * overtimeAveragingPeriodInDays)
            )
            .map(monday =>
              makePeriodForEmployee(
                monday,
                monday.plusDays(overtimeAveragingPeriodInDays)
              )
            )
        );
  const firstPeriodPortion = startDate.isBefore(earliestMonday)
    ? E.right(makePeriodForEmployee(startDate, earliestMonday))
    : E.left('');
  const lastPeriodPortion = endDate.isAfter(lastMonday)
    ? E.right(makePeriodForEmployee(lastMonday, endDate))
    : E.left('');
  return pipe(
    firstPeriodPortion,
    E.map(fp => List<WorkingPeriod>().push(fp)),
    E.flatMap(wps =>
      pipe(
        fullPeriods,
        E.map(fps => wps.concat(fps))
      )
    ),
    E.flatMap(wps =>
      pipe(
        lastPeriodPortion,
        E.map(fps => wps.concat(fps))
      )
    )
  );
};

export const divideContractsIntoPeriods = (
  contracts: List<EmploymentContract>,
  startDate: LocalDate,
  endDate: LocalDate
) =>
  contracts
    .map(ect => divideIntoPeriods(ect, startDate, endDate))
    .filter(E.isRight).flatten()
