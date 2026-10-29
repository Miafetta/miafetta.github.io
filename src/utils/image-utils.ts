import { getImage } from "astro:assets";
import path from "node:path";
import { url } from "./url-utils";

export async function resolveImage(src: string, basePath = "/") {
	if (src.startsWith("/")) return url(src);
	if (src.startsWith("http") || src.startsWith("data:")) return src;

	const files = import.meta.glob<ImageMetadata>(
		"../**/*.{avif,gif,jpeg,jpg,png,svg,webp}",
		{ import: "default" },
	);
	const normalizedPath = path
		.normalize(path.join("../", basePath, src))
		.replace(/\\/g, "/");
	const file = files[normalizedPath];
	if (!file) {
		throw new Error(
			`Image file not found: ${normalizedPath.replace("../", "src/")}`,
		);
	}
	return file();
}

export async function getImageUrl(src: string, site: URL, basePath = "/") {
	const image = await resolveImage(src, basePath);
	const imageSrc =
		typeof image === "string" ? image : (await getImage({ src: image })).src;
	return new URL(imageSrc, site).href;
}
