export const HoursTypeCodes = {
  TotalWeekly: 'H',                           // Horaire Total
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

export type WorkedHoursRate = keyof typeof HoursTypeCodes;
