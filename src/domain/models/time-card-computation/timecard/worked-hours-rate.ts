import { Duration } from '@js-joda/core';

import { Record, RecordOf } from 'immutable';
import { keys } from '../../../../~shared/util/types';

export const HoursTypeCodes = {
  TotalNormal: 'HN', // Horaire Normal Total

  TenPercentRateComplementary: 'HC10', // Horaire complémentaire 10%
  ElevenPercentRateComplementary: 'HC11', // Horaire complémentaire 11%
  TwentyFivePercentRateComplementary: 'HC25', // Horaire complémentaire 25%

  TwentyFivePercentRateSupplementary: 'HS25', // Horaire supplémentaire 25%
  FiftyPercentRateSupplementary: 'HS50', // Horaire supplémentaire 50%

  SundayContract: 'Dim H', // Dimanche Habituel
  SundayAdditional: 'Dim P', // Dimanche Ponctuel

  NightShiftContract: 'Nuit H', // Nuit Habituel
  NightShiftAdditional: 'Nuit P', // Nuit Ponctuel

  HolidaySurchargedH: 'MAJOFERIEH', // Majoration Férié Habituel
  HolidaySurchargedP: 'MAJOFERIEP', // Majoration Férié Ponctuel

  TotalWeekly: 'H', // Horaire Total
  TotalTheoretical: 'HT', // Horaire Théorique Total
  // TotalSupplementary: 'HS', // Horaire Supplémentaire Total
  // TotalComplementary: 'HC', // Horaire Complémentaire Total
  TotalAdditionalHours: 'HA', // Horaire Additionnel Total
  TotalNormalAvailable: 'HNA', // Horaire Normal Disponible
} as const;

export type WorkedHoursRate = keyof typeof HoursTypeCodes;

const defaultValues = keys(HoursTypeCodes).reduce(
  (acc, key) => {
    acc[key] = Duration.ZERO;
    return acc;
  },
  {} as { [k in WorkedHoursRate]: Duration }
);

export const WorkedHoursResume = Record(defaultValues);
export type WorkedHoursResumeType = RecordOf<typeof defaultValues>;
//
// const defaultValues = {
//   TotalWeekly: Duration.ZERO,
//   TotalComplementary: Duration.ZERO,
//   TotalSupplementary: Duration.ZERO,
//   TenPercentRateComplementary: Duration.ZERO,
//   ElevenPercentRateComplementary: Duration.ZERO,
//   TwentyFivePercentRateComplementary: Duration.ZERO,
//   TwentyFivePercentRateSupplementary: Duration.ZERO,
//   FiftyPercentRateSupplementary: Duration.ZERO,
//   SundayContract: Duration.ZERO,
//   SundayAdditional: Duration.ZERO,
//   NightShiftContract: Duration.ZERO,
//   NightShiftAdditional: Duration.ZERO,
// };

// export class WorkedHoursResume extends Record(defaultValues) {
//   constructor(values?: Partial<typeof HoursTypeCodes>) {
//     super(values);
//   }
//
//   with(values: Partial<typeof HoursTypeCodes>) {
//     return this.merge(values);
//   }
// }
