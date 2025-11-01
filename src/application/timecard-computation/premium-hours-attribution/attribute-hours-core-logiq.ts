import { Duration } from '@js-joda/core';
import { identity } from 'fp-ts/function';
import { List, Map } from 'immutable';
import {
  AnalyzedShift,
  ShiftHoursContribution,
} from '../../../domain/models/cost-efficiency/analyzed-shift';
import { WorkedHoursRate } from '../../../domain/models/cost-efficiency/worked-hours-rate';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../../domain/models/timecard-computation/timecard/working-period-timecard';
import { getLowerDuration } from '../../../~shared/util/joda-helper';

const SHIFT_TYPE_PRIORITY = ['Ponctuel', 'Remplacement', 'Permanent'];

export const mergeShiftHoursContributions = (
  ...contributions: ShiftHoursContribution[]
): ShiftHoursContribution => {
  const result: ShiftHoursContribution = {};
  for (const contrib of contributions) {
    for (const rateStr in contrib) {
      if (Object.prototype.hasOwnProperty.call(contrib, rateStr)) {
        const rate = rateStr as WorkedHoursRate;
        const duration = contrib[rate];
        if (duration) {
          // Check if duration is not undefined
          result[rate] = (result[rate] || Duration.ZERO).plus(duration);
        }
      }
    }
  }
  return result;
};

export const distributePremiumRates = (
  sortedShifts: List<Shift>,
  premiumRates: Map<WorkedHoursRate, Duration>
): List<AnalyzedShift> => {
  let shiftHoursBreakdown = sortedShifts.reduce(
    (acc, shift) => acc.set(shift, {} as ShiftHoursContribution),
    Map<Shift, ShiftHoursContribution>()
  );

  premiumRates.forEach((totalDuration, rate) => {
    let remainingDurationForRate = totalDuration;

    for (let i = 0; i < sortedShifts.size && !remainingDurationForRate.isZero(); i++) {
      const shift = sortedShifts.get(i);
      if (!shift) continue;
      const currentShiftContribution = shiftHoursBreakdown.get(shift, {} as ShiftHoursContribution);
      const remainingDurationForShift = shift
        .getDuration()
        .minus(AnalyzedShift.getShiftHoursContributionTotalDuration(currentShiftContribution));

      const durationToUse = getLowerDuration(remainingDurationForRate, remainingDurationForShift);
      shiftHoursBreakdown = shiftHoursBreakdown.update(shift, prevContribution =>
        mergeShiftHoursContributions(prevContribution || {}, { [rate]: durationToUse })
      );
      remainingDurationForRate = remainingDurationForRate.minus(durationToUse);
    }
  });

  return shiftHoursBreakdown
    .filter(breakDown => !AnalyzedShift.getShiftHoursContributionTotalDuration(breakDown).isZero())
    .map((hoursBreakdown, shift) => AnalyzedShift.build({ shift, hoursBreakdown }))
    .toList();
};

export const _attributeSurchargesCoreLogic = (
  tc: WorkingPeriodTimecard,
  surchargeRateCodes: ReadonlyArray<string>,
  specificShiftFilter: (shift: Shift) => boolean,
  shiftTransformer: (shift: Shift) => Shift = identity
): WorkingPeriodTimecard => {
  const majorationRates = tc.workedHours
    .toSeq()
    .filter(
      (duration, rateKey) => !duration.isZero() && surchargeRateCodes.includes(rateKey as string)
    )
    .toMap();

  const relevantShiftsFromTc = tc.shifts.filter(shift => SHIFT_TYPE_PRIORITY.includes(shift.type));

  const shiftsForThisSurchargeType = relevantShiftsFromTc
    .filter(specificShiftFilter)
    .map(shiftTransformer);

  const sortedShiftsForThisSurchargeType = shiftsForThisSurchargeType.sort((a, b) => {
    const typeAPriority = SHIFT_TYPE_PRIORITY.indexOf(a.type);
    const typeBPriority = SHIFT_TYPE_PRIORITY.indexOf(b.type);

    if (typeAPriority !== typeBPriority) {
      return typeAPriority - typeBPriority;
    }
    return a.getPrecedenceDate().compareTo(b.getPrecedenceDate());
  });

  const newContributions = distributePremiumRates(
    sortedShiftsForThisSurchargeType,
    majorationRates
  );

  const existingAnalyzedShifts = tc.analyzedShifts || List<AnalyzedShift>();

  const originalShiftsById = tc.shifts.reduce(
    (acc, shift) => acc.set(shift.id, shift),
    Map<string, Shift>()
  );

  const allContributionsGroupedById = existingAnalyzedShifts
    .concat(newContributions)
    .groupBy(analyzedShift => analyzedShift.shift.id);

  const finalAnalyzedShifts = allContributionsGroupedById
    .map((groupOfAnalyzedShifts, originalShiftId) => {
      const originalShift = originalShiftsById.get(originalShiftId);
      if (!originalShift) {
        console.error(`Original shift with ID ${originalShiftId} not found in timecard shifts.`);
        return null;
      }

      const combinedBreakdown = mergeShiftHoursContributions(
        ...groupOfAnalyzedShifts.map(as => as.hoursBreakdown).toArray()
      );

      if (AnalyzedShift.getShiftHoursContributionTotalDuration(combinedBreakdown).isZero()) {
        return null;
      }
      return AnalyzedShift.build({ shift: originalShift, hoursBreakdown: combinedBreakdown });
    })
    .filter(analyzedShift => analyzedShift !== null)
    .toList() as List<AnalyzedShift>;

  return tc.with({
    analyzedShifts: finalAnalyzedShifts,
  });
};
