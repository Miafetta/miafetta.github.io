import type { Favicon } from "@/types/config.ts";

export const defaultFavicons: Favicon[] = [
	{ src: "/favicon.ico", sizes: "16x16 32x32 48x48" },
	{ src: "/favicon/favicon.svg", sizes: "any" },
	{ src: "/favicon/favicon-32x32.png", sizes: "32x32" },
	{ src: "/favicon/favicon-16x16.png", sizes: "16x16" },
	{ src: "/favicon/favicon-192x192.png", sizes: "192x192" },
];
