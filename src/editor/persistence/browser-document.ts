import type { ChantDocument } from '../domain/chant-document';
import { decodeDocument, encodeDocument } from './native-document';

export const autosaveKey = 'gregorian-chant-editor:active-document:v1';
export type DocumentStorage = Pick<Storage, 'getItem' | 'setItem'>;
export class BrowserDocument {
  private expected: string | null = null;
  private blocked = false;
  status = 'Not saved yet. Export a file for a portable backup.';
  needsRecovery = false;
  private readonly storage: () => DocumentStorage;
  constructor(storage: () => DocumentStorage) {
    this.storage = storage;
  }
  load(fallback: ChantDocument): ChantDocument {
    try {
      this.expected = this.storage().getItem(autosaveKey);
      this.blocked = false;
      this.needsRecovery = false;
      if (this.expected === null) {
        this.status = 'No cached score. Not saved yet.';
        return fallback;
      }
      const document = decodeDocument(this.expected);
      this.status = 'Recovered committed score from this browser.';
      return document;
    } catch (error) {
      this.blocked = true;
      this.needsRecovery = true;
      this.status = `Not saved: cached score is invalid or unavailable. ${errorMessage(error)} Export current work, then retry loading or explicitly replace the cache.`;
      return fallback;
    }
  }
  check(): void {
    try {
      if (this.storage().getItem(autosaveKey) !== this.expected) {
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
      this.status = 'Committed score saved in this browser.';
    } catch (error) {
      this.storageError(error);
    }
  }
  private storageError(error: unknown) {
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
