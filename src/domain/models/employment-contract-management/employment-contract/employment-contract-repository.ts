import {LocalDate} from '@js-joda/core';
import {TaskEither} from 'fp-ts/TaskEither';
import {List} from 'immutable';
import {PersistenceError} from '../../../~shared/error/persistence-error';
import {EmployeeId} from '../../employee-registration/employee/employee-id';
import {EmploymentContract} from './employment-contract';
import {EmploymentContractId} from './employment-contract-id';

class ExpectedAggregateNotFoundsError {}

export interface EmploymentContractRepository {
  find(id: EmploymentContractId): TaskEither<ExpectedAggregateNotFoundsError, EmploymentContract>;

  lookupByEmployeeIdAndPeriod(
    id: EmployeeId,
    start: LocalDate,
    end: LocalDate
  ): TaskEither<PersistenceError, List<EmploymentContract>>;
}
