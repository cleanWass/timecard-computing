import { BenchId } from '@domain/models/leave-recording/bench-recording/BenchId';
import { Duration, LocalDateTime } from '@js-joda/core';
import * as O from 'fp-ts/Option';

export type Bench = {
  id: BenchId;
  startTime: LocalDateTime;
  duration: O.Option<Duration>;
};
