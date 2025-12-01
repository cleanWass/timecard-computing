import { DayOfWeek, Duration } from '@js-joda/core';
import { pipe } from 'fp-ts/function';
import { List, Map, OrderedMap, Set } from 'immutable';
import { TimecardComputationResult } from '../../../../application/csv-generation/export-csv';
import { formatDurationAs100 } from '../../../../~shared/util/joda-helper';
import { Employee } from '../../../models/employee-registration/employee/employee';
import { Bench } from '../../../models/leave-recording/bench-recording/bench';
import { LocalDateRange } from '../../../models/local-date-range';
import { LocalTimeSlot } from '../../../models/local-time-slot';
import { arrayToObject } from './helper';
import {
  dailyFieldAvailability,
  DailyFieldAvailability,
  dailyFieldIc,
  DailyFieldIc,
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
}) =>
  benchedEmployeesTimecard
    .map((tcr, employee) => {
      const IcPlusSection: Record<ICWeek, string> = arrayToObject(icWeeks, (_, i) =>
        formatDurationAs100(
          Bench.totalBenchesDuration(
            Set(tcr.timecards)
              .filter(tc => tc.workingPeriod.period.equals(weeks.get(i)))
              .flatMap(tc => tc.benches)
          )
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
        '8W Surqualité': pipe(
          tcr.weeklyRecaps.reduce(
            (res, wr) =>
              res.plus(
                Bench.totalBenchesDuration(
                  wr.workingPeriodTimecards
                    .flatMap(tc => tc.benches.filter(b => b.isExtraService()))
                    .toSet()
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

      return employeeRow.join(';');
    })
    .join('\n');

export default generateBenchManagementListService;
