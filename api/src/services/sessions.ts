/**
 * Session management service for game sessions
 * In-memory store for development, can be swapped for persistent storage
 */

import { randomUUID } from "node:crypto";

export interface Session {
  id: string;
  createdAt: Date;
  lastAccess: Date;
  data?: Record<string, unknown>;
}

export interface SessionStore {
  create(): Session;
  get(id: string): Session | undefined;
  update(id: string, data: Record<string, unknown>): Session | undefined;
  delete(id: string): boolean;
  cleanup(maxAgeMs: number): number;
}

/**
 * Generate a unique session ID using cryptographically secure randomness.
 * Uses full UUID (not truncated) for maximum entropy and security.
 */
function generateSessionId(): string {
  return `sess_${randomUUID()}`;
}

/**
 * In-memory session store implementation
 * Suitable for development and single-server deployments
 */
export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, Session> = new Map();

  /**
   * Create a new session
   */
  create(): Session {
    const now = new Date();
    const session: Session = {
      id: generateSessionId(),
      createdAt: now,
      lastAccess: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get a session by ID, updating lastAccess time
   */
  get(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.lastAccess = new Date();
    }
    return session;
  }

  /**
   * Update session data
   */
  update(id: string, data: Record<string, unknown>): Session | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.data = { ...session.data, ...data };
      session.lastAccess = new Date();
    }
    return session;
  }

  /**
   * Delete a session
   */
  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  /**
   * Clean up sessions older than maxAgeMs
   * @returns Number of sessions cleaned up
   */
  cleanup(maxAgeMs: number): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.lastAccess.getTime() > maxAgeMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Get total number of active sessions (for monitoring)
   */
  get size(): number {
    return this.sessions.size;
  }
}

// Default store instance
export const sessionStore = new InMemorySessionStore();
