import * as E from 'fp-ts/Either';
import { Duration, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import { pipe } from 'fp-ts/function';

import { List } from 'immutable';
import * as O from 'fp-ts/Option';
import { getCuratedShifts } from '../../../src/application/timecard-computation/curation/curate-shifts-and-period';
import { Leave } from '../../../src/domain/models/leave-recording/leave/leave';
import { LocalDateRange } from '../../../src/domain/models/local-date-range';
import { LeavePeriod } from '../../../src/domain/models/leave-recording/leave/leave-period';
import { Shift } from '../../../src/domain/models/mission-delivery/shift/shift';
import { computeTimecardForEmployee } from '../../../src/application/timecard-computation/compute-timecard-for-employee';
import { cas1, contracts } from './computeTimecardHelper';

const { OneWeekContract, OneMonthContract, IrrelevantContract } = contracts;

describe('getCuratedShifts', () => {
  let shift = Shift.build({
    id: '1',
    duration: Duration.ofHours(8),
    startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    clientId: '',
    employeeId: '',
  });
  let leave = Leave.build({
    date: LocalDate.of(2023, 1, 1),
    startTime: LocalTime.of(9, 0),
    endTime: LocalTime.of(17, 0),
    duration: Duration.ofHours(8),

    absenceType: 'PAYED_LEAVE',
    compensation: 'PAID',
  });

  beforeEach(() => {
    shift = shift.with({
      duration: Duration.ofHours(8),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      date: LocalDate.of(2023, 1, 1),
      startTime: LocalTime.of(9, 0),

      endTime: LocalTime.of(17, 0),
      duration: Duration.ofHours(8),
    });
  });
  it('returns original shift when no overlap with leave', () => {
    const shiftExpected = shift.with({
      id: '1-before Leave 1',
      duration: Duration.ofHours(8),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      startTime: LocalTime.of(8, 0),
      endTime: LocalTime.of(18, 0),
      date: LocalDate.of(2023, 1, 2),
    });

    const result = getCuratedShifts(leave, shift);
    console.log(result.map(s => s.debug()).join('\n'));

    expect(result.size).toEqual(List([shift]).size);
  });

  it('returns split shifts when overlap with leave', () => {
    const shiftExpected = shift.with({
      id: '1-before Leave 1',
      duration: Duration.ofHours(8),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      date: LocalDate.of(2023, 1, 1),
      startTime: LocalTime.of(12, 0),
      endTime: LocalTime.of(14, 0),
      duration: Duration.ofHours(2),
    });

    const result = getCuratedShifts(leave, shift);
    console.log(result.map(s => s.debug()).join('\n'));
    expect(result.size).toEqual(2);
  });

  it('returns empty list when shift is entirely during leave', () => {
    const shiftExpected = shift.with({
      id: '1-before Leave 1',
      duration: Duration.ofHours(8),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      date: LocalDate.of(2023, 1, 1),
      startTime: LocalTime.of(8, 0),
      endTime: LocalTime.of(18, 0),
      duration: Duration.ofHours(10),
    });

    const result = getCuratedShifts(leave, shift);
    console.log(result.map(s => s.debug()).join('\n'));

    expect(result.size).toEqual(0);
  });

  it('returns truncated shift when leave overlaps start of shift ', () => {
    const shiftExpected = shift.with({
      id: '1-before Leave 1',
      duration: Duration.ofHours(8),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      date: LocalDate.of(2023, 1, 1),
      startTime: LocalTime.of(8, 0),
      endTime: LocalTime.of(12, 0),
      duration: Duration.ofHours(4),
    });

    const result = getCuratedShifts(leave, shift);
    console.log(result.map(s => s.debug()).join('\n'));

    expect(result.size).toEqual(1);
  });

  it('returns truncated shift when leave overlaps end of shift ', () => {
    const shiftExpected = shift.with({
      id: '1-before Leave 1',
      duration: Duration.ofHours(5),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      date: LocalDate.of(2023, 1, 1),
      startTime: LocalTime.of(14, 0),
      endTime: LocalTime.of(17, 0),
      duration: Duration.ofHours(3),
    });

    const result = getCuratedShifts(leave, shift);
    console.log(result.map(s => s.debug()).join('\n'));

    expect(result.size).toEqual(1);
  });
});
