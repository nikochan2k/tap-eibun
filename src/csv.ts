import type { Sentence } from "./types";

/** ダブルクォート対応の簡易 CSV パーサ */
function parseRows(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					cell += '"';
					i++;
				} else {
					quoted = false;
				}
			} else {
				cell += c;
			}
		} else if (c === '"') {
			quoted = true;
		} else if (c === ",") {
			row.push(cell);
			cell = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(cell);
			cell = "";
			rows.push(row);
			row = [];
		} else {
			cell += c;
		}
	}
	if (cell || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}

/** 1行目はヘッダとして読み飛ばす */
export function parseSentences(text: string): Sentence[] {
	const sentences: Sentence[] = [];
	for (const [en, ja] of parseRows(text).slice(1)) {
		if (en?.trim() && ja !== undefined) {
			sentences.push({ en: en.trim(), ja: ja.trim() });
		}
	}
	return sentences;
}
