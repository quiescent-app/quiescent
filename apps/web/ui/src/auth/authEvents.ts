const authLossListeners = new Set<() => void>();

/** Registers a callback for when refresh fails or a retried request returns 401. */
export function subscribeToAuthLoss(listener: () => void): () => void {
  authLossListeners.add(listener);
  return () => authLossListeners.delete(listener);
}

/** Notifies all registered listeners that the user's session is no longer valid. */
export function notifyAuthLost(): void {
  for (const listener of authLossListeners) listener();
}
