import { Duration } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { getGreaterDuration, getLowerDuration } from '../../../~shared/util/joda-helper';

const computeSurchargeWithExtraHours = (timecard: WorkingPeriodTimecard) => {
  const additionalHours = timecard.workedHours.TotalAdditionalHours;
  const _10PerCentRateHours = getLowerDuration(additionalHours, timecard.contract.extraDuration);
  const _25PerCentRateHours = getGreaterDuration(additionalHours.minus(_10PerCentRateHours), Duration.ZERO);
  return timecard
    .register('TenPercentRateComplementary', _10PerCentRateHours)
    .register('TwentyFivePercentRateComplementary', _25PerCentRateHours);
};

const computeSurchargeWithoutExtraHours = (timecard: WorkingPeriodTimecard) => {
  const additionalHours = timecard.workedHours.TotalAdditionalHours;
  if (additionalHours.isZero() || additionalHours.isNegative()) return timecard;
  const _11PercentRateHours = getLowerDuration(
    additionalHours,
    Duration.ofMinutes(Number((timecard.contract.weeklyTotalWorkedHours.toMinutes() * 0.1).toFixed(2)))
  );
  const _25PerCentRateHours = additionalHours.minus(_11PercentRateHours);
  return timecard
    .register('ElevenPercentRateComplementary', _11PercentRateHours)
    .register('TwentyFivePercentRateComplementary', _25PerCentRateHours);
};

export const computeComplementaryHours = (timecard: WorkingPeriodTimecard) => {
  return pipe(timecard, timecard.contract.isExtraHours() ? computeSurchargeWithExtraHours : computeSurchargeWithoutExtraHours);
};
