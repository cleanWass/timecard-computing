import { DayOfWeek, Duration, LocalDate, LocalTime } from '@js-joda/core';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import * as O from 'fp-ts/Option';
import { List, Map, Set } from 'immutable';

import { mergeContractsIfSameWorkingTime } from '../../src/application/timecard-computation/curation/merge-contracts-if-same-working-time';
import { EmploymentContract } from '../../src/domain/models/employment-contract-management/employment-contract/employment-contract';
import { LocalDateRange } from '../../src/domain/models/local-date-range';
import { LocalTimeSlot } from '../../src/domain/models/local-time-slot';

const morningSlot = new LocalTimeSlot(LocalTime.of(6, 0), LocalTime.of(9, 0));
const morningToNoonSlot = new LocalTimeSlot(LocalTime.of(6, 0), LocalTime.of(12, 0));

const contractAPlanning = Map<DayOfWeek, Set<LocalTimeSlot>>()
  .set(DayOfWeek.MONDAY, Set<LocalTimeSlot>().add(morningSlot))
  .set(DayOfWeek.TUESDAY, Set<LocalTimeSlot>().add(morningSlot))
  .set(DayOfWeek.WEDNESDAY, Set<LocalTimeSlot>().add(morningSlot))
  .set(DayOfWeek.THURSDAY, Set<LocalTimeSlot>().add(morningSlot))
  .set(DayOfWeek.FRIDAY, Set<LocalTimeSlot>())
  .set(DayOfWeek.SATURDAY, Set<LocalTimeSlot>())
  .set(DayOfWeek.SUNDAY, Set<LocalTimeSlot>());

const contractBPlanning = Map<DayOfWeek, Set<LocalTimeSlot>>()
  .set(DayOfWeek.MONDAY, Set<LocalTimeSlot>())
  .set(DayOfWeek.TUESDAY, Set<LocalTimeSlot>())
  .set(DayOfWeek.WEDNESDAY, Set<LocalTimeSlot>().add(morningSlot))
  .set(DayOfWeek.THURSDAY, Set<LocalTimeSlot>().add(morningSlot))
  .set(DayOfWeek.FRIDAY, Set<LocalTimeSlot>().add(morningSlot))
  .set(DayOfWeek.SATURDAY, Set<LocalTimeSlot>().add(morningToNoonSlot))
  .set(DayOfWeek.SUNDAY, Set<LocalTimeSlot>());

const contractAPeriod = new LocalDateRange(
  LocalDate.parse('2025-07-07'),
  LocalDate.parse('2025-07-10')
);

const contractBPeriod = new LocalDateRange(
  LocalDate.parse('2025-07-10'),
  LocalDate.parse('2025-07-14')
);

const contractA = EmploymentContract.build({
  id: 'contract-a',
  initialId: 'contract-a',
  employeeId: 'employee1',
  startDate: LocalDate.parse('2025-07-07'),
  endDate: O.some(LocalDate.parse('2025-07-09')),
  overtimeAveragingPeriod: Duration.ofHours(35),
  weeklyTotalWorkedHours: Duration.ofHours(35),
  workedDays: Set<DayOfWeek>()
    .add(DayOfWeek.MONDAY)
    .add(DayOfWeek.TUESDAY)
    .add(DayOfWeek.WEDNESDAY)
    .add(DayOfWeek.THURSDAY),
  weeklyPlannings: Map<LocalDateRange, Map<DayOfWeek, Set<LocalTimeSlot>>>().set(
    contractAPeriod,
    contractAPlanning
  ),
  weeklyNightShiftHours: [
    new LocalTimeSlot(LocalTime.MIN, LocalTime.of(6, 0)),
    new LocalTimeSlot(LocalTime.of(21, 0), LocalTime.MAX),
  ],
  type: 'CDI',
  subType: 'CDI',
});

const contractB = EmploymentContract.build({
  id: 'contract-b',
  initialId: 'contract-b',
  employeeId: 'employee1',
  startDate: LocalDate.parse('2025-07-10'),
  endDate: O.some(LocalDate.parse('2025-07-13')),
  overtimeAveragingPeriod: Duration.ofHours(35),
  weeklyTotalWorkedHours: Duration.ofHours(35),
  workedDays: Set<DayOfWeek>()
    .add(DayOfWeek.WEDNESDAY)
    .add(DayOfWeek.THURSDAY)
    .add(DayOfWeek.FRIDAY)
    .add(DayOfWeek.SATURDAY),
  weeklyPlannings: Map<LocalDateRange, Map<DayOfWeek, Set<LocalTimeSlot>>>().set(
    contractBPeriod,
    contractBPlanning
  ),
  weeklyNightShiftHours: [
    new LocalTimeSlot(LocalTime.MIN, LocalTime.of(6, 0)),
    new LocalTimeSlot(LocalTime.of(21, 0), LocalTime.MAX),
  ],
  type: 'CDI',
  subType: 'CDI',
});

const contracts = List<EmploymentContract>().push(contractA).push(contractB);

const period = new LocalDateRange(LocalDate.parse('2025-07-01'), LocalDate.parse('2025-07-31'));

const result = mergeContractsIfSameWorkingTime({
  silaeId: '00914',
  period,
  contracts,
});

console.log(
  'Result:',
  pipe(
    result,
    E.fold(
      () => `never`,
      ctrs => ctrs.map(c => c.debug()).join('\n')
    )
  )
);

if (result._tag === 'Right') {
  const mergedContracts = result.right;
  console.log('Merged contracts count:', mergedContracts.size);

  if (mergedContracts.size > 0) {
    const mergedContract = mergedContracts.get(0);
    console.log('Merged contract:', mergedContract?.debug(true));
  }
}
