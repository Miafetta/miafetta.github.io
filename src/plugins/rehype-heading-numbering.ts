import type { Element, ElementContent, Root } from "hast";
import { visit } from "unist-util-visit";

export const headingNumberingModes = [
	"H1",
	"H2",
	"Roman",
	"Chinese",
	"none",
] as const;

export type HeadingNumberingMode = (typeof headingNumberingModes)[number];

export const defaultHeadingNumbering: HeadingNumberingMode = "H2";

const normalizedModeMap: Record<string, HeadingNumberingMode> = {
	h1: "H1",
	h2: "H2",
	roman: "Roman",
	chinese: "Chinese",
	none: "none",
};

export function normalizeHeadingNumbering(
	value: unknown,
	fallback: HeadingNumberingMode = defaultHeadingNumbering,
): HeadingNumberingMode {
	if (typeof value !== "string") {
		return fallback;
	}

	const normalized = normalizedModeMap[value.trim().toLowerCase()];
	return normalized ?? fallback;
}

export function createHeadingNumberer(
	value: unknown,
	fallback: HeadingNumberingMode = defaultHeadingNumbering,
) {
	const mode = normalizeHeadingNumbering(value, fallback);
	const counters = new Array<number>(7).fill(0);

	return {
		mode,
		next(depth: number) {
			if (mode === "none" || depth < 1 || depth > 6) {
				return null;
			}

			const startDepth = mode === "H2" ? 2 : 1;
			if (depth < startDepth) {
				resetCounters(counters, startDepth);
				return null;
			}

			for (let i = startDepth; i < depth; i++) {
				if (counters[i] === 0) {
					counters[i] = 1;
				}
			}

			counters[depth] += 1;
			resetCounters(counters, depth + 1);

			if (mode === "H1" || mode === "H2") {
				return formatDecimalLabel(counters, startDepth, depth);
			}

			if (mode === "Roman") {
				return formatRomanLabel(counters[depth], depth);
			}

			return formatChineseLabel(counters[depth], depth);
		},
	};
}

export function getNumberedHeadingText(text: string, label: string | null) {
	if (!label || hasExistingHeadingNumber(text, label)) {
		return text;
	}

	return `${label} ${text}`;
}

export function rehypeHeadingNumbering() {
	return (
		tree: Root,
		file: {
			path?: string;
			history?: string[];
			data?: { astro?: { frontmatter?: unknown } };
		},
	) => {
		if (!isPostContentFile(file)) {
			return;
		}

		const frontmatter = file.data?.astro?.frontmatter;
		const numbering =
			typeof frontmatter === "object" && frontmatter !== null
				? (frontmatter as { numbering?: unknown }).numbering
				: undefined;
		const numberer = createHeadingNumberer(numbering, "none");

		if (numberer.mode === "none") {
			return;
		}

		visit(tree, "element", (node) => {
			const depth = getHeadingDepth(node);
			if (!depth) {
				return;
			}

			const label = numberer.next(depth);
			if (!label || hasExistingHeadingNumber(toText(node), label)) {
				return;
			}

			addClassName(node, "numbered-heading");
			node.children.unshift(
				{
					type: "element",
					tagName: "span",
					properties: {
						className: ["heading-number"],
						"data-pagefind-ignore": true,
					},
					children: [{ type: "text", value: label }],
				},
				{ type: "text", value: " " },
			);
		});
	};
}

function isPostContentFile(file: { path?: string; history?: string[] }) {
	const filePath = file.path ?? file.history?.[file.history.length - 1] ?? "";
	return filePath.replace(/\\/g, "/").includes("/src/content/posts/");
}

function resetCounters(counters: number[], fromDepth: number) {
	for (let i = fromDepth; i < counters.length; i++) {
		counters[i] = 0;
	}
}

function formatDecimalLabel(
	counters: number[],
	startDepth: number,
	depth: number,
) {
	const label = counters.slice(startDepth, depth + 1).join(".");
	return depth === startDepth ? `${label}.` : label;
}

function formatRomanLabel(count: number, depth: number) {
	switch (depth) {
		case 1:
			return `${toRoman(count)}.`;
		case 2:
			return `${toAlpha(count)}.`;
		case 3:
			return `${count}.`;
		case 4:
			return `${toAlpha(count).toLowerCase()}.`;
		case 5:
			return `(${count}).`;
		case 6:
			return `(${toAlpha(count).toLowerCase()}).`;
		default:
			return "";
	}
}

function formatChineseLabel(count: number, depth: number) {
	switch (depth) {
		case 1:
			return `${toChineseNumber(count)}、`;
		case 2:
			return `（${toChineseNumber(count)}）`;
		case 3:
			return `${count}.`;
		case 4:
			return `（${count}）`;
		case 5:
			return `${count}）`;
		case 6:
			return `${toAlpha(count)}.`;
		default:
			return "";
	}
}

function toRoman(value: number) {
	const pairs: Array<[number, string]> = [
		[1000, "M"],
		[900, "CM"],
		[500, "D"],
		[400, "CD"],
		[100, "C"],
		[90, "XC"],
		[50, "L"],
		[40, "XL"],
		[10, "X"],
		[9, "IX"],
		[5, "V"],
		[4, "IV"],
		[1, "I"],
	];
	let remaining = value;
	let result = "";

	for (const [number, roman] of pairs) {
		while (remaining >= number) {
			result += roman;
			remaining -= number;
		}
	}

	return result;
}

function toAlpha(value: number) {
	let remaining = value;
	let result = "";

	while (remaining > 0) {
		remaining -= 1;
		result = String.fromCharCode(65 + (remaining % 26)) + result;
		remaining = Math.floor(remaining / 26);
	}

	return result;
}

function toChineseNumber(value: number): string {
	const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

	if (value <= 10) {
		return value === 10 ? "十" : digits[value];
	}

	if (value < 100) {
		const tens = Math.floor(value / 10);
		const ones = value % 10;
		return `${tens === 1 ? "" : digits[tens]}十${ones ? digits[ones] : ""}`;
	}

	if (value < 1000) {
		const hundreds = Math.floor(value / 100);
		const rest = value % 100;
		if (rest === 0) {
			return `${digits[hundreds]}百`;
		}
		return `${digits[hundreds]}百${rest < 10 ? "零" : ""}${toChineseNumber(rest)}`;
	}

	return String(value);
}

function getHeadingDepth(node: Element) {
	const match = /^h([1-6])$/.exec(node.tagName);
	return match ? Number.parseInt(match[1], 10) : null;
}

function hasExistingHeadingNumber(text: string, label: string) {
	const trimmed = text.trimStart();
	if (!trimmed.startsWith(label)) {
		return false;
	}

	const nextCharacter = trimmed.charAt(label.length);
	return nextCharacter !== "." && !/[0-9]/.test(nextCharacter);
}

function toText(node: Element | ElementContent): string {
	if (node.type === "text") {
		return node.value;
	}

	if ("children" in node) {
		return node.children.map((child) => toText(child)).join("");
	}

	return "";
}

function addClassName(node: Element, className: string) {
	const current = node.properties.className;
	if (Array.isArray(current)) {
		if (!current.includes(className)) {
			current.push(className);
		}
		return;
	}

	if (typeof current === "string") {
		node.properties.className = current.includes(className)
			? current
			: `${current} ${className}`;
		return;
	}

	node.properties.className = [className];
}
