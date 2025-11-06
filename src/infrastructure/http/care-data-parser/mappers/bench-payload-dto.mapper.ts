import { v4 as uuid } from 'uuid';
import { DayOfWeek, Duration, LocalDate } from '@js-joda/core';

import {
  BenchPayloadDto,
  durationToPgInterval,
} from '../../../../application/ports/repositories/bench-payload.dto';

import { BenchAffectation } from '../../../../domain/services/bench-generation/types';
import { toHoursFloat } from '../../../../~shared/util/joda-helper';

export const mapBenchToBenchPayloadDto = (bench: BenchAffectation): BenchPayloadDto => ({
  accountId: '0010Y00000Ijn8cQAB',
  accountName: 'Cleany - Intercontrat',
  silaeId: bench.employee.silaeId,
  catalogItemId: '01t0Y000001C4C7QAK',
  cleanerId: bench.employee.id,
  contractId: '8011n00000EiAx4AAF',
  duration: durationToPgInterval(bench.slot.duration()),
  endDate: bench.period.end.minusDays(1).toString(),
  endTime: bench.slot.endTime.toString(),
  prestationType: 'CLEANING',
  punctualReason: null,
  startDate: bench.period.start.toString(),
  startTime: bench.slot.startTime.toString(),
  totalDuration: toHoursFloat(
    bench.days.reduce(acc => acc.plus(bench.slot.duration()), Duration.ZERO)
  ),
  type: bench.isDuringLeavePeriod ? 'Absence' : 'Intercontrat',
  days: {
    monday: bench.days.includes(DayOfWeek.MONDAY),
    tuesday: bench.days.includes(DayOfWeek.TUESDAY),
    wednesday: bench.days.includes(DayOfWeek.WEDNESDAY),
    thursday: bench.days.includes(DayOfWeek.THURSDAY),
    friday: bench.days.includes(DayOfWeek.FRIDAY),
    saturday: bench.days.includes(DayOfWeek.SATURDAY),
    sunday: bench.days.includes(DayOfWeek.SUNDAY),
  },
});
