/**
 * The RevenueCat entitlement identifier that unlocks member content.
 *
 * Single source of truth shared by the client-side gate and server-side grants.
 * This is the entitlement *identifier* (the key in
 * `customerInfo.entitlements.active`), not a display name. Keep it framework- and
 * SDK-free so it can be imported from both client and server code.
 */
export const ENTITLEMENT_ID = "Move Mindful Pro";
