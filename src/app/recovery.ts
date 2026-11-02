import type { ChantDocument } from '../editor/domain/chant-document';
import { demoDocument as exampleDocument } from './demo-document';
import { parseChant } from '../editor/persistence/chant-file';

export const recoveryKey = 'gregorian-chant-editor.document.v1';

export function readRecovery(storage?: Pick<Storage, 'getItem'>): {
  document: ChantDocument;
  warning: string;
} {
  try {
    const raw = (storage ?? localStorage).getItem(recoveryKey);
    return { document: raw ? parseChant(raw) : exampleDocument, warning: '' };
  } catch {
    return {
      document: exampleDocument,
      warning:
        'The saved browser copy could not be opened. Automatic saving is paused to preserve it. Export any work here before replacing that copy.',
    };
  }
}
