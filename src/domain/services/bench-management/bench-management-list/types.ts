import { OrderedMap } from 'immutable';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

function makeDailyFields<const T extends readonly string[]>(
  days: T
): readonly (`IC ${T[number]}` | `Dispo ${T[number]}`)[] {
  const mapped = days.flatMap(d => [`IC ${d}`, `Dispo ${d}`] as const);
  return mapped as readonly (`IC ${T[number]}` | `Dispo ${T[number]}`)[];
}

export const baseFields = [
  'Manager',
  'Lien BO',
  'Silae id',
  'Prénom',
  'Nom',
  'Téléphone',
  'Code Postal',
] as const;

export const weekSummaryFields = ['Total 8W', '8W Surqualité'] as const;

export const icWeeks = [
  'IC W+0',
  'IC W+1',
  'IC W+2',
  'IC W+3',
  'IC W+4',
  'IC W+5',
  'IC W+6',
  'IC W+7',
  'IC W+8',
] as const;

export type ICWeek = (typeof icWeeks)[number];

export const dailyFields = makeDailyFields(DAYS);

export const dailyFieldIc = [
  'IC Lun',
  'IC Mar',
  'IC Mer',
  'IC Jeu',
  'IC Ven',
  'IC Sam',
  'IC Dim',
] as const;
export const dailyFieldAvailability = [
  'Dispo Lun',
  'Dispo Mar',
  'Dispo Mer',
  'Dispo Jeu',
  'Dispo Ven',
  'Dispo Sam',
  'Dispo Dim',
] as const;

export type DailyFieldIc = (typeof dailyFieldIc)[number];
export type DailyFieldAvailability = (typeof dailyFieldAvailability)[number];

export const benchManagementListHeaders = [
  ...baseFields,
  ...weekSummaryFields,
  ...icWeeks,
  ...dailyFieldIc,
  ...dailyFieldAvailability,
  // ...dailyFields,
] as const;

export type BenchManagementListHeaders = (typeof benchManagementListHeaders)[number];

export type BenchManagementListRow = OrderedMap<BenchManagementListHeaders, string>;
