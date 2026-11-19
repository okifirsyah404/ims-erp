type OrderConfirmation = import("@/api/website").OrderConfirmation;
type OrderQuote = import("@/api/website").OrderQuote;

declare namespace App {
  interface SessionData {
    /**
     * Signed-in customer from the Customer Portal hand-off. Server-side only; the
     * browser holds just the opaque `eg_web_session` cookie.
     */
    customer: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      company?: string;
      /** ERP session cookie (`name=value`, ADR-0024); sent as `Cookie` on customer calls. */
      sessionCookie: string;
      /** ISO time the ERP session expires; the website session is dropped after it. */
      expiresAt: string;
    };
    /** Pending sign-in round trip (CSRF `state` + where to return). */
    authState: { state: string; next: string; createdAt: number };
    /** Last server-validated checkout quote (placeOrder must match it). */
    checkoutQuote: { quote: OrderQuote; fingerprint: string };
    /** Orders already placed in this session, keyed by idempotency key. */
    placedOrders: Record<string, OrderConfirmation>;
  }
}
