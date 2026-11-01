/** An error from a social platform, with a message a user can act on. */
export class PlatformError extends Error {
  constructor(public platform: string, message: string, public code?: number | string, public expired = false) {
    super(message);
  }
}
