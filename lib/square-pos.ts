/**
 * Handing a sale to the Square Point of Sale app.
 *
 * This module builds a URL and nothing else. It moves no money, holds no
 * secret, and calls no API: tapping the link it produces opens the Square app
 * with the amount already entered, the customer attached and Tap to Pay ready,
 * and the card is charged by Square exactly as it is today. The site's part is
 * knowing the number — which it does, and Square does not.
 *
 * WHY A DEEP LINK RATHER THAN CHARGING THE CARD OURSELVES
 *
 * The site can already take a card (that is what the deposit flow does), so
 * it could in principle charge the balance too. It should not. Tap to Pay
 * lives in the Square app, her card reader is paired to the Square app, and
 * the tip prompt her clients are used to is the Square app's. Rebuilding any
 * of that in a web page would be worse at every step and would put the site
 * in the path of money it has no reason to touch. So the site does the part
 * it is good at — who, and how much — and hands over.
 *
 * HOW THE PAYMENT FINDS ITS WAY BACK
 *
 * Not through the callback. Square returns to `callback_url` when the sale is
 * done, but that return is a browser navigation: it is lost if she switches
 * apps, force-quits, or simply walks away with the client. Relying on it to
 * record money would lose payments.
 *
 * Instead the checkout reference travels in the payment's own note, and the
 * signature-verified webhook — which fires regardless of what her phone does
 * afterwards — reads it back and attributes the payment to the appointment.
 * The callback is only there to bring her back to a screen that says it
 * worked; nothing depends on it arriving.
 */

/**
 * Crockford's alphabet minus the ambiguous letters: no I, L, O, U. The code
 * is printed on the client's receipt and may have to be read back over the
 * phone, where 0/O and 1/I are the same character to everyone but a computer.
 */
const REF_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A six-character checkout reference. ~1 in a billion collision at her volume. */
export function newCheckoutRef(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
}

/**
 * The note written onto the Square payment, and the only thing tying it back
 * to an appointment. Deliberately readable — it is on her client's receipt —
 * and deliberately NOT starting with "VIS Lashes Deposit", which the webhook
 * already uses to recognise a deposit this site charged itself.
 */
export function checkoutNote(clientName: string, ref: string): string {
  const firstName = clientName.trim().split(/\s+/)[0] || "Client";
  return `VIS Lashes · ${firstName} · ${ref}`;
}

/** Pulls the reference back out of a payment note. Null when it isn't one of ours. */
export function parseCheckoutRef(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = new RegExp(`\\b([${REF_ALPHABET}]{6})\\s*$`).exec(note.trim());
  return match ? match[1] : null;
}

export interface PosCheckoutInput {
  /** Whole cents. Square rejects anything else. */
  amountCents: number;
  note: string;
  /** Square customer id, when the client has been matched to one. */
  customerId?: string | null;
  /** Where Square returns to when the sale finishes. */
  callbackUrl: string;
  /** Echoed back on the callback untouched — the booking id. */
  state?: string;
}

export function isPosConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID);
}

/**
 * Builds the `square-commerce-v1://` URL that opens the Square app.
 *
 * Only the tender types she actually takes in person are offered. Leaving the
 * full set in would put "Gift card" and "Card on file" in front of her on
 * every sale, and card-on-file in particular charges without the client
 * present, which is not what a checkout at the door should ever offer by
 * accident.
 */
export function buildPosCheckoutUrl(input: PosCheckoutInput): string {
  const data: Record<string, unknown> = {
    amount_money: {
      amount: Math.round(input.amountCents),
      currency_code: "USD",
    },
    callback_url: input.callbackUrl,
    client_id: process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID,
    version: "1.3",
    notes: input.note,
    options: {
      supported_tender_types: ["CREDIT_CARD", "CASH", "OTHER"],
      // She is standing next to the client with the phone in her hand; the
      // receipt screen is one more tap between her and the next thing.
      auto_return: true,
    },
  };

  if (input.customerId) data.customer_id = input.customerId;
  if (input.state) data.state = input.state;

  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  if (locationId) data.location_id = locationId;

  return `square-commerce-v1://payment/create?data=${encodeURIComponent(
    JSON.stringify(data)
  )}`;
}

/**
 * Square's return is not one shape. On iOS it comes back as a single `data`
 * parameter holding JSON; on Android the same fields arrive as ordinary query
 * parameters. Both are read here, and anything unrecognised is treated as
 * "finished, outcome unknown" rather than as a failure — the webhook is what
 * actually knows whether money moved.
 */
export interface PosReturn {
  status: "ok" | "error" | "unknown";
  transactionId: string | null;
  clientTransactionId: string | null;
  errorCode: string | null;
  state: string | null;
}

export function parsePosReturn(params: URLSearchParams): PosReturn {
  let source: Record<string, unknown> = {};

  const raw = params.get("data");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        source = parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to the flat parameters below.
    }
  }

  const read = (key: string): string | null => {
    const fromJson = source[key];
    if (typeof fromJson === "string" && fromJson) return fromJson;
    return params.get(key) || null;
  };

  const errorCode = read("error_code");
  const rawStatus = read("status");

  return {
    status:
      errorCode || rawStatus === "error"
        ? "error"
        : rawStatus === "ok" || read("transaction_id")
        ? "ok"
        : "unknown",
    transactionId: read("transaction_id"),
    clientTransactionId: read("client_transaction_id"),
    errorCode,
    state: read("state"),
  };
}
