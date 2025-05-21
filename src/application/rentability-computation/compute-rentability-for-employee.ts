import { Duration } from '@js-joda/core';
import { List, Map, Set } from 'immutable';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../domain/models/local-time-slot';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { HoursTypeCodes } from '../../domain/models/cost-efficiency/worked-hours-rate';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import {
  formatDuration,
  formatDurationAs100,
  getGreaterDuration,
  getTotalDuration,
} from '../../~shared/util/joda-helper';
import { keys } from '../../~shared/util/types';

const baseRateCDI = 14.43;
const baseRateCDD = 18.37;

const rateByHoursType = {
  TotalWeekly: 1,
  TotalNormal: 1,

  TenPercentRateComplementary: 1.1,
  ElevenPercentRateComplementary: 1.11,
  TwentyFivePercentRateComplementary: 1.25,

  TwentyFivePercentRateSupplementary: 1.25,
  FiftyPercentRateSupplementary: 1.5,

  SundayContract: 0,
  SundayAdditional: 0,

  NightShiftContract: 0,
  NightShiftAdditional: 0,

  HolidaySurchargedH: 0,
  HolidaySurchargedP: 0,
};

export const computeRentabilityForEmployee = (timecard: WorkingPeriodTimecard) => {
  console.log('computeRentabilityForEmployee');
  const baseRate = timecard.contract.type === 'CDI' ? baseRateCDI : baseRateCDD;
  let result = keys(rateByHoursType).reduce((res, hours) => {
    const rate = rateByHoursType[hours] ?? 0;
    console.log(formatDuration(timecard.workedHours[hours]), hours, rate);
    if (hours === 'TotalWeekly') {
      console.log(
        'TotalWeekly',
        timecard.workedHours.TotalWeekly.minus(timecard.workedHours.TotalAdditionalHours).toString()
      );
    }
    return hours === 'TotalWeekly'
      ? res +
          (getGreaterDuration(
            Duration.ZERO,
            timecard.workedHours.TotalWeekly.minus(timecard.workedHours.TotalAdditionalHours)
          ).toMinutes() /
            60) *
            baseRate *
            rate
      : res + (timecard.workedHours[hours].toMinutes() / 60) * baseRate * rate;
  }, 0);
  console.log(
    'result',
    result,
    (result / (timecard.workedHours.TotalWeekly.toMinutes() / 60)).toFixed(2)
  );
  return timecard.with({
    rentability: Number.parseFloat(
      (result / (timecard.workedHours.TotalWeekly.toMinutes() / 60)).toFixed(2)
    ),
  });
};
export const computeRentabilityForEmployeeTEST =
  (period: LocalDateRange) => (timecard: WorkingPeriodTimecard) => {
    // Compute rentability for employee
    const shifts = timecard.shifts;
    const clients = shifts.map(shift => shift.clientName || 'no client name').toSet();
    console.log('clients', clients.toJSON());
    const totalInterContract = timecard.getTotalIntercontractDuration();
    const shiftsByClients = shifts.groupBy(shift => shift.clientName || 'no client name');
    const recurringShiftsByClients = shiftsByClients
      .map(shifts => shifts.filter(shift => shift.type === 'Permanent'))
      .map(getTotalDuration);
    // .map(formatDurationAs100);
    const unoffShiftsByClients = shiftsByClients
      .map(shifts => shifts.filter(shift => shift.type === 'Ponctuel'))
      .map(getTotalDuration)
      .map(formatDurationAs100);
    const replacementShiftsByClients = shiftsByClients
      .map(shifts => shifts.filter(shift => shift.type === 'Remplacement'))
      .map(getTotalDuration)
      .map(formatDurationAs100);

    console.log('totalInterContract', totalInterContract.toString());
    console.log('shiftsByClients', shiftsByClients.toJS());
    console.log('recurringShiftsByClients', recurringShiftsByClients.toJS());
    console.log('unoffShiftsByClients', unoffShiftsByClients.toJS());
    console.log('replacementShiftsByClients', replacementShiftsByClients.toJS());

    const recurringShiftTotal = timecard.contract.weeklyTotalWorkedHours
      .minus(recurringShiftsByClients.reduce((acc, curr) => acc.plus(curr), Duration.ZERO))
      .minus(getTotalDuration(timecard.inactiveShifts));
    const inactiveShifts = getTotalDuration(timecard.inactiveShifts);
    console.log('inactiveShifts', formatDuration(inactiveShifts));
    return 'Rentability computed';
  };

const shiftIsInPlanning = (shift: Shift, timecards: List<WorkingPeriodTimecard>) => {
  return timecards.some(tc => {
    const dayPlannedSlots = tc.weeklyPlanning.get(
      shift.startTime.dayOfWeek(),
      Set<LocalTimeSlot>()
    );
    return dayPlannedSlots.some(slot => slot.contains(shift.getTimeSlot()));
  });
};
