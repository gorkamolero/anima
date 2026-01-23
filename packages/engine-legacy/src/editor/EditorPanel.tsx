import { useCallback, useEffect, useRef, useState } from "react";
import type { SelectedInfo } from "./HotspotEditor";

interface EditorPanelProps {
	visible: boolean;
	selected: SelectedInfo | null;
	onCopySelected: () => void;
	onCopyAll: () => void;
	onClose: () => void;
}

export function EditorPanel({
	visible,
	selected,
	onCopySelected,
	onCopyAll,
	onClose,
}: EditorPanelProps) {
	const [position, setPosition] = useState({ x: 20, y: 20 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
	const [minimized, setMinimized] = useState(false);
	const [copyFeedback, setCopyFeedback] = useState<"selected" | "all" | null>(
		null,
	);
	const panelRef = useRef<HTMLDivElement>(null);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if ((e.target as HTMLElement).closest("button, textarea")) return;
			setIsDragging(true);
			setDragOffset({
				x: e.clientX - position.x,
				y: e.clientY - position.y,
			});
		},
		[position],
	);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging) return;
			setPosition({
				x: e.clientX - dragOffset.x,
				y: e.clientY - dragOffset.y,
			});
		},
		[isDragging, dragOffset],
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	useEffect(() => {
		if (isDragging) {
			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);
			return () => {
				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseup", handleMouseUp);
			};
		}
	}, [isDragging, handleMouseMove, handleMouseUp]);

	const handleCopySelected = useCallback(() => {
		onCopySelected();
		setCopyFeedback("selected");
		setTimeout(() => setCopyFeedback(null), 1500);
	}, [onCopySelected]);

	const handleCopyAll = useCallback(() => {
		onCopyAll();
		setCopyFeedback("all");
		setTimeout(() => setCopyFeedback(null), 1500);
	}, [onCopyAll]);

	if (!visible) return null;

	// Minimized state - tiny bar
	if (minimized) {
		return (
			<div
				ref={panelRef}
				role="toolbar"
				className="fixed z-[1001] select-none"
				style={{
					left: position.x,
					top: position.y,
					cursor: isDragging ? "grabbing" : "grab",
				}}
				onMouseDown={handleMouseDown}
			>
				<div className="flex items-center gap-2 bg-gray-900/95 border border-blue-500/50 rounded px-2 py-1">
					<span className="text-blue-400 text-xs font-mono font-bold">ED</span>
					<button
						type="button"
						onClick={() => setMinimized(false)}
						className="text-blue-400 hover:text-white text-xs"
						title="Expand"
					>
						&#9660;
					</button>
					<button
						type="button"
						onClick={onClose}
						className="text-gray-500 hover:text-white text-xs"
						title="Close"
					>
						&#10005;
					</button>
				</div>
			</div>
		);
	}

	return (
		<div
			ref={panelRef}
			role="toolbar"
			className="fixed z-[1001] select-none"
			style={{
				left: position.x,
				top: position.y,
				cursor: isDragging ? "grabbing" : "grab",
			}}
			onMouseDown={handleMouseDown}
		>
			<div className="w-72 bg-gray-900/95 border border-blue-500/50 rounded-lg shadow-xl font-mono text-xs">
				{/* Header */}
				<div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
					<span className="text-blue-400 font-bold text-sm">EDITOR</span>
					<div className="flex gap-1">
						<button
							type="button"
							onClick={() => setMinimized(true)}
							className="text-gray-400 hover:text-white px-1"
							title="Minimize"
						>
							&#8212;
						</button>
						<button
							type="button"
							onClick={onClose}
							className="text-gray-400 hover:text-white px-1"
							title="Close (E to reopen)"
						>
							&#10005;
						</button>
					</div>
				</div>

				{/* Selected Info */}
				<div className="px-3 py-2 border-b border-gray-700">
					{selected ? (
						<div className="text-white space-y-1">
							<div className="flex justify-between">
								<span className="text-gray-400">id:</span>
								<span className="text-yellow-400 truncate ml-2">
									{selected.id}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-gray-400">pos:</span>
								<span className="text-cyan-400">
									{selected.x}, {selected.y}
								</span>
							</div>
							{selected.width > 0 && (
								<div className="flex justify-between">
									<span className="text-gray-400">size:</span>
									<span className="text-green-400">
										{selected.width}&times;{selected.height}
									</span>
								</div>
							)}
							{selected.scale !== undefined && (
								<div className="flex justify-between">
									<span className="text-gray-400">scale:</span>
									<span className="text-purple-400">{selected.scale}</span>
								</div>
							)}
						</div>
					) : (
						<span className="text-gray-400">Click to select</span>
					)}
				</div>

				{/* JSON Box */}
				<div className="px-2 py-1">
					<textarea
						readOnly
						value={selected?.json || "// No selection"}
						className="w-full h-20 bg-black/50 border border-gray-700 rounded text-green-400 text-[10px] p-2 resize-none font-mono focus:outline-none focus:border-blue-500"
						onClick={(e) => (e.target as HTMLTextAreaElement).select()}
					/>
				</div>

				{/* Buttons */}
				<div className="flex gap-2 px-2 py-1">
					<button
						type="button"
						onClick={handleCopySelected}
						disabled={!selected}
						className={`flex-1 py-1 px-2 rounded text-[10px] font-bold transition-colors ${
							copyFeedback === "selected"
								? "bg-green-600 text-white"
								: selected
									? "bg-blue-600 hover:bg-blue-500 text-white"
									: "bg-gray-700 text-gray-500 cursor-not-allowed"
						}`}
					>
						{copyFeedback === "selected" ? "✓" : "Copy (C)"}
					</button>
					<button
						type="button"
						onClick={handleCopyAll}
						className={`flex-1 py-1 px-2 rounded text-[10px] font-bold transition-colors ${
							copyFeedback === "all"
								? "bg-green-600 text-white"
								: "bg-gray-600 hover:bg-gray-500 text-white"
						}`}
					>
						{copyFeedback === "all" ? "✓" : "All (S)"}
					</button>
				</div>

				{/* Hints */}
				<div className="px-2 py-1 text-[9px] text-gray-500">
					E=toggle | A=add | Del=remove
				</div>
			</div>
		</div>
	);
}
