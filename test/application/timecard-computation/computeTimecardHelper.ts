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

const { MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY } = DayOfWeek;
const mondayToFriday = Set.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);
const mondayToSaturday = Set.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);

const weeklyPlanning35Hours = DayOfWeek.values()
  .reduce((acc, day) => acc.set(day, Set<LocalTimeSlot>()), Map<DayOfWeek, Set<LocalTimeSlot>>())
  .set(MONDAY, Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(15, 30))]))
  .set(TUESDAY, Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(15, 30))]))
  .set(WEDNESDAY, Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(15, 30))]))
  .set(THURSDAY, Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(15, 30))]))
  .set(FRIDAY, Set([new LocalTimeSlot(LocalTime.of(8, 30), LocalTime.of(15, 30))]));

const OneWeekContract = EmploymentContract.build({
  id: 'contract-1-week',
  employeeId: 'gms',
  startDate: LocalDate.of(2023, 1, 2),
  endDate: O.some(LocalDate.of(2023, 1, 9)),
  overtimeAveragingPeriod: Duration.ofDays(7),
  weeklyNightShiftHours: Duration.ofHours(0),
  weeklyTotalWorkedHours: Duration.ofHours(24),
  workedDays: mondayToFriday,
  weeklyPlanning: weeklyPlanning35Hours,
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

const weeklyPlanning24Hours = DayOfWeek.values()
  .reduce((acc, day) => acc.set(day, Set<LocalTimeSlot>()), Map<DayOfWeek, Set<LocalTimeSlot>>())
  .set(MONDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(14))]))
  .set(TUESDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(14))]))
  .set(WEDNESDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(14))]))
  // .set(THURSDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(14))]))
  // .set(FRIDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(14))]))
  .set(SUNDAY, Set([new LocalTimeSlot(LocalTime.of(23, 59), LocalTime.of(23, 59))]));

const weeklyPlanning28Hours = DayOfWeek.values()
  .reduce((acc, day) => acc.set(day, Set<LocalTimeSlot>()), Map<DayOfWeek, Set<LocalTimeSlot>>())
  .set(TUESDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(15))]))
  .set(WEDNESDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(15))]))
  // .set(THURSDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(15))]))
  .set(FRIDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(15))]))
  .set(SUNDAY, Set([new LocalTimeSlot(LocalTime.of(8), LocalTime.of(15))]));

export const cas1 = {
  contracts: List([
    EmploymentContract.build({
      id: '24h',
      employeeId: 'Yves',
      startDate: LocalDate.of(2023, 11, 1),
      endDate: O.some(LocalDate.of(2023, 11, 15)),
      overtimeAveragingPeriod: Duration.ofDays(7),
      weeklyNightShiftHours: Duration.ofHours(0),
      weeklyTotalWorkedHours: Duration.ofHours(24),
      workedDays: Set([MONDAY, TUESDAY, WEDNESDAY, SUNDAY]),
      weeklyPlanning: weeklyPlanning24Hours,
      subType: 'complement_heure',
      extraDuration: Duration.ofHours(5),
    }),
    EmploymentContract.build({
      id: '35h',
      employeeId: 'Yves',
      startDate: LocalDate.of(2023, 11, 15),
      endDate: O.some(LocalDate.of(2023, 11, 30)),
      overtimeAveragingPeriod: Duration.ofDays(7),
      weeklyNightShiftHours: Duration.ofHours(0),
      weeklyTotalWorkedHours: Duration.ofHours(35),
      workedDays: Set([MONDAY, TUESDAY, WEDNESDAY, FRIDAY, SUNDAY]),
      weeklyPlanning: weeklyPlanning35Hours,
    }),
  ]),
  shifts: List([
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 13, 8, 0), Duration.ofHours(6)),
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 14, 8, 0), Duration.ofHours(8)),
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 15, 8, 0), Duration.ofHours(7)),
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 16, 8, 0), Duration.ofHours(7)),
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 17, 8, 0), Duration.ofHours(7)),
    // buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 18, 8, 0), Duration.ofHours(3)),
    buildShift('bic', 'Yves')(LocalDateTime.of(2023, 11, 19, 8, 0), Duration.ofHours(6)),
  ]),
  leavePeriods: List([
    // LeavePeriod.build({
    //   id: '1',
    //   startTime: LocalTime.of(8),
    //   endTime: LocalTime.of(20),
    //   period: new LocalDateRange(LocalDate.of(2023, 11, 16), LocalDate.of(2023, 11, 16)),
    //   reason: 'Holiday',
    //   comment: O.none,
    // }),
    // LeavePeriod.build({
    //   id: '2',
    //   startTime: LocalTime.of(0),
    //   endTime: LocalTime.of(23),
    //   period: new LocalDateRange(LocalDate.of(2023, 11, 17), LocalDate.of(2023, 11, 17)),
    //   reason: 'Unpaid',
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
export const planning = { weeklyPlanning35Hours, weeklyPlanning28Hours };
