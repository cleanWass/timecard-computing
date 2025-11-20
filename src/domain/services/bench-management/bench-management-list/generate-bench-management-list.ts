// import { Duration } from '@js-joda/core';
// import { pipe } from 'fp-ts/function';
// import { List, Map } from 'immutable';
// import { TimecardComputationResult } from '../../../../application/csv-generation/export-csv';
// import { formatDurationAs100 } from '../../../../~shared/util/joda-helper';
// import { Employee } from '../../../models/employee-registration/employee/employee';
// import { LocalDateRange } from '../../../models/local-date-range';
// import { BenchManagementListRow } from './types';
//
// export type BenchManagement = {};
//
// export const generateBenchManagementList = ({
//   period,
//   weeks,
//   benchedEmployeesTimecard,
// }: {
//   period: LocalDateRange;
//   weeks: List<LocalDateRange>;
//   benchedEmployeesTimecard: Map<Employee, TimecardComputationResult>;
// }) => {
//   return benchedEmployeesTimecard.map((tcr, employee) => {
//     const employeeRow: BenchManagementListRow = {
//       Manager: employee.managerName || '',
//       'Silae id': employee.silaeId,
//       Prénom: employee.firstName,
//       Nom: employee.lastName,
//       Téléphone: employee.phoneNumber || '',
//       'Code Postal': employee.address?.postalCode || '',
//       'Total 8W': pipe(
//         tcr.weeklyRecaps.reduce(
//           (acc, weeklyRecap) => acc.plus(weeklyRecap.getTotalWorkedHours().TotalIntercontract),
//           Duration.ZERO
//         ),
//         formatDurationAs100
//       ),
//       '8W Surqualité': pipe(
//         tcr.weeklyRecaps
//           .flatMap(wr => wr.workingPeriodTimecards.flatMap(tc => tc.benches))
//           .toList(),
//         // .reduce((acc, benches) => acc.plus(benches.), Duration.ZERO),
//         t => t,
//         formatDurationAs100
//       ),
//     };
//   });
// };
