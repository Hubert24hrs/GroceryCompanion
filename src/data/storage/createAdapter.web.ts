import { WebStorageAdapter } from './webAdapter';
import { StorageAdapter } from './types';

export function createAdapter(): StorageAdapter {
    return new WebStorageAdapter();
}
