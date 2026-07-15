/**
 * List page sizes — limit Firestore reads per request.
 */

/** Generic directory / list paging (communities lists, legacy admin name). */
export const LIST_PAGE_SIZE = 40;

/** @deprecated Prefer LIST_PAGE_SIZE — kept for call-site stability during migration. */
export const ADMIN_LIST_PAGE_SIZE = LIST_PAGE_SIZE;

/** Feed de alertas (/alerts). */
export const ALERTS_LIST_PAGE_SIZE = 30;
