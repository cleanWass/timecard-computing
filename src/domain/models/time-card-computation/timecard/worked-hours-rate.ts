import { Duration } from '@js-joda/core';

import { Record, RecordOf } from 'immutable';
import { keys } from '../../../../~shared/util/types';

// TODO split computations keys and results keys
export const HoursTypeCodes = {
  TotalNormal: 'HN', // Horaire Normal Total

  TenPercentRateComplementary: 'HC10', // Horaire complémentaire 10%
  ElevenPercentRateComplementary: 'HC11', // Horaire complémentaire 11%
  TwentyFivePercentRateComplementary: 'HC25', // Horaire complémentaire 25%

  TwentyFivePercentRateSupplementary: 'HS25', // Horaire supplémentaire 25%
  FiftyPercentRateSupplementary: 'HS50', // Horaire supplémentaire 50%

  SundayContract: 'HDim', // Dimanche Habituel
  SundayAdditional: 'MajoDim100', // Dimanche Ponctuel

  NightShiftContract: 'HNuit', // Nuit Habituel
  NightShiftAdditional: 'MajoNuit100', // Nuit Ponctuel

  HolidaySurchargedH: 'MAJOFERIEH', // Majoration Férié Habituel
  HolidaySurchargedP: 'MAJOFERIEP', // Majoration Férié Ponctuel

  TotalWeekly: 'Heures total travaillées', // Horaire Total
  TotalContract: 'Heures contrat', // Horaire Contrat Total
  TotalIntercontract: 'Heures intercontrat', // Horaire Intercontrat Total
  TotalInactiveShifts: 'Heures shifts théoriques', // Nombre d'heures de shifts théoriques
  TotalLeaves: 'Heures congés total', // Horaire Congé Total
  TotalNationalHolidayLeaves: 'Heures congés jours fériés', // Horaire Congé Férié
  TotalLeavesUnpaid: 'Heures congés non payés', // Horaire Congé Non Payé
  TotalLeavesPaid: 'Heures congés payés', // Horaire Congé Payé
  TotalAdditionalHours: 'Heures additionnelles', // Horaire Additionnel Total
  TotalNormalAvailable: 'Heures normales disponibles restantes', // Horaire Normal Disponibles restantes
} as const;

export type WorkedHoursRate = keyof typeof HoursTypeCodes;

const defaultValues = keys(HoursTypeCodes).reduce(
  (acc, key) => {
    acc[key] = Duration.ZERO;
    return acc;
  },
  {} as { [k in WorkedHoursRate]: Duration }
);

export const WorkedHoursRecap = Record(defaultValues);
export type WorkedHoursRecapType = RecordOf<typeof defaultValues>;
