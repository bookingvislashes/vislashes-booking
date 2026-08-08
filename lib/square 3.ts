import { SquareClient, SquareEnvironment } from "square";

let _client: SquareClient | null = null;

export function getSquareClient(): SquareClient {
  if (!_client) {
    _client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment:
        process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });
  }
  return _client;
}

/** Convert dollar amount to cents as BigInt (Square requires BigInt for amounts). */
export function toCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}
