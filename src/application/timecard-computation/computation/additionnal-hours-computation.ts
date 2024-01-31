import { Duration } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { formatDuration, getGreaterDuration, getLowerDuration } from '../../../~shared/util/joda-helper';

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
    Duration.ofMinutes(Math.floor(Number(timecard.contract.weeklyTotalWorkedHours.toMinutes() * 0.1) / 15) * 15)
  );
  const _25PerCentRateHours = additionalHours.minus(_11PercentRateHours);
  return timecard
    .register('ElevenPercentRateComplementary', _11PercentRateHours)
    .register('TwentyFivePercentRateComplementary', _25PerCentRateHours);
};

export const computeComplementaryHours = (timecard: WorkingPeriodTimecard) =>
  pipe(timecard, timecard.contract.isExtraHours() ? computeSurchargeWithExtraHours : computeSurchargeWithoutExtraHours);

export const computeSupplementaryHours = (timecard: WorkingPeriodTimecard) => {
  const additionalHours = timecard.workedHours.TotalAdditionalHours;

  const _25PerCentRateHours = Duration.ofMinutes(Math.min(additionalHours.toMinutes(), Duration.ofHours(8).toMinutes()));
  const _50PerCentRateHours = additionalHours.minus(_25PerCentRateHours);
  return timecard
    .register('TwentyFivePercentRateSupplementary', _25PerCentRateHours)
    .register('FiftyPercentRateSupplementary', _50PerCentRateHours);
};

export const computeTotalAdditionalHours = (timecard: WorkingPeriodTimecard) => {
  const {
    contract: { weeklyTotalWorkedHours },
    workedHours: { TotalNormalAvailable, TotalTheoretical, TotalWeekly, TotalLeavesPaid },
  } = timecard;
  const totalEffectiveHours = TotalWeekly.plus(TotalTheoretical).plus(TotalLeavesPaid);
  const totalAdditionalHours = totalEffectiveHours.minus(weeklyTotalWorkedHours).plus(timecard.contract.extraDuration || Duration.ZERO);

  if (totalAdditionalHours.isNegative()) return timecard.register('TotalAdditionalHours', Duration.ZERO);
  const totalNormalHours = getLowerDuration(TotalNormalAvailable, totalAdditionalHours);
  //
  // console.log(`
  // -------------------------------------
  // TotalLeavesPaid: ${formatDuration(TotalLeavesPaid)}
  // TotalTheoretical: ${formatDuration(TotalTheoretical)}
  // totalAdditionalHours: ${formatDuration(totalAdditionalHours)}
  // TotalWeekly: ${formatDuration(TotalWeekly)}
  // totalEffectiveHours: ${formatDuration(totalEffectiveHours)}
  // TotalNormalAvailable: ${formatDuration(TotalNormalAvailable)}
  // -------------------------------------
  // totalNormalHours: ${formatDuration(totalNormalHours)}
  // -------------------------------------
  // `);
  return timecard
    .register('TotalNormal', totalNormalHours)
    .register('TotalNormalAvailable', TotalNormalAvailable.minus(totalNormalHours))
    .register(
      'TotalAdditionalHours',
      Duration.ofMinutes(Math.ceil(getGreaterDuration(totalAdditionalHours.minus(totalNormalHours), Duration.ZERO).toMinutes() / 15) * 15)
    );
};

export const computeExtraHoursByRate = (timecard: WorkingPeriodTimecard) =>
  timecard.contract.isFullTime() ? computeSupplementaryHours(timecard) : computeComplementaryHours(timecard);
