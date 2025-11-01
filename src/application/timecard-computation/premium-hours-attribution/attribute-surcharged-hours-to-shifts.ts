import { DayOfWeek, LocalDateTime, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { identity } from 'fp-ts/function';
import { pipe } from 'fp-ts/lib/function';
import { WorkingPeriodTimecard } from '../../../domain/models/timecard-computation/timecard/working-period-timecard';
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
      return shift.with({
        startTime: LocalDateTime.of(
          shift.getDate(),
          shift.getNightTime()?.startTime || LocalTime.of(12, 0)
        ),
        duration: shift.getNightTime()?.duration(),
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
  return _attributeSurchargesCoreLogic(tc, ADDITIONAL_HOURS_RATE, () => true);
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
