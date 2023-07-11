import {
  ChronoUnit,
  DayOfWeek,
  LocalDate,
  TemporalAdjusters,
} from '@js-joda/core';
import {pipe} from 'fp-ts/function';
import * as TE from 'fp-ts/lib/TaskEither';
import {EmployeeId} from '../../domain/models/employee-registration/employee/EmployeeId';
import {EmploymentContractRepository} from '../../domain/models/employment-contract-management/employment-contract/EmploymentContractRepository';
import {EmploymentContract} from '../../domain/models/employment-contract-management/employment-contract/EmploymentContract';
import {WorkingPeriod} from '../../domain/models/time-card-computation/working-period/WorkingPeriod';
import {List} from 'immutable';

const {DAYS} = ChronoUnit;
const {MONDAY} = DayOfWeek;

type Params = {
  employeeId: EmployeeId;
  startDate: LocalDate;
  endDate: LocalDate;
};

const divideIntoPeriods = (
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

export const computeWorkingPeriods =
  (employmentContracts: EmploymentContractRepository) => (params: Params) =>
    pipe(
      TE.Do,
      TE.bind('params', () => TE.right(params)),
      TE.bind('contracts', ({params}) =>
        employmentContracts.lookupByEmployeeIdAndPeriod(
          params.employeeId,
          params.startDate,
          params.endDate
        )
      ),
      TE.bind('workingPeriods', ({contracts, params}) =>
        TE.right(
          contracts.flatMap(contract =>
            divideIntoPeriods(contract, params.startDate, params.endDate)
          )
        )
      ),
    );
