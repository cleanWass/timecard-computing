import { Duration, Instant, LocalDateTime, ZoneId } from '@js-joda/core';
import { Interval } from '@js-joda/extra';
import * as E from 'fp-ts/Either';
import { identity, pipe } from 'fp-ts/function';
import { List, Map, Set } from 'immutable';
import '@js-joda/timezone';

import { Employee } from '../../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../domain/models/leave-recording/leave/leave';
import { LeavePeriod } from '../../domain/models/leave-recording/leave/leave-period';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { LocalTimeSlot } from '../../domain/models/local-time-slot';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { TheoreticalShift } from '../../domain/models/mission-delivery/shift/theorical-shift';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import { getFirstDayOfWeek, getGreaterDuration } from '../../~shared/util/joda-helper';
import { computeSupplementaryHours } from './full-time-computation/full-time-computation';
import { computeComplementaryHours } from './partial-time-computation/partial-time-computation';
import type { WPTimecardComputation } from './util/types';
import { groupShiftsByWorkingPeriods, splitPeriodIntoWorkingPeriods } from './util/working-period-computation';

const computeTotalHoursByWorkingPeriod = (groupedShifts: Map<WorkingPeriod, List<Shift>>) =>
  E.right(groupedShifts.map(gs => gs.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)));

// todo HERE
const computeNightShiftHours = (timecard: WorkingPeriodTimecard) => {
  const nightHours = timecard.contract.weeklyNightShiftHours;
  return timecard;
};

const computeTotalHoursWorked = (timecard: WorkingPeriodTimecard) =>
  timecard.register(
    'TotalWeekly',
    timecard.shifts.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)
  );

const computeTotalAdditionalHours = (timecard: WorkingPeriodTimecard) => {
  const {
    contract: { weeklyTotalWorkedHours },
    workedHours: {
      TotalNormalAvailable: totalNormalAvailableHours,
      TotalTheoretical: totalTheoreticalHours,
      TotalWeekly: totalWeeklyHours,
    },
  } = timecard;
  const totalEffectiveHours = totalWeeklyHours.plus(totalTheoreticalHours);

  const totalAdditionalHours = totalEffectiveHours.minus(weeklyTotalWorkedHours);
  if (totalAdditionalHours.isNegative()) return timecard.register('TotalAdditionalHours', Duration.ZERO);
  const totalNormalHours = getGreaterDuration(totalNormalAvailableHours, totalAdditionalHours);
  return timecard
    .register('TotalNormal', totalNormalHours)
    .register('TotalAdditionalHours', getGreaterDuration(totalAdditionalHours.minus(totalNormalHours), Duration.ZERO));
};

const findContract = (contracts: List<EmploymentContract>) => (workingPeriod: WorkingPeriod) =>
  pipe(
    contracts.find(c => c.id === workingPeriod.employmentContractId),
    E.fromNullable(new TimecardComputationError('Missing contract')),
    E.map(contract => ({ contract, workingPeriod }))
  );

const initializeWorkingPeriodTimecard = ({
  shifts,
  leavePeriods,
  contract,
  workingPeriod,
  employee,
}: {
  shifts: List<Shift>;
  leavePeriods: List<LeavePeriod>;
  contract: EmploymentContract;
  employee: Employee;
  workingPeriod: WorkingPeriod;
}) =>
  WorkingPeriodTimecard.build({
    contract,
    employee,
    workingPeriod,
    shifts,
    leaves: List<Leave>(),
    leavePeriods,
  });

// TODO passer en option

const generateTheoreticalShift = (timecard: WorkingPeriodTimecard) =>
  List(
    timecard.workingPeriod.period
      .with({
        start: getFirstDayOfWeek(timecard.workingPeriod.period.start),
        end: getFirstDayOfWeek(timecard.workingPeriod.period.start).plus(timecard.contract.overtimeAveragingPeriod),
      })
      .toLocalDateArray()
      .filter(d => !timecard.workingPeriod.period.contains(d))
      .flatMap(day =>
        timecard.contract.weeklyPlanning
          .get(day.dayOfWeek(), Set<LocalTimeSlot>())
          .map(timeSlot =>
            TheoreticalShift.build({
              duration: timeSlot.duration(),
              employeeId: timecard.employee.id,
              startTime: LocalDateTime.of(day, timeSlot.startTime),
            })
          )
          .toArray()
      )
  );

const generateTheoreticalShiftIfPartialWeek = (wpTimecard: WorkingPeriodTimecard) => {
  if (wpTimecard.workingPeriod.isComplete(wpTimecard.contract)) return wpTimecard;

  const theoreticalShifts = generateTheoreticalShift(wpTimecard);
  return wpTimecard.with({ theoreticalShift: generateTheoreticalShift(wpTimecard) }).register(
    'TotalTheoretical',
    theoreticalShifts.reduce((acc, sh) => acc.plus(sh.duration), Duration.ZERO)
  );
};

const computeTotalNormalHoursAvailable = (timecard: WorkingPeriodTimecard) => {
  const normalHoursFromLeaves = timecard.leaves
    .filter(leave => leave.reason === 'Paid' || leave.reason === 'Holiday')
    .reduce((sum, shift) => sum.plus(shift.duration), Duration.ZERO);

  return timecard.register('TotalNormalAvailable', normalHoursFromLeaves);
};

const isShiftDuringLeavePeriod = (shift: Shift) => (leave: LeavePeriod) => leave.getInterval().contains(Instant.from(shift.startTime));

export const getCuratedShifts = (leave: LeavePeriod, shift: Shift) => {
  return pipe(
    shift.getInterval(),
    E.fromPredicate(
      s => leave.getInterval().overlaps(s),
      () => List([shift])
    ),
    E.map(sh => {
      if (leave.getInterval().encloses(sh)) return List<Shift>([]);
      const beforeLeave = Interval.of(sh.start(), leave.getInterval().start());
      const afterLeave = Interval.of(leave.getInterval().end(), sh.end());

      return List([
        beforeLeave.toDuration().toMillis() > 0 &&
          shift.with({ id: `${shift.id}-before Leave ${leave.id}`, duration: beforeLeave.toDuration() }),
        afterLeave.toDuration().toMillis() > 0 &&
          shift.with({
            id: `${shift.id}-after Leave ${leave.id}`,
            startTime: LocalDateTime.of(leave.period.end, leave.endTime),
            duration: afterLeave.toDuration(),
          }),
      ]).filter(identity);
    }),
    E.getOrElse(() => List([shift]))
  );
};

const filterShifts = (timecard: WorkingPeriodTimecard) => {
  const shifts = timecard.shifts.flatMap(shift => {
    const leaveDuringShift = timecard.leavePeriods.find(isShiftDuringLeavePeriod(shift));
    return leaveDuringShift ? getCuratedShifts(leaveDuringShift, shift) : [shift];
  });

  return timecard.with({ shifts });
};

const curateLeaves = ({
  workingPeriod,
  contract,
  employee,
  shifts,
  leavePeriods,
}: {
  workingPeriod: WorkingPeriod;
  shifts: List<Shift>;
  leavePeriods: List<LeavePeriod>;
  contract: EmploymentContract;
  employee: Employee;
}) => {
  const leaves = leavePeriods.flatMap(leavePeriod =>
    shifts.filter(leavePeriod.containsShift).map(shift =>
      Leave.build({
        reason: leavePeriod.reason,
        startTime: LocalDateTime.ofInstant(leavePeriod.getInterval().intersection(shift.getInterval()).start(), ZoneId.of('Europe/Paris')),
        duration: leavePeriod.getInterval().intersection(shift.getInterval()).toDuration(),
      })
    )
  );

  return {
    workingPeriod,
    shifts,
    leaves: leavePeriods,
    leavePeriods,
    contract,
    employee,
  };
};

// todo pattern matching on contract fulltime et flow(a) flow(b) selon temps plein / partiel ?
// [x] si semaine incomplète (nouveau contrat ou avenant), ajouter aux jours manquants les heures habituels selon le planning
// [/] faire le total des heures normales disponibles (congés payes + jours fériés) de la semaine
// [x] faire le total des heures travaillées de la semaine
// [x] si le total des heures travaillées + heures normales disponibles est > contrat, décompter les heures normales effectives
// [x] si plus d'heures normales disponibles, décompter des heures sup / comp
// [x] calculer la majoration des heures additionnelles selon contrat HC10 11 25 | HS 25 50
// [ ] calculer les majorations pour dimanche / jour férié / nuit
// [ ] enlever les heures fictives

const computeSundayHours = (timecard: WorkingPeriodTimecard) => {
  throw new Error('Function not implemented.');
  return timecard;
};
const computeHolidayHours = (timecard: WorkingPeriodTimecard) => {
  throw new Error('Function not implemented.');
  return timecard;
};

// TODO
const computeSurchargedHours = (timecard: WorkingPeriodTimecard) =>
  pipe(timecard, computeNightShiftHours, computeSundayHours, computeHolidayHours);

export const computeWorkingPeriodTimecard: (
  workingPeriod: WorkingPeriod,
  shifts: List<Shift>,
  leavePeriods: List<LeavePeriod>,
  contract: EmploymentContract,
  employee: Employee
) => WorkingPeriodTimecard = (workingPeriod, shifts, leavePeriods, contract, employee) => {
  return pipe(
    {
      contract,
      employee,
      workingPeriod,
      shifts,
      leavePeriods,
    },
    initializeWorkingPeriodTimecard,
    curateLeaves,
    filterShifts,
    generateTheoreticalShiftIfPartialWeek,
    computeTotalNormalHoursAvailable,
    computeTotalHoursWorked,
    computeTotalAdditionalHours,
    computeComplementaryHours,
    computeSupplementaryHours,
    computeSurchargedHours
  );
};

export const computeTimecardForEmployee =
  (period: LocalDateRange) =>
  ({
    employee,
    shifts,
    contracts,
    leaves,
  }: {
    employee: Employee;
    shifts: List<Shift>;
    leaves: List<LeavePeriod>;
    contracts: List<EmploymentContract>;
  }) =>
    pipe(
      E.Do,
      E.bind('workingPeriods', () => splitPeriodIntoWorkingPeriods(contracts, period)),
      E.bindW('groupedShifts', ({ workingPeriods }) => groupShiftsByWorkingPeriods(shifts, workingPeriods)),
      E.bindW('groupedLeaves', () => E.right(Map<WorkingPeriod, List<LeavePeriod>>())),
      E.bindW('timecards', ({ workingPeriods, groupedShifts, groupedLeaves }) =>
        pipe(
          workingPeriods.toArray().map(wp =>
            pipe(
              wp,
              findContract(contracts),
              E.map(({ contract, workingPeriod }) =>
                computeWorkingPeriodTimecard(
                  workingPeriod,
                  groupedShifts.get(workingPeriod, List<Shift>()),
                  groupedLeaves.get(workingPeriod, List<LeavePeriod>()),
                  contract,
                  employee
                )
              )
            )
          ),
          E.sequenceArray,
          E.map(tcs => List(tcs))
        )
      ),
      E.map(({ timecards, workingPeriods, groupedShifts }) => {
        return {
          employee,
          period,
          workingPeriods,
          groupedShifts,
          timecards,
          // totalAdditionalHours,
        };
      })
    );

// TODO
// - [x] filter contracts
// - [x] filter shifts
// - [x] filter leaves
// - [x] group shifts by contract
// - [ ] group leaves by contract
// - [X] divide contract period into periods
// - [X] match shift and leaves to periods
// - [ ] determiner complement d'heures, heures complementaires, heures supplementaires
// - [ ] ressortir les heures majorées (nuit, dimanche, férié)
// - [ ] calculer les tickets restaurants
// - [ ] computeTimecardForEmployee
