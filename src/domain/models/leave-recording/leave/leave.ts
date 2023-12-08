import {Duration, LocalDateTime, LocalTime} from '@js-joda/core';
import * as O from 'fp-ts/Option';
import {LocalDateRange} from '../../local-date-range';

import {LeaveId} from './leave-id';
import {LeaveReason} from './leave-reason';

export type Leave = {
  id: LeaveId;
  reason: LeaveReason;
  startTime: LocalTime;
  endTime: LocalTime;
  period: LocalDateRange;
  comment: O.Option<string>;
};
