import * as TE from 'fp-ts/TaskEither';
import { List } from 'immutable';
import { Employee } from '../../../domain/models/employee-registration/employee/employee';
import { EmploymentContract } from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import { Leave } from '../../../domain/models/leave-recording/leave/leave';
import { LeavePeriod } from '../../../domain/models/leave-recording/leave/leave-period';
import { LocalDateRange } from '../../../domain/models/local-date-range';
import { Shift } from '../../../domain/models/mission-delivery/shift/shift';
import { BenchAffectation, SlotToCreate } from '../../../domain/services/bench-generation/types';

export type EmployeeData = {
  employee: Employee;
  shifts: List<Shift>;
  contracts: List<EmploymentContract>;
  leaves: List<Leave>;
  leavePeriods: List<LeavePeriod>;
};

export interface CareDataParserClient {
  getEmployeesWithBenchGeneration: (
    period: LocalDateRange
  ) => TE.TaskEither<Error, ReadonlyArray<EmployeeData>>;

  getEmployeeData: (params: {
    silaeId: string;
    period: LocalDateRange;
  }) => TE.TaskEither<Error, EmployeeData>;

  getAllActiveEmployeesData: (
    period: LocalDateRange
  ) => TE.TaskEither<Error, ReadonlyArray<EmployeeData>>;

  generateBenchAffectation: (params: BenchAffectation) => TE.TaskEither<Error, void>;

  deleteBenchAffectations: (params: {
    silaeId: string;
    affectationsIds: string[];
  }) => TE.TaskEither<Error, void>;
}
