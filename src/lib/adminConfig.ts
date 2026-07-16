/**
 * Administrator access configuration.
 *
 * Accounts listed here bypass the approval workflow, receive the admin
 * role automatically, and are the only users permitted to view:
 *  - Recent Activity Logs
 *  - User Login History
 *  - Report Approval History
 *  - Administrative Audit Logs
 *  - Pending User Requests (approve / reject)
 *
 * NOTE: this list is mirrored in firestore.rules (isAdmin()) so the
 * restriction is enforced server-side, not just hidden in the UI.
 * Keep both lists in sync.
 */
export const ADMIN_EMAILS = [
  "work.sufiyan.ahmed078@gmail.com",
  "anwar.ali41@gmail.com",
];

export const isAdminEmail = (email?: string | null): boolean =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase());
