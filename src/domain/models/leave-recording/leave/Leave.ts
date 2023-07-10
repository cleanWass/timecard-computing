import * as O from 'fp-ts/Option';
import {Duration, LocalDateTime} from '@js-joda/core';

import {LeaveId} from './LeaveId';
import {LeaveReason} from './LeaveReason';

export type Leave = {
  id: LeaveId;
  reason: LeaveReason;
  startTime: LocalDateTime;
  duration: O.Option<Duration>;
};
