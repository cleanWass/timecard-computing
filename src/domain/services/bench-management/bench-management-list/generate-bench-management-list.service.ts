import { DayOfWeek, Duration } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { List, Map, OrderedMap, Set } from 'immutable';
import { TimecardComputationResult } from '../../../../application/csv-generation/export-csv';
import { logger } from '../../../../~shared/logging/logger';
import { formatDurationAs100 } from '../../../../~shared/util/joda-helper';
import { Employee } from '../../../models/employee-registration/employee/employee';
import { Bench } from '../../../models/leave-recording/bench-recording/bench';
import { LocalDateRange } from '../../../models/local-date-range';
import { LocalTimeSlot } from '../../../models/local-time-slot';
import { arrayToObject } from './helper';
import {
  BenchManagementListHeaders,
  BenchManagementListRow,
  dailyFieldAvailability,
  DailyFieldAvailability,
  dailyFieldIc,
  DailyFieldIc,
  dailyFields,
  ICWeek,
  icWeeks,
} from './types';

const generateBenchManagementListService = ({
  period,
  weeks,
  benchedEmployeesTimecard,
}: {
  period: LocalDateRange;
  weeks: List<LocalDateRange>;
  benchedEmployeesTimecard: Map<Employee, TimecardComputationResult>;
}) => {
  return benchedEmployeesTimecard
    .map((tcr, employee) => {
      console.log('Generating bench management list for employee', employee.silaeId);
      console.log('timecards : ', tcr.timecards.map(tc => tc.debug()).join('\n'));

      const IcPlusSection: Record<ICWeek, string> = arrayToObject(icWeeks, (_, i) =>
        formatDurationAs100(
          tcr.weeklyRecaps
            .get(
              weeks
                .sortBy(
                  w => w.start,
                  (a, b) => a.compareTo(b)
                )
                .toArray()[i]
            )
            ?.getTotalWorkedHours().TotalIntercontract || Duration.ZERO
        )
      );
      const benches = tcr.weeklyRecaps
        .valueSeq()
        .flatMap(wr => wr.workingPeriodTimecards.flatMap(tc => tc.benches))
        .toList();

      const dailyFieldBenchSlotsSection: Record<DailyFieldIc, string> = arrayToObject(
        dailyFieldIc,
        (_, i) =>
          LocalTimeSlot.mergeContinuousSlots(
            benches
              .filter(bench => bench.date.dayOfWeek() === DayOfWeek.values()[i])
              .sortBy(
                ts => ts.timeslot.startTime,
                (a, b) => a.compareTo(b)
              )
              .map(b => b.timeslot)
              .toSet()
          )
            .map(slot => slot.startTime + '-' + slot.endTime)
            .join(' ')
      );

      const dailyFieldAvailabilitySection: Record<DailyFieldAvailability, string> = arrayToObject(
        dailyFieldAvailability,
        (_, i) => {
          const currentDayAvailabilitySlots = employee.availabilityPlanning.get(
            DayOfWeek.values()[i],
            Set<LocalTimeSlot>()
          );
          const currentDayBenchesSlots = benches
            .filter(bench => bench.date.dayOfWeek() === DayOfWeek.values()[i])
            .map(b => b.timeslot)
            .toSet();

          return LocalTimeSlot.mergeContinuousSlots(
            currentDayAvailabilitySlots.flatMap(slot =>
              currentDayBenchesSlots.reduce(
                (acc, cur) => acc.concat(slot.subtract(cur)),
                Set<LocalTimeSlot>()
              )
            )
          )
            .sort((a, b) => a.startTime.compareTo(b.startTime))
            .map(slot => slot.startTime + '-' + slot.endTime)
            .join(' ');
        }
      );

      const employeeRow = OrderedMap({
        Manager: employee.managerName || '',
        'Silae id': employee.silaeId,
        Prénom: employee.firstName,
        Nom: employee.lastName,
        Téléphone: employee.phoneNumber || '',
        'Code Postal': employee.address?.postalCode || '',
        'Total 8W': pipe(
          tcr.weeklyRecaps.reduce(
            (acc, weeklyRecap) => acc.plus(weeklyRecap.getTotalWorkedHours().TotalIntercontract),
            Duration.ZERO
          ),
          formatDurationAs100
        ),
        '8W Surqualité': pipe(
          tcr.weeklyRecaps.reduce(
            (res, wr) =>
              res.plus(
                Bench.totalBenchesDuration(
                  wr.workingPeriodTimecards.flatMap(tc => tc.benches).toSet()
                )
              ),
            Duration.ZERO
          ),
          formatDurationAs100
        ),
        ...IcPlusSection,
        ...dailyFieldBenchSlotsSection,
        ...dailyFieldAvailabilitySection,
      });

      console.log(employeeRow.join(';'));
      return employeeRow.join(';');
    })
    .join('\n');
};
export default generateBenchManagementListService;
