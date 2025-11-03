// import { List, Map } from 'immutable';
// import { WorkingPeriodTimecard } from '../../models/time-card-computation/timecard/working-period-timecard';
// import { WorkingPeriod } from '../../models/time-card-computation/working-period/working-period';
//
// export interface InterfaceRentabilityComputationService {
//   timecards: List<WorkingPeriodTimecard>;
//   unitPrice: number;
// }
//
// export class RentabilityComputationService implements InterfaceRentabilityComputationService {
//   private static rateByHoursType = {
//     TotalWeekly: 1,
//     TotalNormal: 1,
//     TenPercentRateComplementary: 1.1,
//     ElevenPercentRateComplementary: 1.11,
//     TwentyFivePercentRateComplementary: 1.25,
//     TwentyFivePercentRateSupplementary: 1.25,
//     FiftyPercentRateSupplementary: 1.5,
//     SundayContract: 0,
//     SundayAdditional: 0,
//     NightShiftContract: 0,
//     NightShiftAdditional: 0,
//     HolidaySurchargedH: 0,
//     HolidaySurchargedP: 0,
//   };
//
//   constructor(
//     public timecards: List<WorkingPeriodTimecard>,
//     public unitPrice: number
//   ) {
//     this.unitPrice = unitPrice;
//     this.timecards = timecards;
//   }
//
//   public computeRentabilityByWorkingPeriod(): Map<WorkingPeriod, number> {
//     return this.timecards.reduce((acc, timecard) => {
//       const tcRentability = timecard.workedHours.toSeq().reduce((res, duration, type) => {
//         const rate = RentabilityComputationService.rateByHoursType[type];
//         if (hours === 'TotalWeekly') {
//           return (
//             res +
//             (getGreaterDuration(
//               Duration.ZERO,
//               timecard.workedHours.TotalWeekly.minus(timecard.workedHours.TotalAdditionalHours)
//             ).toMinutes() /
//               60) *
//               this.unitPrice *
//               rate
//           );
//         }
//         return res + (timecard.workedHours[hours].toMinutes() / 60) * this.unitPrice * rate;
//       });
//       return acc.set(timecard.workingPeriod, tcRentability);
//     }, Map());
//   }
// }
