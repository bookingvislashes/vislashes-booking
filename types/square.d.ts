interface SquarePayments {
  card(): Promise<SquareCard>;
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

interface SquarePaymentRequest {
  countryCode: string;
  currencyCode: string;
  total: { amount: string; label: string };
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
