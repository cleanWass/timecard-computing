import { Duration, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';

import { List } from 'immutable';
import * as O from 'fp-ts/Option';
import { LocalDateRange } from '../../../src/domain/models/local-date-range';
import { Leave } from '../../../src/domain/models/leave-recording/leave/leave';
import { Shift } from '../../../src/domain/models/mission-delivery/shift/shift';
import { getCuratedShifts } from '../../../src/application/timecard-computation/compute-timecard-for-employee';
import { contracts } from './computeTimecardHelper';

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
    id: '1',
    period: new LocalDateRange(LocalDate.of(2023, 1, 1), LocalDate.of(2023, 1, 1)),
    comment: O.some('eee'),
    endTime: LocalTime.of(17, 0),
    reason: 'Paid',
    startTime: LocalTime.of(9, 0),
  });

  beforeEach(() => {
    shift = shift.with({
      duration: Duration.ofHours(8),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      period: new LocalDateRange(LocalDate.of(2023, 1, 1), LocalDate.of(2023, 1, 1)),
      endTime: LocalTime.of(17, 0),
      startTime: LocalTime.of(9, 0),
    });
  });
  it('returns original shift when no overlap with leave', () => {
    const shiftExpected = shift.with({
      id: '1-before Leave 1',
      duration: Duration.ofHours(8),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      id: '1',
      startTime: LocalTime.of(8, 0),
      endTime: LocalTime.of(18, 0),
      period: new LocalDateRange(LocalDate.of(2023, 1, 2), LocalDate.of(2023, 1, 2)),
    });

    const result = getCuratedShifts(leave, shift);
    expect(result.size).toEqual(List([shift]).size);
  });

  it('returns split shifts when overlap with leave', () => {
    const shiftExpected = shift.with({
      id: '1-before Leave 1',
      duration: Duration.ofHours(8),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      id: '1',
      startTime: LocalTime.of(12, 0),
      endTime: LocalTime.of(14, 0),
    });

    const result = getCuratedShifts(leave, shift);
    expect(result.size).toEqual(2);
    // console.log(result.map(s => s.debugFormat()).join('\n'));
  });

  it('returns empty list when shift is entirely during leave', () => {
    const shiftExpected = shift.with({
      id: '1-before Leave 1',
      duration: Duration.ofHours(8),
      startTime: LocalDateTime.of(2023, 1, 1, 9, 0),
    });
    leave = leave.with({
      id: '1',
      startTime: LocalTime.of(8, 0),
      endTime: LocalTime.of(18, 0),
    });

    const result = getCuratedShifts(leave, shift);
    expect(result.size).toEqual(0);
  });
});
