import {pipe} from 'fp-ts/function';
import * as O from 'fp-ts/lib/Option';
import {List, Set} from 'immutable';
import {DayOfWeek, Duration, LocalDate} from '@js-joda/core';

import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/EmploymentContract';
import {WorkingPeriod} from '@domain/models/time-card-computation/working-period/WorkingPeriod';
import divideIntoPeriods from '@application/timecard-computation/util/divideIntoPeriods';
import forceSome from '@test/~shared/util/forceSome';

const {MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY} = DayOfWeek;

const mondayToFriday = Set.of(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY);

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
});

describe('divideIntoPeriods', () => {
  describe('happy path', () => {
    describe('one single 1-week contract from monday to monday', () => {
      it('returns a single 1-week period', () => {
        const actual = divideIntoPeriods(
          List<EmploymentContract>([_1WeekContract]),
          _1WeekContract.startDate,
          forceSome(_1WeekContract.endDate)
        );
        const expected = List<WorkingPeriod>([
          WorkingPeriod.build({
            employeeId: _1WeekContract.employeeId,
            employmentContractId: _1WeekContract.id,
            startDate: _1WeekContract.startDate,
            endDate: forceSome(_1WeekContract.endDate),
          }),
        ]);
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
        const actual = divideIntoPeriods(
          List<EmploymentContract>([_10DaysContract]),
          _10DaysContract.startDate,
          forceSome(_10DaysContract.endDate)
        );
        const expected = List<WorkingPeriod>([
          WorkingPeriod.build({
            employeeId: _10DaysContract.employeeId,
            employmentContractId: _10DaysContract.id,
            startDate: _10DaysContract.startDate,
            endDate: forceSome(_1WeekContract.endDate),
          }),
          WorkingPeriod.build({
            employeeId: _10DaysContract.employeeId,
            employmentContractId: _10DaysContract.id,
            startDate: forceSome(_1WeekContract.endDate),
            endDate: forceSome(_10DaysContract.endDate),
          }),
        ]);
        expect(actual.equals(expected)).toBe(true);
      });
    });
  });
});
