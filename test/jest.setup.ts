/**
 * Jest global setup. Runs before every test file via the `setupFiles`
 * entry in package.json. Keep the mock surface tight — only mock the
 * native modules our code actually imports during tests.
 */

// expo-sqlite → in-memory better-sqlite3 mock. Factory is inline (not
// a sibling module) to avoid the require-cycle Jest hits when a
// `setupFiles` mock factory loads a relative path.
jest.mock('expo-sqlite', () => {
  const Database = require('better-sqlite3');
  const dbs: Map<string, any> = new Map();

  function flatten(args: any[]): any[] {
    if (args.length === 1 && Array.isArray(args[0])) return args[0];
    return args;
  }

  function wrap(db: any) {
    return {
      execSync(sql: string): void {
        db.exec(sql);
      },
      runSync(sql: string, ...rest: any[]) {
        const stmt = db.prepare(sql);
        const info = stmt.run(...flatten(rest));
        return {
          changes: info.changes,
          lastInsertRowId: Number(info.lastInsertRowid),
        };
      },
      getFirstSync(sql: string, ...rest: any[]) {
        const stmt = db.prepare(sql);
        return stmt.get(...flatten(rest)) ?? null;
      },
      getAllSync(sql: string, ...rest: any[]) {
        const stmt = db.prepare(sql);
        return stmt.all(...flatten(rest));
      },
      withTransactionSync(cb: () => void): void {
        const txn = db.transaction(cb);
        txn();
      },
      async withTransactionAsync(cb: () => Promise<void>): Promise<void> {
        db.exec('BEGIN');
        try {
          await cb();
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      },
      closeSync(): void {
        db.close();
      },
    };
  }

  function openDatabaseSync(name: string) {
    const existing = dbs.get(name);
    if (existing && existing.open) return wrap(existing);
    const fresh = new Database(':memory:');
    dbs.set(name, fresh);
    return wrap(fresh);
  }

  function __resetExpoSqliteMock(): void {
    for (const db of dbs.values()) {
      if (db.open) db.close();
    }
    dbs.clear();
  }

  return {
    __esModule: true,
    openDatabaseSync,
    __resetExpoSqliteMock,
    default: { openDatabaseSync, __resetExpoSqliteMock },
  };
});

// expo-crypto.randomUUID — deterministic per call so tests can assert
// on IDs. Counter lives inside the factory so jest's hoisting doesn't
// trip over an out-of-scope reference.
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () => {
      counter += 1;
      return `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
    },
  };
});

// react-native-purchases — pure stub. Real RC needs the native bridge.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    getProducts: jest.fn().mockResolvedValue([]),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
}));

// expo-constants — only `.expoConfig.extra` is read in tests.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        revenueCatIosKey: 'test_rc_key',
      },
    },
  },
}));

// expo-haptics — no-op so haptic calls don't crash component tests.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// react-native-device-activity — internal native module, stub everything.
jest.mock('react-native-device-activity', () => ({}));

// @sentry/react-native — native module, can't load under jest. Provide
// the surface lib/sentry.ts touches and nothing else.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  wrap: <T,>(component: T): T => component,
}));

// react-native `Settings` is missing from the jest-expo mock surface.
// uses24HourClock() reads it via `Settings.get` — without a stub the
// app code blows up with "Cannot read properties of undefined".
// Force 24h here so any test that touches formatClockTime is
// locale-independent. We mock just the Settings entry path so we don't
// have to call requireActual('react-native') (which drags in native
// modules like DevMenu and fails in node).
jest.mock('react-native/Libraries/Settings/Settings', () => ({
  __esModule: true,
  default: {
    get: (key: string) => (key === 'AppleICUForce24HourTime' ? 1 : null),
    set: jest.fn(),
    watchKeys: jest.fn(),
    clearWatch: jest.fn(),
  },
}));
