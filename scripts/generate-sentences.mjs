// 英検各級の英文を claude -p (haiku) で生成し src/data/*.csv に追加する。
// 使い方: node scripts/generate-sentences.mjs [目標数=500] [級ID...]（級ID省略時は全級）
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);
const TARGET = Number(process.argv[2] ?? 500);
const ONLY = process.argv.slice(3);
const BATCH = 100;
const MAX_FAILS = 8;

const GRADES = {
	grade5:
		"英検5級(中学初級。be動詞・一般動詞の現在形/過去形、can、簡単な疑問文。5〜9語)",
	grade4:
		"英検4級(中学中級。過去形・未来形・助動詞・比較・不定詞・動名詞。6〜11語)",
	grade3:
		"英検3級(中学卒業程度。現在完了・受動態・関係代名詞・間接疑問。8〜14語)",
	gradepre2:
		"英検準2級(高校中級。分詞構文・仮定法基礎・やや抽象的な話題。10〜16語)",
	gradepre2plus:
		"英検準2級プラス(準2級と2級の中間。関係詞・分詞・受動態の応用・仮定法基礎、社会的な話題。11〜18語)",
	grade2:
		"英検2級(高校卒業程度。社会・環境・技術などの話題、複雑な構文。12〜20語)",
	gradepre1:
		"英検準1級(大学中級。時事・科学・経済などの語彙、論説調。14〜22語)",
	grade1: "英検1級(大学上級。高度な語彙・仮定法・倒置・格式ある文体。16〜26語)",
};

const THEMES = [
	"学校",
	"家族",
	"旅行",
	"食事",
	"スポーツ",
	"天気",
	"買い物",
	"健康",
	"仕事",
	"科学",
	"環境",
	"歴史",
	"音楽",
	"動物",
	"技術",
	"経済",
	"政治",
	"芸術",
	"趣味",
	"交通",
	"友情",
	"自然",
	"文化",
	"医療",
	"教育",
	"都市生活",
	"ニュース",
	"感情",
	"日常会話",
	"ビジネス",
];

function parseCsv(text) {
	const rows = [];
	let row = [],
		cur = "",
		q = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (q) {
			if (c === '"' && text[i + 1] === '"') {
				cur += '"';
				i++;
			} else if (c === '"') q = false;
			else cur += c;
		} else if (c === '"') q = true;
		else if (c === ",") {
			row.push(cur);
			cur = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(cur);
			cur = "";
			if (row.some((v) => v !== "")) rows.push(row);
			row = [];
		} else cur += c;
	}
	if (cur !== "" || row.length) {
		row.push(cur);
		rows.push(row);
	}
	return rows;
}

const esc = (s) => (/[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
const key = (en) => en.toLowerCase().replace(/\s+/g, " ").trim();
const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

function extractJson(out) {
	const m = out.match(/\[[\s\S]*\]/);
	if (!m) throw new Error("JSON配列なし");
	const arr = JSON.parse(m[0]);
	return arr
		.filter((x) => x && typeof x.en === "string" && typeof x.ja === "string")
		.map((x) => ({ en: x.en.trim(), ja: x.ja.trim() }))
		.filter((x) => x.en && x.ja);
}

async function generate(grade, items) {
	const themes = pick(THEMES, 5).join("、");
	const examples = pick(items, 5)
		.map((x) => x.en)
		.join(" / ");
	const prompt = `${GRADES[grade]}レベルの英文と自然な日本語訳のペアを${BATCH}個作成せよ。
- 話題の例: ${themes}（これ以外も混ぜて多様に）
- 既存文と被らないこと。既存例: ${examples}
- 1文のみ(ピリオド等で終わる)、タイピングゲーム用なので英文にカンマや引用符はなるべく使わない
- 出力は JSON 配列のみ。説明・コードフェンス不要。形式: [{"en":"...","ja":"..."}]`;
	const { stdout } = await run(
		"claude",
		["-p", prompt, "--model", "haiku", "--tools", ""],
		{ maxBuffer: 10 * 1024 * 1024, timeout: 300_000 },
	);
	return extractJson(stdout);
}

async function fill(grade) {
	const file = new URL(`../src/data/${grade}.csv`, import.meta.url);
	// 新しい級は CSV がまだ無い
	const rows = existsSync(file)
		? parseCsv(readFileSync(file, "utf8")).slice(1)
		: [];
	const items = rows.map(([en, ja]) => ({ en, ja }));
	const seen = new Set();
	const uniq = items.filter((x) => !seen.has(key(x.en)) && seen.add(key(x.en)));
	const save = () =>
		writeFileSync(
			file,
			"en,ja\n" +
				uniq.map((x) => `${esc(x.en)},${esc(x.ja)}`).join("\n") +
				"\n",
		);
	save();

	let fails = 0;
	while (uniq.length < TARGET && fails < MAX_FAILS) {
		try {
			const got = await generate(grade, uniq);
			let added = 0;
			for (const x of got) {
				if (uniq.length >= TARGET) break;
				if (seen.has(key(x.en))) continue;
				seen.add(key(x.en));
				uniq.push(x);
				added++;
			}
			save();
			console.log(
				`${grade}: +${added} (生成${got.length}) → ${uniq.length}/${TARGET}`,
			);
			if (added === 0) fails++;
		} catch (e) {
			fails++;
			console.error(
				`${grade}: 失敗 ${fails}/${MAX_FAILS}: ${e.message.slice(0, 200)}`,
			);
		}
	}
	return uniq.length;
}

const results = await Promise.all(
	Object.keys(GRADES)
		.filter((g) => ONLY.length === 0 || ONLY.includes(g))
		.map(async (g) => [g, await fill(g)]),
);
for (const [g, n] of results) console.log(`${g}: ${n}`);
process.exit(results.every(([, n]) => n >= TARGET) ? 0 : 1);
