import {EmploymentContract} from '../../../domain/models/employment-contract-management/employment-contract/employment-contract';
import {WorkingPeriodTimecard} from '../../../domain/models/time-card-computation/time-card/WorkingPeriodTimecard';

type WPTimecardComputation = (
  contract: EmploymentContract
) => (timecard: WorkingPeriodTimecard) => WorkingPeriodTimecard;
