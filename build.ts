import tailwind from "bun-plugin-tailwind";

// CLI の `bun build` は bunfig のプラグインを使わないため API 経由でビルドする
const result = await Bun.build({
	entrypoints: ["./index.html"],
	outdir: "dist",
	minify: true,
	splitting: true,
	plugins: [tailwind],
});

if (!result.success) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}
for (const out of result.outputs) console.log(out.path);
