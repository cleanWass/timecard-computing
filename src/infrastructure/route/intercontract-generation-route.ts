import { pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import { validateIntercontractGenerationRoutePayload } from '../server/intercontract-generation-route-service';

export const intercontractGenerationRoute = (payload: unknown) => {
  console.log('payload in');
  return pipe(
    validateIntercontractGenerationRoutePayload(payload),
    TE.fromEither,
    TE.map(d => {
      console.log('formatted data');
      return d;
    })
  );
};
