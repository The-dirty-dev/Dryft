export const classNames = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

export const formatCurrency = (
  cents: number,
  currency = 'USD',
  locale = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
};

export const formatPrice = (
  cents: number,
  currency = 'USD',
  locale = 'en-US'
): string => {
  if (cents === 0) return 'Free';
  return formatCurrency(cents, currency, locale);
};

export const formatDate = (
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
  locale = 'en-US'
): string => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, options).format(date);
};

export const formatDistance = (
  distance?: number | null,
  unit: 'mi' | 'km' = 'mi'
): string => {
  if (distance === null || distance === undefined) return '';
  const rounded = distance < 1 ? distance.toFixed(1) : Math.round(distance).toString();
  const label = unit === 'km' ? 'km' : 'miles';
  return `${rounded} ${label} away`;
};

export const debounce = <T extends (...args: any[]) => void>(fn: T, delay = 300) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = <T extends (...args: any[]) => void>(fn: T, interval = 300) => {
  let lastTime = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = interval - (now - lastTime);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      lastTime = now;
      fn(...args);
      return;
    }

    if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = undefined;
        fn(...args);
      }, remaining);
    }
  };
};
