import { defineCollection, z } from "astro:content";

const createHeadingNumberingSchema = (defaultMode: "H2" | "none") =>
	z.preprocess((value) => {
		if (typeof value !== "string") {
			return value;
		}

		const mode = value.trim().toLowerCase();
		if (mode === "h1") return "H1";
		if (mode === "h2") return "H2";
		if (mode === "roman") return "Roman";
		if (mode === "chinese") return "Chinese";
		if (mode === "none") return "none";

		return value;
	}, z.enum(["H1", "H2", "Roman", "Chinese", "none"]).default(defaultMode));

const headingNumberingSchema = createHeadingNumberingSchema("H2");

const postsCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),
		numbering: headingNumberingSchema,

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});
const specCollection = defineCollection({
	schema: z.object({
		numbering: createHeadingNumberingSchema("none"),
	}),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
};
