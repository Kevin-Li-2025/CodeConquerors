jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///mock-cache' } },
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(async () => undefined),
  })),
}));

import { tileCache } from '@/services/TileCacheManager';

describe('TileCacheManager', () => {
  it('getTileKey uses z/x/y path segments', () => {
    expect(tileCache.getTileKey(10, 20, 5)).toBe('5/10/20');
  });
});
