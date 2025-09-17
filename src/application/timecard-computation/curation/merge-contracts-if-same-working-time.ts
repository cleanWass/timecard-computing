import { DayOfWeek, LocalDate } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { List, Map, Set } from 'immutable';
import {
  EmploymentContract,
  WeeklyPlanning,
} from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../../domain/models/local-time-slot';

const shouldBeMerged = (firstContract: EmploymentContract, secondContract: EmploymentContract) =>
  firstContract.weeklyTotalWorkedHours.equals(secondContract.weeklyTotalWorkedHours) &&
  firstContract.type === 'CDI' &&
  secondContract.type === 'CDI' &&
  firstContract.subType === secondContract.subType &&
  firstContract.subType !== 'complement_heure' &&
  secondContract.subType !== 'complement_heure';
const mergeWeeklyPlanningsBasedOnDates = ({
  firstContract,
  secondContract,
}: {
  firstContract: EmploymentContract;
  secondContract: EmploymentContract;
}): Map<LocalDateRange, WeeklyPlanning> => {
  let mergedWeeklyPlannings = Map<LocalDateRange, WeeklyPlanning>();

  const startDate = firstContract.startDate;
  const endDate = secondContract.endDate;
  const mergedPeriod = new LocalDateRange(startDate, O.getOrElse(() => LocalDate.MAX)(endDate));

  const mergedWeeklyPlanning = Map<DayOfWeek, Set<LocalTimeSlot>>().withMutations(
    weeklyPlanning => {
      DayOfWeek.values().forEach(dayOfWeek => {
        const firstContractPlanning = firstContract.weeklyPlannings
          .valueSeq()
          .flatMap(planning => planning.get(dayOfWeek, Set<LocalTimeSlot>()))
          .toSet();

        const secondContractPlanning = secondContract.weeklyPlannings
          .valueSeq()
          .flatMap(planning => planning.get(dayOfWeek, Set<LocalTimeSlot>()))
          .toSet();

        const firstContractEndDate = O.getOrElse(() => LocalDate.MAX)(firstContract.endDate);

        const dayPlanning =
          dayOfWeek.value() < firstContractEndDate.dayOfWeek().value()
            ? firstContractPlanning
            : secondContractPlanning;

        weeklyPlanning.set(dayOfWeek, dayPlanning);
      });
    }
  );

  mergedWeeklyPlannings = mergedWeeklyPlannings.set(mergedPeriod, mergedWeeklyPlanning);

  return mergedWeeklyPlannings;
};
export const mergeContractsIfSameWorkingTime = ({
  period,
  contracts,
}: {
  silaeId: string;
  period: LocalDateRange;
  contracts: List<EmploymentContract>;
}) => {
  const calendarWeeks = period.divideIntoCalendarWeeks();

  const groupedContracts = calendarWeeks.reduce(
    (res, week) =>
      res.set(
        week,
        contracts.filter(c => week.overlaps(c.period(week.end)))
      ),
    Map<LocalDateRange, List<EmploymentContract>>()
  );
  const groupedContractsWithSameWorkingTime = groupedContracts.reduce((acc, ctrs, week) => {
    return acc.set(
      week,
      ctrs.size <= 1
        ? ctrs
        : ctrs
            .sort((a, b) => a.startDate.compareTo(b.startDate))
            .reduce((acc, currentContract, index) => {
              const lastRegisteredContract = acc.last();
              if (index === 0 || !lastRegisteredContract) return acc.push(currentContract);
              if (shouldBeMerged(currentContract, lastRegisteredContract)) {
                const mergedWeeklyPlannings = mergeWeeklyPlanningsBasedOnDates({
                  firstContract: lastRegisteredContract,
                  secondContract: currentContract,
                });

                return acc.pop().push(
                  lastRegisteredContract.with({
                    endDate: currentContract.endDate,
                    weeklyPlannings: mergedWeeklyPlannings,
                  })
                );
              }
              return acc.push(currentContract);
            }, List<EmploymentContract>())
    );
  }, Map<LocalDateRange, List<EmploymentContract>>());

  const mergedContracts = groupedContractsWithSameWorkingTime
    .reduce((list, contracts) => list.concat(contracts), List<EmploymentContract>())
    .toSet()
    .toList();

  return E.right(mergedContracts);
};
