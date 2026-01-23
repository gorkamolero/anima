import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySessionStore, type Session } from "../../services/sessions.js";

describe("InMemorySessionStore", () => {
  let store: InMemorySessionStore;

  beforeEach(() => {
    store = new InMemorySessionStore();
  });

  describe("create", () => {
    it("should create a new session with unique ID", () => {
      const session = store.create();

      expect(session.id).toBeDefined();
      expect(session.id).toMatch(/^sess_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastAccess).toBeInstanceOf(Date);
    });

    it("should create sessions with different IDs", () => {
      const session1 = store.create();
      const session2 = store.create();

      expect(session1.id).not.toBe(session2.id);
    });

    it("should increment store size", () => {
      expect(store.size).toBe(0);
      store.create();
      expect(store.size).toBe(1);
      store.create();
      expect(store.size).toBe(2);
    });
  });

  describe("get", () => {
    it("should return undefined for non-existent session", () => {
      const session = store.get("non-existent-id");
      expect(session).toBeUndefined();
    });

    it("should return existing session", () => {
      const created = store.create();
      const retrieved = store.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it("should update lastAccess time on get", async () => {
      const session = store.create();
      const originalAccess = session.lastAccess;

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const retrieved = store.get(session.id);
      expect(retrieved?.lastAccess.getTime()).toBeGreaterThan(
        originalAccess.getTime()
      );
    });
  });

  describe("update", () => {
    it("should return undefined for non-existent session", () => {
      const result = store.update("non-existent-id", { foo: "bar" });
      expect(result).toBeUndefined();
    });

    it("should update session data", () => {
      const session = store.create();
      const updated = store.update(session.id, { score: 100 });

      expect(updated?.data).toEqual({ score: 100 });
    });

    it("should merge data with existing data", () => {
      const session = store.create();
      store.update(session.id, { score: 100 });
      store.update(session.id, { level: 5 });

      const retrieved = store.get(session.id);
      expect(retrieved?.data).toEqual({ score: 100, level: 5 });
    });

    it("should update lastAccess time", async () => {
      const session = store.create();
      const originalAccess = session.lastAccess;

      await new Promise((resolve) => setTimeout(resolve, 10));

      store.update(session.id, { foo: "bar" });
      const retrieved = store.get(session.id);

      expect(retrieved?.lastAccess.getTime()).toBeGreaterThan(
        originalAccess.getTime()
      );
    });
  });

  describe("delete", () => {
    it("should return false for non-existent session", () => {
      const result = store.delete("non-existent-id");
      expect(result).toBe(false);
    });

    it("should delete existing session", () => {
      const session = store.create();
      expect(store.size).toBe(1);

      const result = store.delete(session.id);
      expect(result).toBe(true);
      expect(store.size).toBe(0);
      expect(store.get(session.id)).toBeUndefined();
    });
  });

  describe("cleanup", () => {
    it("should remove expired sessions", async () => {
      const session1 = store.create();
      const session2 = store.create();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Access session2 to refresh its lastAccess
      store.get(session2.id);

      // Cleanup sessions older than 25ms
      const cleaned = store.cleanup(25);

      expect(cleaned).toBe(1);
      expect(store.size).toBe(1);
      expect(store.get(session1.id)).toBeUndefined();
      expect(store.get(session2.id)).toBeDefined();
    });

    it("should return 0 if no sessions expired", () => {
      store.create();
      store.create();

      const cleaned = store.cleanup(60000); // 1 minute
      expect(cleaned).toBe(0);
      expect(store.size).toBe(2);
    });
  });
});
