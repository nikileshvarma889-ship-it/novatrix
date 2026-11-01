/** An AI failure with a message the user can act on. `permanent` = retrying will not help. */
export class AiError extends Error {
  constructor(message: string, readonly permanent = true) {
    super(message);
  }
}
export class AiNotConfigured extends AiError {
  constructor(provider?: "claude" | "gemini") {
    super(
      provider === "gemini"
        ? "No Gemini API key is configured. Add one in Settings → AI (or set GEMINI_API_KEY on the server)."
        : provider === "claude"
          ? "No Claude API key is configured. Add one in Settings → AI (or set ANTHROPIC_API_KEY on the server)."
          : "No AI key is configured. Add a Gemini or Claude API key in Settings → AI.",
    );
  }
}
