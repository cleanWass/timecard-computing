import { DayOfWeek, Duration } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { identity } from 'fp-ts/function';
import { pipe } from 'fp-ts/lib/function';
import { EmploymentContract } from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { HolidayComputationService } from '../../../domain/service/holiday-computation/holiday-computation-service';
import { _attributeSurchargesCoreLogic } from './attribute-hours-core-logiq';

const NIGHT_SURCHARGED_HOURS_RATE = ['NightShiftContract', 'NightShiftAdditional'];

const SUNDAY_SURCHARGED_HOURS_RATE = ['SundayContract', 'SundayAdditional'];

const HOLIDAY_SURCHARGED_HOURS_RATE = ['HolidaySurchargedH', 'HolidaySurchargedP'];

const ADDITIONAL_HOURS_RATE = [
  'TotalNormal',
  'TenPercentRateComplementary',
  'ElevenPercentRateComplementary',
  'TwentyFivePercentRateComplementary',
  'TwentyFivePercentRateSupplementary',
  'FiftyPercentRateSupplementary',
];

export const attributesHolidaySurchargedToShifts = (tc: WorkingPeriodTimecard) => {
  return _attributeSurchargesCoreLogic(tc, HOLIDAY_SURCHARGED_HOURS_RATE, shift =>
    pipe(
      new HolidayComputationService().isHoliday('FR-75', shift.getDate()),
      E.fold(e => {
        console.log(e);
        return false;
      }, identity)
    )
  );
};

export const attributesNightTimeSurchargedToShifts = (tc: WorkingPeriodTimecard) => {
  return _attributeSurchargesCoreLogic(
    tc,
    NIGHT_SURCHARGED_HOURS_RATE,
    shift => shift.isNightShift() || shift.isMorningShift(),
    shift => {
      let earliestMorningEndTime = shift
        .getEndLocalTime()
        .isBefore(EmploymentContract.nightShiftTimeSlots[0].endTime)
        ? shift.getEndTime()
        : shift.startTime.with(EmploymentContract.nightShiftTimeSlots[0].endTime);
      return shift.with({
        startTime: shift.isNightShift()
          ? shift.startTime.with(EmploymentContract.nightShiftTimeSlots[1].startTime)
          : shift.startTime,
        duration: shift.isNightShift()
          ? Duration.between(
              shift.startTime.with(EmploymentContract.nightShiftTimeSlots[1].startTime),
              shift.getEndTime()
            )
          : Duration.between(shift.startTime, earliestMorningEndTime),
      });
    }
  );
};

export const attributeSundaySurchargeToShifts = (tc: WorkingPeriodTimecard) => {
  return _attributeSurchargesCoreLogic(
    tc,
    SUNDAY_SURCHARGED_HOURS_RATE,
    shift => shift.getDate().dayOfWeek() === DayOfWeek.SUNDAY
  );
};

export const attributeAdditionalToShifts = (tc: WorkingPeriodTimecard) => {
  return _attributeSurchargesCoreLogic(tc, ADDITIONAL_HOURS_RATE, shift => true);
};

export const attributeSurchargedHoursToShifts = (tc: WorkingPeriodTimecard) => {
  return pipe(
    tc,
    attributeAdditionalToShifts,
    attributesHolidaySurchargedToShifts,
    attributeSundaySurchargeToShifts,
    attributesNightTimeSurchargedToShifts
  );
};
