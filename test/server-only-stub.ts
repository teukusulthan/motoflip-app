/**
 * `server-only` throws on import to stop server modules leaking into a client
 * bundle. On the server Next treats it as a no-op, which is what tests need
 * in order to exercise server modules directly.
 */
export {}
