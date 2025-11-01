import { Duration } from '@js-joda/core';

export const isDurationPositive = (duration: Duration) =>
  !duration.isNegative() && !duration.isZero();
