import type { Level } from "./types";

// 新しい級を足すときは data/ に CSV を置き、ここに追加する
// import() は押下時に別チャンクとして読み込まれる（バンドルには含まれない）
export const LEVELS: Level[] = [
	{
		id: "grade5",
		name: "5級",
		load: () =>
			import("./data/grade5.csv", { with: { type: "text" } }).then(
				(m) => m.default,
			),
	},
	{
		id: "grade4",
		name: "4級",
		load: () =>
			import("./data/grade4.csv", { with: { type: "text" } }).then(
				(m) => m.default,
			),
	},
	{
		id: "grade3",
		name: "3級",
		load: () =>
			import("./data/grade3.csv", { with: { type: "text" } }).then(
				(m) => m.default,
			),
	},
	{
		id: "gradepre2",
		name: "準2級",
		load: () =>
			import("./data/gradepre2.csv", { with: { type: "text" } }).then(
				(m) => m.default,
			),
	},
	{
		id: "gradepre2plus",
		name: "準2級プラス",
		load: () =>
			import("./data/gradepre2plus.csv", { with: { type: "text" } }).then(
				(m) => m.default,
			),
	},
	{
		id: "grade2",
		name: "2級",
		load: () =>
			import("./data/grade2.csv", { with: { type: "text" } }).then(
				(m) => m.default,
			),
	},
	{
		id: "gradepre1",
		name: "準1級",
		load: () =>
			import("./data/gradepre1.csv", { with: { type: "text" } }).then(
				(m) => m.default,
			),
	},
	{
		id: "grade1",
		name: "1級",
		load: () =>
			import("./data/grade1.csv", { with: { type: "text" } }).then(
				(m) => m.default,
			),
	},
];
