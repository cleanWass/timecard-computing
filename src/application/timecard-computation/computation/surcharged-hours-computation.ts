import { DayOfWeek, Duration, LocalDate, LocalDateTime, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { identity, pipe } from 'fp-ts/function';
import { List, Set } from 'immutable';
import forceRight from '../../../../test/~shared/util/forceRight';
import { EmploymentContract } from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { HolidayComputationService } from '../../../domain/service/holiday-computation/holiday-computation-service';
import { getTotalDuration } from '../../../~shared/util/joda-helper';
// cleaner travailleur de nuit et shift hors planning => majoration nuit ponctuelle
// si travailleur événementielle ou hotellerie et travailleur de nuit,

const isShiftDuringPlanning = (shift: Shift, planning: EmploymentContract['weeklyPlanning']) =>
  planning.get(shift.startTime.dayOfWeek(), Set<LocalTimeSlot>()).some(timeSlot => shift.getTimeSlot().isConcurrentOf(timeSlot));

const computeSundayHours = (timecard: WorkingPeriodTimecard) => {
  const sundayShifts = timecard.shifts.filter(shift => shift.startTime.dayOfWeek() === DayOfWeek.SUNDAY);

  return timecard.register(timecard.contract.isSundayWorker() ? 'SundayContract' : 'SundayAdditional', getTotalDuration(sundayShifts));
};

const computeHolidayHours = (timecard: WorkingPeriodTimecard) => {
  const holidayDates = new HolidayComputationService().computeHolidaysForLocale(
    'FR-75',
    forceRight(LocalDateRange.of(timecard.workingPeriod.period.start, timecard.workingPeriod.period.end))
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

const computeNightShiftHours = (timecard: WorkingPeriodTimecard) => {
  const { shifts, contract } = timecard;
  const nightShifts = shifts
    .map(shift => {
      const commonRange = shift.getTimeSlot().commonRange(contract.weeklyNightShiftHours[0]);
      if (!commonRange) return null;
      return shift.with({ startTime: shift.startTime.with(commonRange.startTime), duration: commonRange.duration() });
    })
    .filter(identity)
    .concat(
      shifts
        .map(shift => {
          const commonRange = shift.getTimeSlot().commonRange(contract.weeklyNightShiftHours[1]);
          if (!commonRange) return null;
          return shift.with({ startTime: shift.startTime.with(commonRange.startTime), duration: commonRange.duration() });
        })
        .filter(identity)
    );

  return timecard
    .register(
      'NightShiftContract',
      getTotalDuration(nightShifts.filter(s => contract.getNightOrdinary().includes(s.startTime.dayOfWeek())))
    )
    .register(
      'NightShiftAdditional',
      getTotalDuration(nightShifts.filter(s => !contract.getNightOrdinary().includes(s.startTime.dayOfWeek())))
    );
};

// TODO
export const computeSurchargedHours = (timecard: WorkingPeriodTimecard) =>
  pipe(timecard, computeNightShiftHours, computeSundayHours, computeHolidayHours);
