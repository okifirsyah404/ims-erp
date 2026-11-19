import type {
	TBorrowingItemSelect,
	TBorrowingRequestSelect,
	TBorrowingSelect,
} from '@drizzle/schemas/inventory.schema';
import type { TBorrowingItemInput } from './borrowing.repository.interface';

/** Who is acting, and what they may bypass. */
export type TBorrowingActor = {
	actorUserId: string;
	/** Holding `asset_borrowing:approve`: may approve without a second person. */
	canApprove: boolean;
	/** Holding `asset_borrowing:issue`: may skip approval entirely. */
	canIssue: boolean;
	/** Holding `asset_borrowing:mark_lost` (or app admin): sees guest PII. */
	canSeeGuestPii: boolean;
};

/** Input for raising a borrowing request. */
export type TBorrowingCreateInput = {
	branch: 'user' | 'customer' | 'guest';
	purpose: 'rental' | 'internal_use' | 'testing' | 'warranty_service';
	dueAt: Date;
	borrowerUserId?: string | null;
	borrowerCustomerId?: string | null;
	guestName?: string | null;
	guestPhone?: string | null;
	guestIdType?: 'ktp' | 'sim' | 'passport' | 'other' | null;
	guestIdNumber?: string | null;
	guestAddressText?: string | null;
	guestIdDocumentRef?: string | null;
	notes?: string | null;
	/** Lend a whole tool set (Q37): it expands to one item per member unit. */
	toolSetId?: string | null;
	items: TBorrowingItemInput[];
};

/** One row of a request list: the request plus the card's display photo. */
export type TBorrowingRequestListItem = TBorrowingRequestSelect & {
	/** First requested item's image URL; `null` when nothing to show. */
	imageUrl: string | null;
};

/** One timeline entry, from either half of the lifecycle. */
export type TBorrowingTimelineEvent = {
	id: string;
	/** `request` before issue, `borrowing` after. */
	scope: 'request' | 'borrowing';
	borrowingItemId: string | null;
	eventType: string;
	movementId: string | null;
	actorUserId: string | null;
	occurredAt: Date;
	note: string | null;
};

/** A request as returned to a client, with its borrowing (once issued) and the PII projection applied. */
export type TBorrowingView = TBorrowingRequestSelect & {
	/** The issue document; `null` until the request is issued. */
	borrowing: TBorrowingSelect | null;
	items: TBorrowingItemSelect[];
	events: TBorrowingTimelineEvent[];
	/** `true` when guest identity fields were withheld from this caller. */
	guestIdentityRedacted: boolean;
};

/** Result of one sweep pass. */
export type TSweepResult = {
	/** Items marked late, or requests whose PII was nulled. */
	processed: number;
	/** Rows examined but skipped because another pass won. */
	skipped: number;
};
