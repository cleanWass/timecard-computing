import { ChronoUnit, DayOfWeek, Duration, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { identity, pipe } from 'fp-ts/function';
import { List, Set } from 'immutable';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { HolidayComputationService } from '../../../domain/service/holiday-computation/holiday-computation-service';
import { getTotalDuration } from '../../../~shared/util/joda-helper';
// cleaner travailleur de nuit et shift hors planning => majoration nuit ponctuelle
// si travailleur événementielle ou hotellerie et travailleur de nuit,

const isShiftDuringPlanning = (shift: Shift, planning: WorkingPeriodTimecard['weeklyPlanning']) =>
  planning
    .get(shift.startTime.dayOfWeek(), Set<LocalTimeSlot>())
    .some(timeSlot => shift.getTimeSlot().isConcurrentOf(timeSlot));

const computeSundayHours = (timecard: WorkingPeriodTimecard) => {
  const sundayShifts = timecard.shifts.filter(shift => shift.startTime.dayOfWeek() === DayOfWeek.SUNDAY);

  return timecard.register(
    timecard.contract.isSundayWorker() ? 'SundayContract' : 'SundayAdditional',
    getTotalDuration(sundayShifts)
  );
};

const computeHolidayHours = (timecard: WorkingPeriodTimecard) => {
  const holidayDates = new HolidayComputationService().computeHolidaysForLocale(
    'FR-75',
    new LocalDateRange(timecard.workingPeriod.period.start, timecard.workingPeriod.period.end)
  );
  const shiftsDuringHolidays = pipe(
    holidayDates,
    E.map(holidays => timecard.shifts.filter(shift => holidays.includes(shift.startTime.toLocalDate()))),
    E.getOrElse(e => List<Shift>())
  );
  const shiftsDuringHolidaysGroupedByRate = shiftsDuringHolidays.groupBy(shift =>
    isShiftDuringPlanning(shift, timecard.weeklyPlanning) ? 'HolidaySurchargedH' : 'HolidaySurchargedP'
  );
  return timecard
    .register(
      'HolidaySurchargedH',
      getTotalDuration(shiftsDuringHolidaysGroupedByRate.get('HolidaySurchargedH', List<Shift>()))
    )
    .register(
      'HolidaySurchargedP',
      getTotalDuration(shiftsDuringHolidaysGroupedByRate.get('HolidaySurchargedP', List<Shift>()))
    );
};

const computeNightShiftHours = (timecard: WorkingPeriodTimecard) => {
  const {
    shifts,
    contract: {
      weeklyNightShiftHours: [morningSurchargedHours, nightSurchargedHours],
    },
  } = timecard;
  const earlyMorningShifts = shifts.reduce((list, shift) => {
    const commonRange = shift.getTimeSlot().commonRange(morningSurchargedHours);
    return commonRange
      ? list.push(
          shift.with({ startTime: shift.startTime.with(commonRange.startTime), duration: commonRange.duration() })
        )
      : list;
  }, List<Shift>());

  const lateNightShifts = shifts.reduce((list, shift) => {
    const commonRange = shift.getTimeSlot().commonRange(nightSurchargedHours);
    if (!commonRange) return list;
    const duration =
      commonRange.startTime.plus(commonRange.duration()).compareTo(LocalTime.MAX.truncatedTo(ChronoUnit.MINUTES)) === 0
        ? commonRange.duration().plus(Duration.ofMinutes(1))
        : commonRange.duration();
    return list.push(shift.with({ startTime: shift.startTime.with(commonRange.startTime), duration }));
  }, List<Shift>());

  const nightShifts = earlyMorningShifts.concat(lateNightShifts);

  return timecard
    .register(
      'NightShiftContract',
      getTotalDuration(nightShifts.filter(s => timecard.getNightOrdinary().includes(s.startTime.dayOfWeek())))
    )
    .register(
      'NightShiftAdditional',
      getTotalDuration(nightShifts.filter(s => !timecard.getNightOrdinary().includes(s.startTime.dayOfWeek())))
    );
};

export const computeSurchargedHours = (timecard: WorkingPeriodTimecard) =>
  pipe(timecard, computeNightShiftHours, computeSundayHours, computeHolidayHours);
