import type { ChantDocument } from '../domain/chant-document';
import {
  IncompatibleDraftDocumentError,
  decodeDocument,
  encodeDocument,
} from './native-document';

// Retain the original namespace: v1–v5 bytes are read unchanged and upgraded to v6
// only on the next successful save, under the same conflict/recovery guard.
export const autosaveKey = 'gregorian-chant-editor:active-document:v1';
export type DocumentStorage = Pick<Storage, 'getItem' | 'setItem'>;
export class BrowserDocument {
  private expected: string | null = null;
  private blocked = false;
  recoverySource: string | null = null;
  status = 'Not saved yet. Export a file for a portable backup.';
  needsRecovery = false;
  savedLocally = false;
  private readonly storage: () => DocumentStorage;
  constructor(storage: () => DocumentStorage) {
    this.storage = storage;
  }
  load(fallback: ChantDocument): ChantDocument {
    this.savedLocally = false;
    try {
      this.expected = this.storage().getItem(autosaveKey);
      this.blocked = false;
      this.needsRecovery = false;
      this.recoverySource = null;
      if (this.expected === null) {
        this.status = 'No cached score. Not saved yet.';
        return fallback;
      }
      const document = decodeDocument(this.expected);
      this.savedLocally = true;
      this.status = 'Recovered committed score from this browser.';
      return document;
    } catch (error) {
      this.blocked = true;
      this.needsRecovery = true;
      this.recoverySource = this.expected;
      this.status = `Not saved: ${error instanceof IncompatibleDraftDocumentError ? 'cached draft-v2 score requires resolution' : 'cached score is invalid or unavailable'}. ${errorMessage(error)} Download the original cached source before any explicit replacement. Export current work separately.`;
      return fallback;
    }
  }
  check(): void {
    try {
      const actual = this.storage().getItem(autosaveKey);
      if (actual !== this.expected) {
        this.recoverySource ??= actual;
        this.savedLocally = false;
        this.blocked = true;
        this.needsRecovery = true;
        this.status =
          'Not saved: another tab changed the cached score. Export this tab before loading the cache or explicitly replacing it.';
      }
    } catch (error) {
      this.storageError(error);
    }
  }
  save(document: ChantDocument, replace = false): void {
    try {
      if (!replace) this.check();
      if (this.blocked && !replace) return;
      const text = encodeDocument(document);
      this.storage().setItem(autosaveKey, text);
      this.expected = text;
      this.blocked = false;
      this.needsRecovery = false;
      this.savedLocally = true;
      this.recoverySource = null;
      this.status = 'Committed score saved in this browser.';
    } catch (error) {
      this.storageError(error);
    }
  }
  private storageError(error: unknown) {
    this.savedLocally = false;
    this.blocked = true;
    this.needsRecovery = true;
    this.status = `Not saved: ${errorMessage(error)}. In-memory edits remain available; export a file or retry saving.`;
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Browser storage or file access failed';
}
