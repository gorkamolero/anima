/**
 * ScenePreloadManager - Scene preloading and dependency management singleton
 *
 * Central orchestrator for background scene asset preloading.
 * Manages scene dependencies and tracks loading state.
 */

export class ScenePreloadManager {
	private static instance: ScenePreloadManager | null = null;

	// Dependency graph mapping scenes to their dependent scenes
	private dependencyGraph: Record<string, string[]> = {};

	// Track scenes currently loading
	private loadingScenes: Set<string> = new Set();

	// Track which scenes have been fully loaded
	private loadedScenes: Set<string> = new Set();

	// Resolvers waiting for scene load completion
	private waitingResolvers: Map<string, Array<() => void>> = new Map();

	// =============================================================================
	// Singleton
	// =============================================================================

	private constructor() {}

	public static getInstance(): ScenePreloadManager {
		if (!ScenePreloadManager.instance) {
			ScenePreloadManager.instance = new ScenePreloadManager();
		}
		return ScenePreloadManager.instance;
	}

	public static resetInstance(): void {
		ScenePreloadManager.instance = null;
	}

	// =============================================================================
	// Dependency Graph
	// =============================================================================

	/**
	 * Set the scene dependency graph.
	 */
	public setDependencies(graph: Record<string, string[]>): void {
		this.dependencyGraph = graph;
	}

	/**
	 * Get dependencies for a specific scene.
	 * Returns empty array if scene not in graph.
	 */
	public getDependencies(sceneKey: string): string[] {
		return this.dependencyGraph[sceneKey] ?? [];
	}

	/**
	 * Get scenes that should be preloaded from the current scene.
	 */
	public getNextScenesForPreload(currentScene: string): string[] {
		return this.getDependencies(currentScene);
	}

	// =============================================================================
	// Preload State
	// =============================================================================

	/**
	 * Mark a scene as loading.
	 */
	public preloadScene(sceneKey: string): void {
		this.loadingScenes.add(sceneKey);
	}

	/**
	 * Mark a scene as fully loaded.
	 * Removes from loading set and resolves any waiting promises.
	 */
	public markSceneLoaded(sceneKey: string): void {
		this.loadingScenes.delete(sceneKey);
		this.loadedScenes.add(sceneKey);

		// Resolve any waiting promises
		const resolvers = this.waitingResolvers.get(sceneKey);
		if (resolvers) {
			for (const resolve of resolvers) {
				resolve();
			}
			this.waitingResolvers.delete(sceneKey);
		}
	}

	/**
	 * Check if a scene's assets are fully loaded.
	 */
	public isSceneLoaded(sceneKey: string): boolean {
		return this.loadedScenes.has(sceneKey);
	}

	/**
	 * Check if a scene is currently loading.
	 */
	public isSceneLoading(sceneKey: string): boolean {
		return this.loadingScenes.has(sceneKey);
	}

	// =============================================================================
	// Async Waiting
	// =============================================================================

	/**
	 * Wait for a scene's assets to be loaded.
	 * Returns immediately if already loaded.
	 */
	public waitForScene(sceneKey: string): Promise<void> {
		// Already loaded - return immediately
		if (this.isSceneLoaded(sceneKey)) {
			return Promise.resolve();
		}

		// Create promise that will be resolved when scene loads
		return new Promise<void>((resolve) => {
			const resolvers = this.waitingResolvers.get(sceneKey) ?? [];
			resolvers.push(resolve);
			this.waitingResolvers.set(sceneKey, resolvers);
		});
	}

	/**
	 * Wait for a scene with timeout.
	 * Rejects if timeout exceeded.
	 */
	public waitForSceneWithTimeout(
		sceneKey: string,
		timeout: number,
	): Promise<void> {
		// Already loaded - return immediately
		if (this.isSceneLoaded(sceneKey)) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			let resolved = false;

			// Set up timeout
			const timeoutId = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					// Remove resolver from waiting list
					const resolvers = this.waitingResolvers.get(sceneKey);
					if (resolvers) {
						const index = resolvers.indexOf(sceneResolver);
						if (index !== -1) {
							resolvers.splice(index, 1);
						}
						if (resolvers.length === 0) {
							this.waitingResolvers.delete(sceneKey);
						}
					}
					reject(new Error(`Timeout waiting for scene: ${sceneKey}`));
				}
			}, timeout);

			// Create resolver that clears timeout
			const sceneResolver = () => {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeoutId);
					resolve();
				}
			};

			// Add to waiting resolvers
			const resolvers = this.waitingResolvers.get(sceneKey) ?? [];
			resolvers.push(sceneResolver);
			this.waitingResolvers.set(sceneKey, resolvers);
		});
	}

	// =============================================================================
	// Reset
	// =============================================================================

	/**
	 * Reset all state.
	 * Resolves all pending promises before clearing to prevent hanging awaits.
	 */
	public reset(): void {
		// Resolve all pending promises before clearing to prevent hanging awaits
		for (const resolvers of this.waitingResolvers.values()) {
			for (const resolve of resolvers) {
				resolve();
			}
		}

		this.dependencyGraph = {};
		this.loadingScenes.clear();
		this.loadedScenes.clear();
		this.waitingResolvers.clear();
	}

	/**
	 * Cancel a specific scene's pending waits.
	 * Resolves all promises waiting for that scene.
	 */
	public cancelSceneWait(sceneKey: string): void {
		const resolvers = this.waitingResolvers.get(sceneKey);
		if (resolvers) {
			for (const resolve of resolvers) {
				resolve();
			}
			this.waitingResolvers.delete(sceneKey);
		}
	}
}
