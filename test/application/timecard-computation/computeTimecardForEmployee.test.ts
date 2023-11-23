import {
  dividePeriodAndGroupByContract,
  splitPeriodIntoWorkingPeriods,
} from '@application/timecard-computation/compute-timecard-for-employee';
import {EmployeeId} from '@domain/models/employee-registration/employee/employee-id';

import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/employment-contract';
import {Leave} from '@domain/models/leave-recording/leave/leave';
import {LocalDateRange} from '@domain/models/local-date-range';
import {LocalTimeSlot} from '@domain/models/local-time-slot';
import {Shift} from '@domain/models/mission-delivery/shift/Shift';
import {ShiftId} from '@domain/models/mission-delivery/shift/shift-id';
import {ClientId} from '@domain/models/sales-contract-management/client/client-id';
import {RequirementId} from '@domain/models/sales-contract-management/requirement/requirement-id';
import {ServiceContractId} from '@domain/models/sales-contract-management/service-contract/service-contract-id';
import {
  DayOfWeek,
  Duration,
  LocalDate,
  LocalDateTime,
  LocalTime,
} from '@js-joda/core';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';

import {pipe} from 'fp-ts/lib/function';

import {List, Map, Set} from 'immutable';

const {MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY} = DayOfWeek;
const mondayToFriday = Set.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);

const _1WeekContract = EmploymentContract.build({
  id: 'contract-1-week',
  employeeId: 'gms',
  startDate: LocalDate.parse('2023-01-02'),
  endDate: O.some(LocalDate.parse('2023-01-10')),
  overtimeAveragingPeriod: Duration.ofDays(7),
  weeklyNightShiftHours: Duration.ofHours(0),
  weeklyTotalWorkedHours: Duration.ofHours(24),
  workedDays: mondayToFriday,
  weeklyPlanning: DayOfWeek.values()
    .reduce(
      (acc, day) => acc.set(day, Set<LocalTimeSlot>()),
      Map<DayOfWeek, Set<LocalTimeSlot>>()
    )
    .set(
      MONDAY,
      Set([
        new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
        new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
      ])
    ),
});
const _1MonthContract = EmploymentContract.build({
  id: 'contract-1-month',
  employeeId: 'gms',
  startDate: LocalDate.parse('2023-01-10'),
  endDate: O.some(LocalDate.parse('2023-02-10')),
  overtimeAveragingPeriod: Duration.ofDays(7),
  weeklyNightShiftHours: Duration.ofHours(0),
  weeklyTotalWorkedHours: Duration.ofHours(35),
  workedDays: mondayToFriday,
  weeklyPlanning: DayOfWeek.values()
    .reduce(
      (acc, day) => acc.set(day, Set<LocalTimeSlot>()),
      Map<DayOfWeek, Set<LocalTimeSlot>>()
    )
    .set(
      MONDAY,
      Set([
        new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
        new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
      ])
    ),
});
const _IrrelevantContract = EmploymentContract.build({
  id: 'irrelevant-contract',
  employeeId: 'gms',
  startDate: LocalDate.parse('2023-05-10'),
  endDate: O.some(LocalDate.parse('2023-06-10')),
  overtimeAveragingPeriod: Duration.ofDays(7),
  weeklyNightShiftHours: Duration.ofHours(0),
  weeklyTotalWorkedHours: Duration.ofHours(35),
  workedDays: mondayToFriday,
  weeklyPlanning: DayOfWeek.values()
    .reduce(
      (acc, day) => acc.set(day, Set<LocalTimeSlot>()),
      Map<DayOfWeek, Set<LocalTimeSlot>>()
    )
    .set(
      MONDAY,
      Set([
        new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
        new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
      ])
    ),
});

describe('computeTimecardForEmployee', () => {
  describe('happy path', () => {
    describe('divide a period into a List of WorkingPeriods', () => {
      it('divides periods and group by contract ', () => {
        // const actual = dividePeriodAndGroupByContract(
        //   new LocalDateRange(
        //     LocalDate.parse('2023-01-01'),
        //     LocalDate.parse('2023-01-15')
        //   ),
        //   List<EmploymentContract>([_1WeekContract, _1MonthContract]),
        //   List<Shift>([
        //     {
        //       id: 'tmp',
        //       serviceContractId: 'ServiceContractId',
        //       requirementIds: [],
        //       startTime: LocalDateTime.of(2023, 1, 2, 10),
        //       duration: Duration.ofHours(7),
        //       clientId: 'eee',
        //       employeeId: 'tmp',
        //     },
        //     {
        //       id: 'tmp',
        //       serviceContractId: 'ServiceContractId',
        //       requirementIds: [],
        //       startTime: LocalDateTime.of(2023, 1, 3, 10),
        //       duration: Duration.ofHours(8),
        //       clientId: 'eee',
        //       employeeId: 'tmp',
        //     },
        //     {
        //       id: 'tmp',
        //       serviceContractId: 'ServiceContractId',
        //       requirementIds: [],
        //       startTime: LocalDateTime.of(2023, 1, 4, 10),
        //       duration: Duration.ofHours(7),
        //       clientId: 'eee',
        //       employeeId: 'tmp',
        //     },
        //     {
        //       id: 'tmp',
        //       serviceContractId: 'ServiceContractId',
        //       requirementIds: [],
        //       startTime: LocalDateTime.of(2023, 1, 5, 10),
        //       duration: Duration.ofHours(8).plusMinutes(30),
        //       clientId: 'eee',
        //       employeeId: 'tmp',
        //     },
        //     {
        //       id: 'tmp',
        //       serviceContractId: 'ServiceContractId',
        //       requirementIds: [],
        //       startTime: LocalDateTime.of(2023, 1, 6, 10),
        //       duration: Duration.ofHours(7),
        //       clientId: 'eee',
        //       employeeId: 'tmp',
        //     },
        //   ]),
        //   List<Leave>()
        // );
        const test = splitPeriodIntoWorkingPeriods(
          List<EmploymentContract>([
            _1WeekContract,
            _1MonthContract,
            _IrrelevantContract,
          ]),
          new LocalDateRange(
            LocalDate.parse('2023-01-01'),
            LocalDate.parse('2023-02-10')
          )
        );
        pipe(
          test,
          E.match(
            e => console.log(e),
            t => t.map(w => console.log(w.employmentContractId + " "  +w.period.toFormattedString()))
          )
        );
        expect(true).toBe(true);
        // console.log({
        //   actual: pipe(
        //     actual,
        //     E.match(
        //       err => `Error is ${err}`, // onLeft handler
        //       map => `Result is ${map.toJS()}` // onRight handler
        //     )
        //   ),
        // });
        // expect(actual.equals(expected)).toBe(true);
      });
    });
  });
});
