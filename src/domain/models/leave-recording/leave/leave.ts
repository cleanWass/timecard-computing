import * as O from 'fp-ts/Option';
import {Duration, LocalDateTime} from '@js-joda/core';

import {LeaveId} from './leave-id';
import {LeaveReason} from './leave-reason';

export type Leave = {
  id: LeaveId;
  reason: LeaveReason;
  startTime: LocalDateTime;
  duration: O.Option<Duration>;
  comment: O.Option<string>;
};
