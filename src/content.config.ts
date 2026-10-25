import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import {
	headingNumberingModes,
	parseHeadingNumbering,
} from "./plugins/rehype-heading-numbering";

const createHeadingNumberingSchema = (defaultMode: "H2" | "none") =>
	z.preprocess(
		(value) => parseHeadingNumbering(value) ?? value,
		z.enum(headingNumberingModes).default(defaultMode),
	);

const headingNumberingSchema = createHeadingNumberingSchema("H2");

const postsCollection = defineCollection({
	loader: glob({ pattern: "*/index.md", base: "./src/content/posts" }),
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
	loader: glob({ pattern: "*.md", base: "./src/content/spec" }),
	schema: z.object({
		numbering: createHeadingNumberingSchema("none"),
	}),
});

export const collections = {
	posts: postsCollection,
	spec: specCollection,
};
