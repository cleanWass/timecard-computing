import { List } from 'immutable';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';

const ratesFixe = {
  partTime: {
    HN: 14.43,
    HC10: 15.88,
    HC11: 16.02,
    HC25: 18.04,
  },
  fullTime: {
    HN: 15.18,
    HS25: 18.04,
    HS50: 21.65,
  },
};

const ratesRelatives = {
  partTime: {
    HN: 14.43,
    HC10: 15.88,
    HC11: 16.02,
    HC25: 18.04,
  },
  fullTime: {
    HN: 15.18,
    HS25: 18.04,
    HS50: 21.65,
  },
};

export const computeRentabilityForEmployee = (period: LocalDateRange, timecards: List<WorkingPeriodTimecard>) => {
  // Compute rentability for employee

  return 'Rentability computed';
};
