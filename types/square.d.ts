interface SquarePayments {
  card(): Promise<SquareCard>;
  /**
   * Builds the PaymentRequest that applePay() and googlePay() require. Passing
   * them a plain options object instead throws — which is exactly what this
   * site did, so neither wallet ever initialised.
   */
  paymentRequest(options: SquarePaymentRequestOptions): SquarePaymentRequest;
  applePay(paymentRequest: SquarePaymentRequest): Promise<SquareApplePay | null>;
  googlePay(paymentRequest: SquarePaymentRequest): Promise<SquareGooglePay | null>;
  verifyBuyer(
    sourceId: string,
    verificationDetails: SquareVerificationDetails
  ): Promise<{ token: string } | null>;
}

interface SquareCard {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<SquareTokenResult>;
  destroy(): void;
  addEventListener(event: string, callback: (event: unknown) => void): void;
}

interface SquareApplePay {
  tokenize(): Promise<SquareTokenResult>;
}

interface SquareGooglePay {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<SquareTokenResult>;
  destroy(): void;
}

interface SquareTokenResult {
  status: "OK" | "ERROR";
  token?: string;
  errors?: Array<{ message: string }>;
}

/** The plain options handed to payments.paymentRequest(). */
interface SquarePaymentRequestOptions {
  countryCode: string;
  currencyCode: string;
  total: { amount: string; label: string };
}

/**
 * Opaque: what payments.paymentRequest() hands back. Deliberately not the same
 * type as the options above, so the mistake that broke both wallets — handing
 * the raw options straight to applePay() — is now a compile error.
 */
interface SquarePaymentRequest {
  readonly __brand: unique symbol;
}

interface SquareVerificationDetails {
  amount: string;
  billingContact: { givenName: string; familyName: string };
  currencyCode: string;
  intent: "CHARGE";
}

interface Window {
  Square?: {
    payments(
      applicationId: string,
      locationId: string
    ): Promise<SquarePayments>;
  };
}
