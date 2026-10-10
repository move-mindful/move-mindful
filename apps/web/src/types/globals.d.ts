export {};

declare global {
  // Surfaced into the Clerk session token via the dashboard's
  // "Customize session token" setting: { "metadata": "{{user.public_metadata}}" }.
  // Lets us read the admin role from `sessionClaims` without an extra API call.
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: "admin";
    };
  }

  // Set by hand in the Clerk dashboard (Users → the person → Metadata → Public).
  // `trainer: true` marks a trainer in the chat — see joinCommunityChat().
  interface UserPublicMetadata {
    role?: "admin";
    trainer?: boolean;
  }
}
