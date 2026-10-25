import path from "node:path";
import { slug } from "github-slugger";

// Front Matter wraps arguments in single quotes even when using Windows cmd.exe.
const args = process.argv.slice(2);
const quoted = args[0]?.startsWith("'")
    ? /^'.*?' '(.*?)' '(.*)'$/.exec(args.join(" "))
    : null;
const filePath = quoted?.[1] ?? args[1];
if (!filePath) throw new Error("Front Matter must provide the current article path.");
const postName = path.posix.basename(path.posix.dirname(filePath.replace(/\\/g, "/")));
process.stdout.write(`posts/${slug(postName)}`);
