const addPrefix = <T extends readonly string[], P extends string>(
  arr: T,
  prefix: P
): { [K in keyof T]: `${P} ${T[K] & string}` } =>
  arr.map(day => `${prefix} ${day}` as `${P} ${typeof day}`) as {
    [K in keyof T]: `${P} ${T[K] & string}`;
  };
export const EmployeeHeaders = ['Silae Id', 'Salarié', 'Fonction', 'Période', 'Manager'] as const;

export const HolidayPremiumRateHeaders = ['MAJOFERIEH', 'MAJOFERIEP'] as const;

export const WorkedHoursHeaders = [
  'HN',
  'HC10',
  'HC11',
  'HC25',
  'HS25',
  'HS50',
  'HNuit',
  'MajoNuit100',
  'HDim',
  'MajoDim100',
] as const;

export const ShiftHeaders = [
  'ClientId',
  'ClientName',
  'ShiftId',
  'Date',
  'Heure de début',
  'Heure de fin',
  'duration',
  'Type de Shift',
  'Nature du contrat',
  ...WorkedHoursHeaders,
  ...HolidayPremiumRateHeaders,
] as const;

export const PerksHeaders = ['NbTicket'] as const;

export const ContractHeaders = ['Durée hebdo', 'Contrat'] as const;

export const DayHeaders = ['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'] as const;

export const PlanningDayHeaders = addPrefix(DayHeaders, 'P');
export const DoneDayHeaders = addPrefix(DayHeaders, 'F');

export const FullHeaders = [
  ...EmployeeHeaders,
  ...ContractHeaders,
  ...DayHeaders,
  ...PlanningDayHeaders,
  ...DoneDayHeaders,
  ...WorkedHoursHeaders,
  ...PerksHeaders,
] as const;

export const SilaeHeaders = [
  ...EmployeeHeaders,
  ...ContractHeaders,
  ...WorkedHoursHeaders,
  ...PerksHeaders,
] as const;

export const DebugHeaders = [
  ...EmployeeHeaders,
  ...ContractHeaders,
  // ...DayHeaders,
  // ...PlanningDayHeaders,
  // ...DoneDayHeaders,
  ...WorkedHoursHeaders,
  ...PerksHeaders,
] as const;

export const TotalHeaders = [
  ...EmployeeHeaders,
  ...ContractHeaders,
  ...WorkedHoursHeaders,
  ...PerksHeaders,
] as const;
