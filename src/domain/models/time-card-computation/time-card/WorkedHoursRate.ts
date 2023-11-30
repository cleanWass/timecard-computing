import {Duration} from '@js-joda/core';
import { keys } from '@shared/util/types';
import {Record} from 'immutable';

export const HoursTypeCodes = {
  TotalWeekly: 'H', // Horaire Total

  TotalComplementary: 'HC', // Horaire Complémentaire Total
  TenPercentRateComplementary: 'HC10', // Horaire complémentaire 10%
  ElevenPercentRateComplementary: 'HC11', // Horaire complémentaire 11%
  TwentyFivePercentRateComplementary: 'HC25', // Horaire complémentaire 25%

  TotalSupplementary: 'HS', // Horaire Supplémentaire Total
  TwentyFivePercentRateSupplementary: 'HS25', // Horaire supplémentaire 25%
  FiftyPercentRateSupplementary: 'HS50', // Horaire supplémentaire 50%

  SundayContract: 'Dim H', // Dimanche
  SundayAdditional: 'Dim P', // Dimanche complémentaire

  NightShiftContract: 'Nuit H', // Nuit
  NightShiftAdditional: 'Nuit P', // Nuit complémentaire
} as const;

export type WorkedHoursRate = keyof typeof HoursTypeCodes;

const defaultValues = keys(HoursTypeCodes).reduce(
  (acc, key) => {
    acc[key] = Duration.ZERO;
    return acc;
  },
  {} as {[k in WorkedHoursRate]: Duration}
);

export const WorkedHoursResume = Record(defaultValues);
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
