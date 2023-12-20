import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { List } from 'immutable';
import '@js-joda/timezone';

import { Employee } from '../../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { LeavePeriod } from '../../domain/models/leave-recording/leave/leave-period';
import { LocalDateRange } from '../../domain/models/local-date-range';
import { Shift } from '../../domain/models/mission-delivery/shift/shift';
import { WorkingPeriodTimecard } from '../../domain/models/time-card-computation/timecard/working-period-timecard';
import { WorkingPeriod } from '../../domain/models/time-card-computation/working-period/working-period';
import { TimecardComputationError } from '../../~shared/error/TimecardComputationError';
import { computeExtraHoursByRate, computeTotalAdditionalHours } from './computation/additionnal-hours-computation';
import { computeLeavesHours, computeTotalNormalHoursAvailable, normalHoursComputation } from './computation/normal-hours-computation';
import { computeSurchargedHours } from './computation/surcharged-hours-computation';
import {
  groupLeavePeriodsByWorkingPeriods,
  groupShiftsByWorkingPeriods,
  splitPeriodIntoWorkingPeriods,
} from './computation/working-period-computation';
import { curateLeaves, filterShifts } from './curation/shifts-and-period-curation';
import { generateTheoreticalShiftIfPartialWeek } from './generation/theoretical-shifts-generation';

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
    leavePeriods,
  });

// TODO passer en option

// todo pattern matching on contract fulltime et flow(a) flow(b) selon temps plein / partiel ?
// [x] si semaine incomplète (nouveau contrat ou avenant), ajouter aux jours manquants les heures habituels selon le planning
// [/] faire le total des heures normales disponibles (congés payes + jours fériés) de la semaine
// [x] faire le total des heures travaillées de la semaine
// [x] si le total des heures travaillées + heures normales disponibles est > contrat, décompter les heures normales effectives
// [x] si plus d'heures normales disponibles, décompter des heures sup / comp
// [x] calculer la majoration des heures additionnelles selon contrat HC10 11 25 | HS 25 50
// [ ] calculer les majorations pour dimanche / jour férié / nuit

// [x] refacto en différents files
// [ ] calcul des surcharges dimanches t habituel vs ponctuel
// [ ] simulateur dans lapp de preview
// [ ] arrondir les taux HC 11 25
// [ ] calculer la date d'ancienneté othman
// [ ] jour férié si date dancienneté suffisante
// [ ] export si tout ok
// [ ] pour l'export un contrat par ligne, idem si avenant ou complement d'heure. faire la somme des deux dans ce cas
// [ ] arrondir les heures et les passer en centièmes

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
    normalHoursComputation,
    computeLeavesHours,
    computeTotalAdditionalHours,
    computeExtraHoursByRate,
    // t => {
    //   t.debug();
    //   return t;
    // }
    computeSurchargedHours
  );
};

export const computeTimecardForEmployee =
  (period: LocalDateRange) =>
  ({
    employee,
    shifts,
    contracts,
    leavePeriods,
  }: {
    employee: Employee;
    shifts: List<Shift>;
    leavePeriods: List<LeavePeriod>;
    contracts: List<EmploymentContract>;
  }) => {
    return pipe(
      E.Do,
      E.bind('workingPeriods', () => splitPeriodIntoWorkingPeriods(contracts, period)),
      E.bindW('groupedShifts', ({ workingPeriods }) => groupShiftsByWorkingPeriods(shifts, workingPeriods)),
      E.bindW('groupedLeavePeriods', ({ workingPeriods }) => groupLeavePeriodsByWorkingPeriods(leavePeriods, workingPeriods)),
      E.bindW('timecards', ({ workingPeriods, groupedShifts, groupedLeavePeriods }) => {
        return pipe(
          workingPeriods
            .map(wp =>
              pipe(
                wp,
                findContract(contracts),
                E.map(({ contract, workingPeriod }) =>
                  computeWorkingPeriodTimecard(
                    workingPeriod,
                    groupedShifts.get(workingPeriod, List<Shift>()),
                    groupedLeavePeriods.get(workingPeriod, List<LeavePeriod>()),
                    contract,
                    employee
                  )
                )
              )
            )
            .toArray(),
          E.sequenceArray,
          E.map(tcs => List(tcs))
        );
      }),
      E.map(({ timecards, workingPeriods, groupedShifts }) => {
        return {
          employee,
          period,
          workingPeriods,
          groupedShifts,
          timecards,
        };
      })
    );
  };
