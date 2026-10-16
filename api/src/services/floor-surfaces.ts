/** Flat floor coverings are support, even when a segmenter names them as props.
 * Keep rolled or hanging textiles out of this vocabulary. */
export function isFloorCovering(label: string): boolean {
	const name = label
		.toLowerCase()
		.replace(/^sized-v1-/, "")
		.replace(/\.clean$/, "")
		.replace(/-\d+$/, "")
		.replaceAll("-", " ")
		.trim();
	return /^(?:(?:floor|area|central|left|right|front|back|large|small|patterned|woven|oriental|persian) )*(?:rugs?|carpets?)$/.test(
		name,
	);
}
