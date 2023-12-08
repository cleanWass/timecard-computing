
import {pipe} from 'fp-ts/function';
import * as O from 'fp-ts/lib/Option';
import {List, Map, Set} from 'immutable';
import {DayOfWeek, Duration, LocalDate, LocalTime} from '@js-joda/core';
import { divideContractsIntoPeriods } from '../../../../src/application/timecard-computation/util/divideIntoPeriods';
import { EmployeeId } from '../../../../src/domain/models/employee-registration/employee/employee-id';
import {
  EmploymentContract
} from '../../../../src/domain/models/employment-contract-management/employment-contract/employment-contract';
import {
  EmploymentContractId
} from '../../../../src/domain/models/employment-contract-management/employment-contract/employment-contract-id';
import { LocalDateRange } from '../../../../src/domain/models/local-date-range';
import { LocalTimeSlot } from '../../../../src/domain/models/local-time-slot';
import { WorkingPeriod } from '../../../../src/domain/models/time-card-computation/working-period/WorkingPeriod';
import forceSome from '../../../~shared/util/forceSome';

const {MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY} = DayOfWeek;

const mondayToFriday = Set.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);

const consecutivePeriods =
  (employeeId: EmployeeId, employmentContractId: EmploymentContractId) =>
  (startDates: LocalDate[], endDate: LocalDate) =>
    List<LocalDate>(startDates).map((start, index) =>
      WorkingPeriod.build({
        employeeId,
        employmentContractId,
        period: new LocalDateRange(
          start,
          index === startDates.length - 1 ? endDate : startDates[index + 1]
        ),
      })
    );

const clone = (
  base: EmploymentContract,
  params?: Partial<Parameters<typeof EmploymentContract.build>[0]>
) =>
  EmploymentContract.build({
    id: params?.id ?? base.id,
    employeeId: params?.employeeId ?? base.employeeId,
    startDate: params?.startDate ?? base.startDate,
    endDate: params?.endDate ?? base.endDate,
    overtimeAveragingPeriod:
      params?.overtimeAveragingPeriod ?? base.overtimeAveragingPeriod,
    workedDays: params?.workedDays ?? base.workedDays,
    weeklyTotalWorkedHours:
      params?.weeklyTotalWorkedHours ?? base.weeklyTotalWorkedHours,
    weeklyNightShiftHours:
      params?.weeklyNightShiftHours ?? base.weeklyNightShiftHours,
    weeklyPlanning: params?.weeklyPlanning ?? base.weeklyPlanning,
  });

const _1WeekContract = EmploymentContract.build({
  id: 'contract-1-week',
  employeeId: 'gms',
  startDate: LocalDate.parse('2023-01-02'),
  endDate: O.some(LocalDate.parse('2023-01-09')),
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

describe('divideIntoPeriods', () => {
  describe('happy path', () => {
    let contractPeriods: ReturnType<typeof consecutivePeriods>;

    describe('limited-term contract', () => {
      beforeEach(() => {
        contractPeriods = consecutivePeriods(
          _1WeekContract.employeeId,
          _1WeekContract.id
        );
      });

      describe('one single 1-week contract from monday to monday', () => {
        it('returns a single 1-week period', () => {
          const actual = divideContractsIntoPeriods(
            List<EmploymentContract>([_1WeekContract]),
            _1WeekContract.startDate,
            forceSome(_1WeekContract.endDate)
          );
          const expected = contractPeriods(
            [_1WeekContract.startDate],
            forceSome(_1WeekContract.endDate)
          );
          expect(actual.equals(expected)).toBe(true);
        });
      });

      describe('one 10-day contract from monday to wednesday', () => {
        it('returns two periods (7, 3)', () => {
          const _10DaysContract = clone(_1WeekContract, {
            endDate: pipe(
              _1WeekContract.endDate,
              O.map(d => d.plusDays(3))
            ),
          });
          const actual = divideContractsIntoPeriods(
            List<EmploymentContract>([_10DaysContract]),
            _10DaysContract.startDate,
            forceSome(_10DaysContract.endDate)
          );
          const expected = contractPeriods(
            [_10DaysContract.startDate, forceSome(_1WeekContract.endDate)],
            forceSome(_10DaysContract.endDate)
          );
          expect(actual.equals(expected)).toBe(true);
        });
      });

      describe('one 11-day contract from thursday to monday', () => {
        it('returns two periods (4, 7)', () => {
          const _11DaysContract = clone(_1WeekContract, {
            startDate: _1WeekContract.startDate.minusDays(4),
          });
          const actual = divideContractsIntoPeriods(
            List<EmploymentContract>([_11DaysContract]),
            _11DaysContract.startDate,
            forceSome(_11DaysContract.endDate)
          );
          const expected = contractPeriods(
            [_11DaysContract.startDate, _1WeekContract.startDate],
            forceSome(_1WeekContract.endDate)
          );
          expect(actual.equals(expected)).toBe(true);
        });
      });

      describe('one 14-day contract from thursday to thursday', () => {
        it('returns three periods (4, 7, 3)', () => {
          const _14DaysContract = clone(_1WeekContract, {
            startDate: _1WeekContract.startDate.minusDays(4),
            endDate: pipe(
              _1WeekContract.endDate,
              O.map(d => d.plusDays(3))
            ),
          });
          const actual = divideContractsIntoPeriods(
            List<EmploymentContract>([_14DaysContract]),
            _14DaysContract.startDate,
            forceSome(_14DaysContract.endDate)
          );
          const expected = contractPeriods(
            [
              _14DaysContract.startDate,
              _1WeekContract.startDate,
              forceSome(_1WeekContract.endDate),
            ],
            forceSome(_14DaysContract.endDate)
          );
          expect(actual.equals(expected)).toBe(true);
        });
      });

      describe('one 28-day contract from thursday to thursday', () => {
        it('returns three periods (4, 7, 7, 7, 3)', () => {
          const _28DaysContract = clone(_1WeekContract, {
            startDate: _1WeekContract.startDate.minusDays(4),
            endDate: pipe(
              _1WeekContract.endDate,
              O.map(d => d.plusDays(14 + 3))
            ),
          });
          const actual = divideContractsIntoPeriods(
            List<EmploymentContract>([_28DaysContract]),
            _28DaysContract.startDate,
            forceSome(_28DaysContract.endDate)
          );
          const expected = contractPeriods(
            [
              _28DaysContract.startDate,
              _1WeekContract.startDate,
              _1WeekContract.startDate.plusWeeks(1),
              _1WeekContract.startDate.plusWeeks(2),
              _1WeekContract.startDate.plusWeeks(3),
            ],
            forceSome(_28DaysContract.endDate)
          );
          expect(actual.equals(expected)).toBe(true);
        });
      });
    });
  });
});
