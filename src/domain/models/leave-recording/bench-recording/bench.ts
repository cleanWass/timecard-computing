import {Duration, LocalDateTime} from '@js-joda/core';
import * as O from 'fp-ts/Option';
import {BenchId} from './bench-id';

export type Bench = {
  id: BenchId;
  startTime: LocalDateTime;
  duration: O.Option<Duration>;
};
