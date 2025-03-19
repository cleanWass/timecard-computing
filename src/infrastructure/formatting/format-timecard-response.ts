import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { TimecardComputationResult } from "src/application/csv-generation/export-csv";

export const formatTimecardComputationReturn = (result: TimecardComputationResult) => {
  return {
    employee: result.employee,
    period: { start: result.period.start.toString(), end: result.period.end.toString() },
    timecards: result.timecards.map(t => ({
      id: t.id,
      shifts: t.shifts.toArray(),
      leaves: t.leaves.toArray(),
      planning: t.weeklyPlanning.toJSON(),
      contract: {
        id: t.contract.id,
        initialId: t.contract.initialId,
        startDate: t.contract.startDate.toString(),
        endDate: pipe(
          t.contract.endDate,
          O.fold(
            () => undefined,
            e => e.toString()
          )
        ),
        type: t.contract.type,
        subType: t.contract.subType,
        extraDuration: t.contract.extraDuration,
        weeklyTotalWorkedHours: t.contract.weeklyTotalWorkedHours.toString(),
        weeklyPlannings: t.contract.weeklyPlannings
                          .map((planning, period) => ({
                            period: { start: period.start.toString(), end: period.end.toString() },
                            planning: planning.toJSON(),
                          }))
                          .valueSeq()
                          .toArray(),
      },
      workedHours: t.workedHours.toObject(),
      mealTickets: t.mealTickets,
      rentability: t.rentability,
      period: { start: t.workingPeriod.period.start.toString(), end: t.workingPeriod.period.end.toString() },
    })),
    weeklyRecaps: result.weeklyRecaps
                        .map(recap => ({
                          id: recap.id,
                          week: { start: recap.week.start.toString(), end: recap.week.end.toString() },
                          workingPeriods: recap.workingPeriods.toJS(),
                          timecardIds: recap.workingPeriodTimecards.map(t => t.id).toArray(),
                          contractIds: recap.employmentContracts.map(c => c.id).toArray(),
                          workedHours: recap.getTotalWorkedHours().toObject(),
                          mealTickets: recap.getTotalMealTickets(),
                        }))
                        .valueSeq()
                        .toArray(),
    contracts: result.contracts.map(c => ({
      id: c.id,
      initialId: c.initialId,
      startDate: c.startDate.toString(),
      endDate: pipe(
        c.endDate,
        O.fold(
          () => undefined,
          e => e.toString()
        )
      ),
      type: c.type,
      subType: c.subType,
      weeklyTotalWorkedHours: c.weeklyTotalWorkedHours.toString(),
      weeklyPlannings: c.weeklyPlannings
                        .map((planning, period) => ({
                          period: { start: period.start.toString(), end: period.end.toString() },
                          planning: planning.toJSON(),
                        }))
                        .valueSeq()
                        .toArray(),
    })),
  };
};
