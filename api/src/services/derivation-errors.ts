/** Keep provider failure reasons useful without serializing request headers/keys. */
export function derivationError(error: unknown): string {
	if (typeof error === "object" && error !== null && "body" in error) {
		const body = error.body;
		if (
			typeof body === "object" &&
			body !== null &&
			"detail" in body &&
			typeof body.detail === "string" &&
			/exhausted balance/i.test(body.detail)
		)
			return "FAL account balance exhausted (HTTP 403); uncached perception unavailable";
		if (
			typeof body === "object" &&
			body !== null &&
			"detail" in body &&
			Array.isArray(body.detail)
		)
			return body.detail
				.map(
					(d: { loc?: unknown; msg?: string }) =>
						`${JSON.stringify(d.loc)}: ${d.msg ?? "validation failed"}`,
				)
				.join("; ");
	}
	return error instanceof Error ? error.message : "Ground derivation failed";
}
