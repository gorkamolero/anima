// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { loadStartupEnvironment } from "../../startup.js";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it("never loads credentials during tests", () => {
	vi.stubEnv("NODE_ENV", "test");
	const load = vi.spyOn(process, "loadEnvFile").mockImplementation(() => {});
	loadStartupEnvironment(); expect(load).not.toHaveBeenCalled();
});
it("reuses startup loading outside tests and tolerates missing configuration", () => {
	vi.stubEnv("NODE_ENV", "development");
	const load = vi.spyOn(process, "loadEnvFile").mockImplementation(() => { throw Error("missing"); });
	expect(() => loadStartupEnvironment()).not.toThrow(); expect(load).toHaveBeenCalledOnce();
});
