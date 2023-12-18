import { DayOfWeek, Duration, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import * as O from 'fp-ts/Option';

import { List, Map, Set } from 'immutable';
import { Employee } from '../../../src/domain/models/employee-registration/employee/employee';
import { EmployeeId } from '../../../src/domain/models/employee-registration/employee/employee-id';
import { EmploymentContract } from '../../../src/domain/models/employment-contract-management/employment-contract/employment-contract';
import { LeavePeriod } from '../../../src/domain/models/leave-recording/leave/leave-period';
import { LocalTimeSlot } from '../../../src/domain/models/local-time-slot';
import { LocalDateRange } from '../../../src/domain/models/local-date-range';
import { Shift } from '../../../src/domain/models/mission-delivery/shift/shift';
import { ClientId } from '../../../src/domain/models/sales-contract-management/client/client-id';

const { MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY } = DayOfWeek;
const mondayToFriday = Set.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);
const mondayToSaturday = Set.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);

const weeklyPlanning28Hours = DayOfWeek.values()
  .reduce((acc, day) => acc.set(day, Set<LocalTimeSlot>()), Map<DayOfWeek, Set<LocalTimeSlot>>())
  .set(
    MONDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  )
  .set(
    TUESDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  )
  .set(
    WEDNESDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  )
  .set(
    THURSDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  );
const weeklyPlanning24Hours = DayOfWeek.values()
  .reduce((acc, day) => acc.set(day, Set<LocalTimeSlot>()), Map<DayOfWeek, Set<LocalTimeSlot>>())
  .set(MONDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(14))]))
  .set(TUESDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(14))]))
  .set(WEDNESDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(14))]))
  .set(THURSDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(14))]));

const weeklyPlanning35Hours = DayOfWeek.values()
  .reduce((acc, day) => acc.set(day, Set<LocalTimeSlot>()), Map<DayOfWeek, Set<LocalTimeSlot>>())
  .set(
    MONDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  )
  .set(
    TUESDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  )
  .set(
    WEDNESDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  )
  .set(
    THURSDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  )
  .set(
    FRIDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  )

  .set(
    SATURDAY,
    Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
  );

const OneWeekContract = EmploymentContract.build({
  id: 'contract-1-week',
  employeeId: 'gms',
  startDate: LocalDate.of(2023, 1, 2),
  endDate: O.some(LocalDate.of(2023, 1, 9)),
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
      Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(11, 30)), new LocalTimeSlot(LocalTime.of(17, 0), LocalTime.of(21, 0))])
    ),
});

let id = 0;

export const buildShift = (clientId: ClientId, employeeId: EmployeeId) => (startTime: LocalDateTime, duration: Duration) =>
  Shift.build({
    clientId,
    employeeId,
    id: `${id++}`,
    startTime,
    duration,
  });

export const contracts = { OneMonthContract, OneWeekContract, IrrelevantContract };

export const planning = { weeklyPlanning35Hours, weeklyPlanning28Hours };

export const cas1 = {
  contracts: List([
    EmploymentContract.build({
      id: 'contract-1-month',
      employeeId: 'Yves',
      startDate: LocalDate.of(2023, 11, 1),
      endDate: O.some(LocalDate.of(2023, 11, 30)),
      overtimeAveragingPeriod: Duration.ofDays(7),
      weeklyNightShiftHours: Duration.ofHours(0),
      weeklyTotalWorkedHours: Duration.ofHours(24),
      workedDays: Set([MONDAY, TUESDAY, WEDNESDAY, THURSDAY]),
      weeklyPlanning: weeklyPlanning24Hours,
    }),
  ]),
  shifts: List([
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 13, 8, 0), Duration.ofHours(6)),
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 14, 8, 0), Duration.ofHours(6)),
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 15, 8, 0), Duration.ofHours(6)),
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 16, 8, 0), Duration.ofHours(6)),
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 17, 8, 0), Duration.ofHours(2)),
  ]),
  leavePeriods: List([
    // LeavePeriod.build({
    //   id: '1',
    //   startTime: LocalTime.of(8),
    //   endTime: LocalTime.of(14),
    //   period: new LocalDateRange(LocalDate.of(2023, 11, 16), LocalDate.of(2023, 11, 16)),
    //   reason: 'Holiday',
    //   comment: O.none,
    // }),
  ]),
  employee: Employee.build({
    id: 'Yves',
    firstName: 'Yves',
    lastName: 'Martin',
    email: 'yves@martin.com',
    phoneNumber: '0600000000',
  }),
};
