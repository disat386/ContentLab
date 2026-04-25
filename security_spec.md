# Security Specification for ContentLab (Auurio Ecosystem)

## Data Invariants
1. A user can only read and write their own profile in the `users` collection.
2. Credits can only be deducted (decremented) by the user during an AI generation action.
3. Users cannot arbitrarily increase their own credits.
4. Blog posts in the `blogs` collection are private to the creator (`userId`).
5. Blog posts must have a valid structure (title, content).

## The Dirty Dozen Payloads (Targeting PERMISSION_DENIED)
1. **Identity Spoofing**: Update `users/otherUID` as `currentUID`.
2. **Credit Injection**: Update my own profile with `credits: 999999`.
3. **Ghost Field**: Create user with `isAdmin: true`.
4. **Data Theft**: Read `blogs/someoneElseBlogId`.
5. **Orphaned Record**: Create blog with `userId` of another user.
6. **Path Poisoning**: Target `blogs/very-long-id-that-is-not-alphanumeric`.
7. **Temporal Fraud**: Set `createdAt` to a future date instead of `request.time`.
8. **Resource Exhaustion**: Send a 1MB string for blog `title`.
9. **Role Escalation**: Update `role` field on user profile (if present).
10. **Unverified Bypass**: Write data with an unverified email (if `email_verified` is checked).
11. **Immutability Breach**: Change `uid` after creation.
12. **Blanket Query**: List all blogs from all users.

## Testing Strategy
The `firestore.rules` will be tested using a dedicated test suite to ensure all malicious payloads are blocked.
