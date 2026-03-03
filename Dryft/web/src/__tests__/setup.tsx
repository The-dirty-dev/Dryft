import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import React from 'react';

type StorageLike = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'clear' | 'key' | 'length'
>;

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

function ensureStorage(name: 'localStorage' | 'sessionStorage') {
  const current = (globalThis as any)[name];
  const valid =
    current &&
    typeof current.getItem === 'function' &&
    typeof current.setItem === 'function' &&
    typeof current.removeItem === 'function' &&
    typeof current.clear === 'function';

  if (!valid) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: createMemoryStorage(),
    });
  }
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');

type RouterMock = {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  prefetch: ReturnType<typeof vi.fn>;
};

const mockRouter: RouterMock = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
};

(globalThis as { __mockRouter?: RouterMock }).__mockRouter = mockRouter;
(globalThis as { __mockSearchParams?: URLSearchParams }).__mockSearchParams =
  new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () =>
    (globalThis as { __mockSearchParams?: URLSearchParams }).__mockSearchParams ??
    new URLSearchParams(),
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

// External service mocks (Stripe/Firebase) to keep unit tests isolated.
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({
    confirmPayment: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useStripe: () => ({
    confirmPayment: vi.fn().mockResolvedValue({}),
  }),
  useElements: () => ({}),
  CardElement: () => <div data-testid="card-element" />,
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken: vi.fn(async () => 'test-token'),
  onMessage: vi.fn(),
}));

// Keep jsdom-based tests isolated: browser storage and mocks persist across
// test files unless explicitly cleared.
beforeEach(() => {
  const router = (globalThis as { __mockRouter?: RouterMock }).__mockRouter;
  router?.push.mockClear();
  router?.replace.mockClear();
  router?.prefetch.mockClear();

  (globalThis as { __mockSearchParams?: URLSearchParams }).__mockSearchParams =
    new URLSearchParams();

  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
