import { Duration } from '@js-joda/core';
import { Record } from "immutable";

export const HoursTypeCodes = {
  TotalWeekly: 'H',                           // Horaire Total
  TotalComplementary: 'HC',                   // Horaire Complémentaire Total
  TotalSupplementary: 'HS',                   // Horaire Supplémentaire Total
  TenPercentRateComplementary: 'HC10',        // Horaire complémentaire 10%
  ElevenPercentRateComplementary: 'HC11',     // Horaire complémentaire 11%
  TwentyFivePercentRateComplementary: 'HC25', // Horaire complémentaire 25%
  TwentyFivePercentRateSupplementary: 'HS25', // Horaire supplémentaire 25%
  FiftyPercentRateSupplementary: 'HS50',      // Horaire supplémentaire 50%
  SundayContract: 'Dim H',                    // Dimanche
  SundayAdditional: 'Dim P',                  // Dimanche complémentaire
  NightShiftContract: 'Nuit H',               // Nuit
  NightShiftAdditional: 'Nuit P'              // Nuit complémentaire
} as const;

const defaultValues = {
  TotalWeekly: Duration.ZERO,
  TotalComplementary: Duration.ZERO,
  TotalSupplementary: Duration.ZERO,
  TenPercentRateComplementary: Duration.ZERO,
  ElevenPercentRateComplementary: Duration.ZERO,
  TwentyFivePercentRateComplementary: Duration.ZERO,
  TwentyFivePercentRateSupplementary: Duration.ZERO,
  FiftyPercentRateSupplementary: Duration.ZERO,
  SundayContract: Duration.ZERO,
  SundayAdditional: Duration.ZERO,
  NightShiftContract: Duration.ZERO,
  NightShiftAdditional: Duration.ZERO,
}


export type WorkedHoursRate = keyof typeof HoursTypeCodes;

export class WorkedHoursResume extends Record(defaultValues) {

}
