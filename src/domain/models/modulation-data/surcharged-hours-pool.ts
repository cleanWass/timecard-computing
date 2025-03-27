import { Duration } from '@js-joda/core';
import { Record, RecordOf } from 'immutable';

const defaultSurchargedHoursPool = {
  TenPercentRateComplementary: Duration.ZERO,
  ElevenPercentRateComplementary: Duration.ZERO,
  TwentyFivePercentRateComplementary: Duration.ZERO,
  TwentyFivePercentRateSupplementary: Duration.ZERO,
  FiftyPercentRateSupplementary: Duration.ZERO,
};

export const SurchargedHoursPool = Record(defaultSurchargedHoursPool);
export type SurchargedHoursPoolType = RecordOf<typeof defaultSurchargedHoursPool>;
export type SurchargedHoursPoolRate = keyof typeof defaultSurchargedHoursPool;
