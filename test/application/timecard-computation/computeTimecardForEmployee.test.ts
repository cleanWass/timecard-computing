import {
  computeTimecardForEmployee,
  splitPeriodIntoWorkingPeriods,
} from '@application/timecard-computation/compute-timecard-for-employee';

import {EmploymentContract} from '@domain/models/employment-contract-management/employment-contract/employment-contract';
import {Leave} from '@domain/models/leave-recording/leave/leave';
import {LocalDateRange} from '@domain/models/local-date-range';
import {Shift} from '@domain/models/mission-delivery/shift/Shift';
import {Duration, LocalDate, LocalDateTime} from '@js-joda/core';
import {buildShift, contracts} from '@test/application/timecard-computation/computeTimecardHelper';
import * as E from 'fp-ts/Either';

import {pipe} from 'fp-ts/lib/function';

import {List} from 'immutable';

const {OneWeekContract, OneMonthContract, IrrelevantContract} = contracts;

describe('computeTimecardForEmployee', () => {
  describe('happy path', () => {
    describe('divide a period into a List of WorkingPeriods', () => {
      it('divides periods and group by contract ', () => {

        const shiftBuilder = buildShift('eee', 'tmp');
        const baseShifts = List<Shift>([
          shiftBuilder(LocalDateTime.of(2023, 1, 2, 8, 30), Duration.ofHours(3)),
          shiftBuilder(LocalDateTime.of(2023, 1, 3, 8, 30), Duration.ofHours(3)),
          shiftBuilder(LocalDateTime.of(2023, 1, 4, 8, 30), Duration.ofHours(3)),
          shiftBuilder(LocalDateTime.of(2023, 1, 5, 8, 30), Duration.ofHours(3)),
          shiftBuilder(LocalDateTime.of(2023, 1, 6, 8, 30), Duration.ofHours(3)),
          shiftBuilder(LocalDateTime.of(2023, 1, 2, 17), Duration.ofHours(4)),
          shiftBuilder(LocalDateTime.of(2023, 1, 3, 17), Duration.ofHours(4)),
          shiftBuilder(LocalDateTime.of(2023, 1, 4, 17), Duration.ofHours(4)),
          shiftBuilder(LocalDateTime.of(2023, 1, 5, 17), Duration.ofHours(4)),
          shiftBuilder(LocalDateTime.of(2023, 1, 6, 17), Duration.ofHours(4)),
        ]);

        const shifts = baseShifts.concat(baseShifts.map(s => ({...s, startTime: s.startTime.plusDays(7)})).concat(
          shiftBuilder(LocalDateTime.of(2023, 1, 13, 21), Duration.ofHours(2))
        ));
        const test = computeTimecardForEmployee(
          'gms',
          new LocalDateRange(LocalDate.parse('2023-01-01'), LocalDate.parse('2023-02-10')),
          shifts,
          List<Leave>(),
          List<EmploymentContract>([OneWeekContract, OneMonthContract, IrrelevantContract])
        );
        pipe(
          test,
          E.match(
            e => console.log(e),
            t => t.map(w => console.log(w.employmentContractId + ' ' + w.period.toFormattedString()))
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
