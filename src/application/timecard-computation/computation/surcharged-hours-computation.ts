import { DayOfWeek, Duration, LocalDate } from '@js-joda/core';
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

const isShiftDuringPlanning = (shift: Shift, planning: EmploymentContract['weeklyPlanning']) =>
  planning.get(shift.startTime.dayOfWeek(), Set<LocalTimeSlot>()).some(timeSlot => shift.getTimeSlot().isConcurrentOf(timeSlot));

const computeSundayHours = (timecard: WorkingPeriodTimecard) => {
  const sundayShifts = timecard.shifts.filter(shift => shift.startTime.dayOfWeek() === DayOfWeek.SUNDAY);
  const sundayShiftsGroupedByRate = sundayShifts.groupBy(shift =>
    isShiftDuringPlanning(shift, timecard.contract.weeklyPlanning) ? 'SundayContract' : 'SundayAdditional'
  );

  return timecard
    .register(
      'SundayContract',
      sundayShiftsGroupedByRate.get('SundayContract', List<Shift>()).reduce((acc, shift) => acc.plus(shift.duration), Duration.ZERO)
    )
    .register(
      'SundayAdditional',
      sundayShiftsGroupedByRate.get('SundayAdditional', List<Shift>()).reduce((acc, shift) => acc.plus(shift.duration), Duration.ZERO)
    );
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
    .register(
      'HolidaySurchargedH',
      shiftsDuringHolidaysGroupedByRate
        .get('HolidaySurchargedH', List<Shift>())
        .reduce((acc, shift) => acc.plus(shift.duration), Duration.ZERO)
    )
    .register(
      'HolidaySurchargedP',
      shiftsDuringHolidaysGroupedByRate
        .get('HolidaySurchargedP', List<Shift>())
        .reduce((acc, shift) => acc.plus(shift.duration), Duration.ZERO)
    );
};

// TODO
const computeNightShiftHours = (timecard: WorkingPeriodTimecard) => {
  const nightHours = timecard.contract.weeklyNightShiftHours;
  return timecard;
};
// TODO
export const computeSurchargedHours = (timecard: WorkingPeriodTimecard) =>
  pipe(timecard, computeNightShiftHours, computeSundayHours, computeHolidayHours);
