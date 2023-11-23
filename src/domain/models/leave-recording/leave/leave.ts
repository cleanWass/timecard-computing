import * as O from 'fp-ts/Option';
import {Duration, LocalDateTime} from '@js-joda/core';

import {LeaveId} from './leave-id';
import {LeaveReaso} from './leave-reason';

export type Leave = {
  id: LeaveId;
  reason: LeaveReaso;
  startTime: LocalDateTime;
  duration: O.Option<Duration>;
  comment: O.Option<string>;
};
