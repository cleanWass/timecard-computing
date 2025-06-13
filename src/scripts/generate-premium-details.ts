import { DateTimeFormatter, Duration, LocalDate, LocalTime, Month } from '@js-joda/core';
import { format } from 'fast-csv';
import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import fs from 'fs';
import { List } from 'immutable';
import { formatObjectDurations } from '../application/csv-generation/export-csv';
import { ShiftHeaders } from '../application/csv-generation/headers';
import { computeTimecardForEmployee } from '../application/timecard-computation/compute-timecard-for-employee';
import { AnalyzedShift } from '../domain/models/cost-efficiency/analyzed-shift';
import { LocalDateRange } from '../domain/models/local-date-range';
import { BillingPeriodDefinitionService } from '../domain/service/billing-period-definition/billing-period-definition-service';
import { fetchEmployeeDataFromCache } from '../infrastructure/server/timecard-route-service';
import { formatPayload, parsePayload } from '../infrastructure/validation/parse-payload';
import { formatDurationAs100 } from '../~shared/util/joda-helper';

const formatDate = (date: LocalDate) => date.format(DateTimeFormatter.ofPattern('dd-MM-yyyy'));

const formatTime = (time: LocalTime) => time.format(DateTimeFormatter.ofPattern('HH:mm'));

const generatePremiumDetails = ({
  period,
  csvStream,
}: {
  csvStream: ReturnType<typeof format>;
  period: LocalDateRange;
}) =>
  pipe(
    period,
    fetchEmployeeDataFromCache,
    TE.tapIO(
      clR => () =>
        console.log(
          `Il y a  ${clR.length} cleaners actifs pour la période ${period.toFormattedString()}`
        )
    ),
    // TE.map(cl => [...cl.slice(0, 1)]),
    TE.chainW(
      TE.traverseSeqArray(cleanerData => {
        return pipe(
          TE.Do,
          TE.bind('data', () => pipe(parsePayload(cleanerData), TE.fromEither)),
          TE.bind('timecards', ({ data }) => {
            return pipe(data, formatPayload, computeTimecardForEmployee(period), TE.fromEither);
          })
        );
      })
    ),
    TE.map(result => ({
      shifts: result.flatMap(t => t.data.shifts),
      timecards: result.flatMap(t => t.timecards),
      premiumShifts: List(
        result
          .flatMap(t =>
            t.timecards.timecards.map(txc => txc.analyzedShifts || List<AnalyzedShift>()).flat(1)
          )
          .filter(t => t.size > 0)
      ).flatten(false) as List<AnalyzedShift>,
    })),
    TE.chain(({ premiumShifts, timecards, shifts }) => {
      console.log('starting CSV generation');
      try {
        shifts.forEach(shift => {
          const contractType =
            timecards
              .filter(tc => tc.employee.silaeId === shift.employeeId)
              .find(employeeTimecardForPeriod =>
                employeeTimecardForPeriod.contracts.find(contract =>
                  contract.period(LocalDate.MAX).includesDate(shift.getDate())
                )
              )
              ?.contracts.find(contract =>
                contract.period(LocalDate.MAX).includesDate(shift.getDate())
              )?.type || 'Unknown';
          const extraRates = premiumShifts.find(s => s.shift.id === shift.id)?.hoursBreakdown;

          const csvRow = {
            ClientId: shift.clientId,
            ClientName: shift.clientName,
            ShiftId: shift.id,
            Date: formatDate(shift.getDate()),
            'Heure de début': formatTime(shift.getStartTime().toLocalTime()),
            'Heure de fin': formatTime(shift.getEndLocalTime()),
            'Durée du Shift': formatDurationAs100(shift.duration),
            'Type de Shift': shift.type,
            'Nature du contrat': contractType,
            'Id Silae': shift.silaeId || shift.employeeId,

            ...formatObjectDurations({
              HN: extraRates?.TotalNormal || Duration.ZERO,
              HC10: extraRates?.TenPercentRateComplementary || Duration.ZERO,
              HC11: extraRates?.ElevenPercentRateComplementary || Duration.ZERO,
              HC25: extraRates?.TwentyFivePercentRateComplementary || Duration.ZERO,
              HS25: extraRates?.TwentyFivePercentRateSupplementary || Duration.ZERO,
              HS50: extraRates?.FiftyPercentRateSupplementary || Duration.ZERO,
              HNuit: extraRates?.NightShiftContract || Duration.ZERO,
              MajoNuit100: extraRates?.NightShiftAdditional || Duration.ZERO,
              HDim: extraRates?.SundayContract || Duration.ZERO,
              MajoDim100: extraRates?.SundayAdditional || Duration.ZERO,
            }),
            MAJOFERIEH: formatDurationAs100(extraRates?.HolidaySurchargedH || Duration.ZERO, ''),
            MAJOFERIEP: formatDurationAs100(extraRates?.HolidaySurchargedP || Duration.ZERO, ''),
          };
          csvStream.write(csvRow);
        });
        csvStream.end();
        return TE.right({ premiumShifts, timecards, shifts });
      } catch (e) {
        return TE.left(e);
      }
    }),
    TE.tapIO(() => () => console.log('CSV generation completed')),
    TE.mapLeft(error => {
      console.error('Error:', error);
      return error;
    })
  );

const { DECEMBER, MAY, MARCH, APRIL } = Month;
const main = async () => {
  const periods = new BillingPeriodDefinitionService().getBillingPeriodForMonths(
    [APRIL, MARCH, MAY],
    '2025'
  );
  return pipe(
    periods,
    TE.fromEither,
    TE.chain(
      TE.traverseSeqArray(period => {
        console.log(`Using period: ${period.start.toString()} to ${period.end.toString()}`);

        const dirPath = `exports/premium_details/${period.end.year()}`;
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        const csvFile = fs.createWriteStream(
          `exports/premium_details/${period.end.year()}/${period.end
            .month()
            .toString()
            .toLowerCase()}-${period.end.year()}.csv`
        );
        const csvStream = format({ headers: [...ShiftHeaders] });
        csvStream.pipe(csvFile);
        csvFile.on('finish', () => {
          console.log('CSV file has been written successfully');
          // process.exit(0);
        });

        return generatePremiumDetails({ period, csvStream });
      })
    )
  )();
};

main()
  .then(() => console.log('Job completed successfully'))
  .catch(e => console.error('Unhandled error:', e))
  .finally(() => {
    console.log('Exiting process...');
  });
