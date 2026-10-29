import { Alert } from '@app/shared/ui';
import { errorMessage } from '../../core/api.ts';

export function ActionError({ error }: { error: unknown }) {
  if (!error) return null;
  return <Alert>{errorMessage(error)}</Alert>;
}
