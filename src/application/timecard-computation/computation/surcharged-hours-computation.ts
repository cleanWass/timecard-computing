import { DayOfWeek, Duration, LocalDate, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List, Set } from 'immutable';
import forceRight from '../../../../test/~shared/util/forceRight';
import { EmploymentContract } from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { HolidayComputationService } from '../../../domain/service/holiday-computation/holiday-computation-service';
import { getTotalDuration } from '../../../~shared/util/joda-helper';

const isShiftDuringPlanning = (shift: Shift, planning: EmploymentContract['weeklyPlanning']) =>
  planning.get(shift.startTime.dayOfWeek(), Set<LocalTimeSlot>()).some(timeSlot => shift.getTimeSlot().isConcurrentOf(timeSlot));

const computeSundayHours = (timecard: WorkingPeriodTimecard) => {
  const sundayShifts = timecard.shifts.filter(shift => shift.startTime.dayOfWeek() === DayOfWeek.SUNDAY);

  return timecard.register(timecard.contract.isSundayWorker() ? 'SundayContract' : 'SundayAdditional', getTotalDuration(sundayShifts));
};

const computeHolidayHours = (timecard: WorkingPeriodTimecard) => {
  const holidayDates = new HolidayComputationService().computeHolidaysForLocale(
    'FR-75',
    forceRight(LocalDateRange.of(timecard.workingPeriod.period.start, timecard.workingPeriod.period.end)),
    Set([LocalDate.of(2023, 11, 16)])
  );
  const shiftsDuringHolidays = pipe(
    holidayDates,
    E.map(holidays => timecard.shifts.filter(shift => holidays.includes(shift.startTime.toLocalDate()))),
    E.getOrElse(e => {
      console.log(e);
      return List<Shift>();
    })
  );
  const shiftsDuringHolidaysGroupedByRate = shiftsDuringHolidays.groupBy(shift =>
    isShiftDuringPlanning(shift, timecard.contract.weeklyPlanning) ? 'HolidaySurchargedH' : 'HolidaySurchargedP'
  );
  return timecard
    .register('HolidaySurchargedH', getTotalDuration(shiftsDuringHolidaysGroupedByRate.get('HolidaySurchargedH', List<Shift>())))
    .register('HolidaySurchargedP', getTotalDuration(shiftsDuringHolidaysGroupedByRate.get('HolidaySurchargedP', List<Shift>())));
};

// TODO
const computeNightShiftHours = (timecard: WorkingPeriodTimecard) => {
  const getEarlyNightShifts = timecard.shifts.map(
    shift => shift.getTimeSlot().commonRange(timecard.contract.weeklyNightShiftHours[0])?.duration()
  );

  const getLateNightShifts = timecard.shifts.map(
    shift => shift.getTimeSlot().commonRange(timecard.contract.weeklyNightShiftHours[1])?.duration()
  );
  return timecard.register(
    timecard.contract.isNightWorker() ? 'NightShiftContract' : 'NightShiftAdditional',
    getEarlyNightShifts.concat(getLateNightShifts).reduce((acc, duration) => acc.plus(duration || Duration.ZERO), Duration.ZERO)
  );
};

// TODO
export const computeSurchargedHours = (timecard: WorkingPeriodTimecard) =>
  pipe(timecard, computeNightShiftHours, computeSundayHours, computeHolidayHours);
