import { Duration } from '@js-joda/core';

import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List, Map } from 'immutable';
import { EmploymentContract } from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LeavePeriod } from '../../../domain/models/leave-recording/leave/leave-period';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../../~shared/error/TimecardComputationError';

export const computeSupplementaryHours = (timecard: WorkingPeriodTimecard) => {
  const additionalHours = timecard.workedHours.TotalAdditionalHours;

  const _25PerCentRateHours = Duration.ofMinutes(Math.min(additionalHours.toMinutes(), Duration.ofHours(8).toMinutes()));
  const _50PerCentRateHours = additionalHours.minus(_25PerCentRateHours);
  return timecard
    .register('TwentyFivePercentRateSupplementary', _25PerCentRateHours)
    .register('FiftyPercentRateSupplementary', _50PerCentRateHours);
};
