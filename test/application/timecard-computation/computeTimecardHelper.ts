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
import {DayOfWeek, Duration, LocalDate, LocalDateTime, LocalTime} from '@js-joda/core';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';

import {List, Map, Set} from 'immutable';

const {MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY} = DayOfWeek;
const mondayToFriday = Set.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);
const mondayToSaturday = Set.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);

const weeklyPlanning28Hours = DayOfWeek.values()
  .reduce((acc, day) => acc.set(day, Set<LocalTimeSlot>()), Map<DayOfWeek, Set<LocalTimeSlot>>())
  .set(
    MONDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  )
  .set(
    TUESDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  )
  .set(
    WEDNESDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  )
  .set(
    THURSDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  )


const weeklyPlanning35Hours = DayOfWeek.values()
  .reduce((acc, day) => acc.set(day, Set<LocalTimeSlot>()), Map<DayOfWeek, Set<LocalTimeSlot>>())
  .set(
    MONDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  )
  .set(
    TUESDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  )
  .set(
    WEDNESDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  )
  .set(
    THURSDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  )
  .set(
    FRIDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  )

  .set(
    SATURDAY,
    Set([
      new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
      new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
    ])
  );

const OneWeekContract = EmploymentContract.build({
  id: 'contract-1-week',
  employeeId: 'gms',
  startDate: LocalDate.of(2023,1,2),
  endDate: O.some(LocalDate.of(2023,1,9)),
  overtimeAveragingPeriod: Duration.ofDays(7),
  weeklyNightShiftHours: Duration.ofHours(0),
  weeklyTotalWorkedHours: Duration.ofHours(24),
  workedDays: mondayToFriday,
  weeklyPlanning: weeklyPlanning28Hours,
});
const OneMonthContract = EmploymentContract.build({
  id: 'contract-1-month',
  employeeId: 'gms',
  startDate: LocalDate.parse('2023-01-10'),
  endDate: O.some(LocalDate.parse('2023-02-10')),
  overtimeAveragingPeriod: Duration.ofDays(7),
  weeklyNightShiftHours: Duration.ofHours(0),
  weeklyTotalWorkedHours: Duration.ofHours(35),
  workedDays: mondayToSaturday,
  weeklyPlanning: weeklyPlanning35Hours,
});

const IrrelevantContract = EmploymentContract.build({
  id: 'irrelevant-contract',
  employeeId: 'gms',
  startDate: LocalDate.parse('2023-05-10'),
  endDate: O.some(LocalDate.parse('2023-06-10')),
  overtimeAveragingPeriod: Duration.ofDays(7),
  weeklyNightShiftHours: Duration.ofHours(0),
  weeklyTotalWorkedHours: Duration.ofHours(35),
  workedDays: mondayToFriday,
  weeklyPlanning: DayOfWeek.values()
    .reduce((acc, day) => acc.set(day, Set<LocalTimeSlot>()), Map<DayOfWeek, Set<LocalTimeSlot>>())
    .set(
      MONDAY,
      Set([
        new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)),
        new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0)),
      ])
    ),
});

let id = 0;

export const buildShift = (clientId: ClientId, employeeId: EmployeeId) => (startTime: LocalDateTime, duration: Duration) => ({
  clientId,
  employeeId,
  id: `${id++}`,
  startTime,
  duration,
});

export const contracts = {OneMonthContract, OneWeekContract, IrrelevantContract};

export const planning = {weeklyPlanning35Hours, weeklyPlanning28Hours};