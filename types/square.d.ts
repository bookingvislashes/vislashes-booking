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
  attach(selector: string, options?: SquareGooglePayButtonOptions): Promise<void>;
  tokenize(): Promise<SquareTokenResult>;
  destroy(): void;
}

/**
 * Without buttonSizeMode: "fill", Google Pay renders its own default-width
 * button inside whatever container it's given — it does not stretch to match
 * a sibling button's width the way ordinary HTML would. That's why the
 * button used to render narrower than the Apple Pay button next to it.
 */
interface SquareGooglePayButtonOptions {
  buttonColor?: "black" | "white";
  buttonType?: "buy" | "plain" | "book" | "checkout" | "donate" | "order" | "pay" | "subscribe";
  buttonSizeMode?: "static" | "fill";
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
