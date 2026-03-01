// Compatibility shim for deprecated expo-in-app-purchases
// TODO: Migrate subscriptionStore.ts to use services/purchases.ts (react-native-purchases)

export enum IAPResponseCode {
  OK = 0,
  USER_CANCELED = 1,
  ERROR = 2,
  DEFERRED = 3,
}

export interface InAppPurchase {
  productId: string;
  transactionId: string;
  purchaseTime: number;
  receipt: string;
}

export interface IAPItemDetails {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  subscriptionPeriod?: string;
}

export interface IAPQueryResponse<T> {
  responseCode: IAPResponseCode;
  results?: T[];
  errorCode?: string;
}

// Stub implementations - these will throw if actually called
// The app should use services/purchases.ts instead

export async function connectAsync(): Promise<void> {
  console.warn('[expo-iap-compat] connectAsync is deprecated. Use services/purchases.ts');
}

export function setPurchaseListener(
  _listener: (response: { responseCode: IAPResponseCode; results?: InAppPurchase[]; errorCode?: string }) => void
): void {
  console.warn('[expo-iap-compat] setPurchaseListener is deprecated. Use services/purchases.ts');
}

export async function getProductsAsync(
  _productIds: string[]
): Promise<IAPQueryResponse<IAPItemDetails>> {
  console.warn('[expo-iap-compat] getProductsAsync is deprecated. Use services/purchases.ts');
  return { responseCode: IAPResponseCode.ERROR, errorCode: 'DEPRECATED' };
}

export async function purchaseItemAsync(_productId: string): Promise<void> {
  console.warn('[expo-iap-compat] purchaseItemAsync is deprecated. Use services/purchases.ts');
  throw new Error('expo-in-app-purchases is deprecated. Use services/purchases.ts');
}

export async function finishTransactionAsync(
  _purchase: InAppPurchase,
  _consume: boolean
): Promise<void> {
  console.warn('[expo-iap-compat] finishTransactionAsync is deprecated. Use services/purchases.ts');
}

export async function getPurchaseHistoryAsync(): Promise<IAPQueryResponse<InAppPurchase>> {
  console.warn('[expo-iap-compat] getPurchaseHistoryAsync is deprecated. Use services/purchases.ts');
  return { responseCode: IAPResponseCode.ERROR, errorCode: 'DEPRECATED' };
}

export async function disconnectAsync(): Promise<void> {
  console.warn('[expo-iap-compat] disconnectAsync is deprecated. Use services/purchases.ts');
}
