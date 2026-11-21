/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/client" />

type PortalUser = import("@/api/portal").PortalUser;
type AuthTokens = import("@/api/portal").AuthTokens;

declare namespace App {
  interface SessionData {
    auth: { user: PortalUser; tokens: AuthTokens; remember: boolean; signedInAt: string };
    /** Email awaiting OTP verification after registration. */
    pendingVerification: { email: string; accountType: "individual" | "business" };
    /** Guest-RFQ claim waiting for the emailed code. */
    rfqClaim: { reference: string; maskedEmail: string };
    /** Registration step-1 choice, kept server-side between steps. */
    registerAccountType: "individual" | "business";
    /** Where to go after registration + verification (e.g. back to website checkout). */
    returnTo: string;
    /** Summary for the one-shot "Ticket submitted" screen (08.02b). */
    ticketSubmitted: { id: string; number: string; device?: string; priority: "low" | "normal" | "urgent" };
    /** One-shot flash message shown on the next page. */
    flash: { tone: "success" | "info" | "danger"; title: string; description?: string };
  }

  interface Locals {
    user?: PortalUser;
    tokens?: AuthTokens;
    /** The visitor's language (portal cookie), sent to the ERP as Accept-Language. */
    language: import("@/lib/language").PortalLanguage;
  }
}
