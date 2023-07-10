import * as E from 'fp-ts/lib/Either';
import {Set} from 'immutable';
import {LocalDate} from '@js-joda/core';

import {
  HolidayComputationService,
  Period,
} from '../../../../src/domain/service/holiday-computation/HolidayComputationService';

const forceRight = <L, R>(eit: E.Either<L, R>) => (eit as E.Right<R>).right;

describe('HolidayComputationService', () => {
  describe('happy path', () => {
    describe('when provided with FR_IDF code', () => {
      it('returns an empty set if no holiday is found within period', () => {
        const jan2ToJan10_2023 = forceRight(
          Period.of(LocalDate.of(2023, 1, 2), LocalDate.of(2023, 1, 10))
        );
        expect(
          forceRight(
            new HolidayComputationService().computeHolidaysForLocale(
              'FR-IDF',
              jan2ToJan10_2023
            )
          )
        ).toEqual(Set<LocalDate>());
      });
    });
  });
});
