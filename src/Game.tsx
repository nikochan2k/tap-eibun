import { useEffect, useRef, useState } from "react";
import { isSpeaking, speak, stopSpeaking } from "./speech";
import type { Level, Result, Sentence, SpeechOptions } from "./types";
import { btnSmall } from "./ui";

const MAX_LIFE = 5;
const CLEARED_VISIBLE_MS = 2800;
/** クリア後の読み上げが終わるまで次へ進まない。止まった時のための待ち上限 */
const CLEARED_SPEECH_WAIT_MAX_MS = 15000;

/** 単語ブロックが上端から下端まで落ちる秒数（速度1の時） */
const FALL_SECONDS = 22;
/** 次のブロックが出るまでの秒数（速度1の時） */
const SPAWN_INTERVAL = 0.8;

/** 日本語訳を落下中に表示した時の得点の割合（倍率全体に掛ける） */
const SHOW_JA_RATE = 0.7;

/** 倍率ボーナス。倍率 = 1 + 各ボーナスの合計 */
const COMBO_STEP = 0.1;
const COMBO_MAX_STEPS = 10;
/** 間違えたブロックをタップせずにクリア */
const NO_MISS_BONUS = 0.5;
/** 1単語あたり FAST_SEC_PER_WORD 秒以内で完成させると、早いほど最大 FAST_BONUS まで加算 */
const FAST_SEC_PER_WORD = 3;
const FAST_LIMIT = 0.5;
const FAST_BONUS = 1;
/** 落下速度が標準（×1）を超えた分 × SPEED_BONUS を加算。標準以下は加減なし */
const SPEED_BONUS = 1;

type Bonus = { gain: number; mult: number; combo: number };

/** 倍率が高いほど派手になる演出。min の大きい順 */
const BONUS_TIERS = [
	{ min: 3, label: "PERFECT!!", color: "text-accent", sparks: 14 },
	{ min: 2, label: "AMAZING!", color: "text-ja", sparks: 11 },
	{ min: 1.5, label: "GREAT!", color: "text-ok", sparks: 8 },
	{ min: 1.2, label: "NICE!", color: "text-[#ff9f1c]", sparks: 5 },
];
/** 縁取りと影で大きな文字を目立たせる */
const OUTLINED =
	"[-webkit-text-stroke:2px_var(--color-line)] [paint-order:stroke_fill] [text-shadow:4px_4px_0_var(--color-line)]";
const SPARKLES = ["✨", "⭐", "💖", "🎉"];

function bonusTier(mult: number) {
	return BONUS_TIERS.find((t) => mult >= t.min);
}

/** 倍率を計算する。combo は今回のクリアを含む連続クリア数、pace は所要時間の目安に対する割合 */
function multiplier(
	combo: number,
	noMiss: boolean,
	pace: number,
	speed: number,
): number {
	const comboBonus = Math.min(combo - 1, COMBO_MAX_STEPS) * COMBO_STEP;
	const missBonus = noMiss ? NO_MISS_BONUS : 0;
	const fastBonus =
		pace < FAST_LIMIT ? ((FAST_LIMIT - pace) / FAST_LIMIT) * FAST_BONUS : 0;
	const speedBonus = Math.max(0, speed - 1) * SPEED_BONUS;
	return 1 + comboBonus + missBonus + fastBonus + speedBonus;
}

/** 落下中の単語ブロック。座標は毎フレーム変わるので React state に載せず ref で持つ */
type Block = {
	id: number;
	word: string;
	/** 横位置 0〜1（画面幅に対する割合） */
	x: number;
	/** 0: 上端 → 1: 下端 */
	progress: number;
};

type Status = "playing" | "cleared";

type Round = {
	sentence: Sentence;
	words: string[];
	/** 次にタップすべき単語の番号 */
	next: number;
	/** まだ出現していない単語（出現順） */
	queue: string[];
	blocks: Block[];
	nextSpawn: number;
	startedAt: number;
	status: Status;
	until: number;
	misses: number;
	speed: number;
	bonus?: Bonus;
};

type Engine = {
	deck: Sentence[];
	round: Round | null;
	nextRound: number;
	nextId: number;
	score: number;
	clear: number;
	/** 連続クリア数。ブロックを落とすと0に戻る */
	combo: number;
	life: number;
	ended: boolean;
};

/** 描画に必要な分だけ React state にコピーしたもの */
type View = {
	sentence: Sentence;
	words: string[];
	next: number;
	blocks: { id: number; word: string }[];
	status: Status;
	bonus?: Bonus;
	/** 直前に間違えてタップしたブロック */
	wrongId: number | null;
};

type Props = {
	level: Level;
	sentences: Sentence[];
	speech: SpeechOptions;
	/** 一時停止中（時間が進まず、タップも無効） */
	paused: boolean;
	/** 落下速度の倍率 */
	speed: number;
	/** 落下中も日本語訳を表示する（完成後は常に表示） */
	showJa: boolean;
	onEnd: (result: Result) => void;
	onQuit: () => void;
};

function shuffled<T>(items: T[]): T[] {
	const copy = items.slice();
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const a = copy[i] as T;
		copy[i] = copy[j] as T;
		copy[j] = a;
	}
	return copy;
}

/** 最初の単語を出現順の先頭付近（3番目まで）に置く。他はバラバラ */
const FIRST_WORD_MAX_INDEX = 2;

function earlyFirst(words: string[]): string[] {
	const [first, ...rest] = words;
	const queue = shuffled(rest);
	const at = Math.floor(Math.random() * (FIRST_WORD_MAX_INDEX + 1));
	queue.splice(at, 0, first as string);
	return queue;
}

/** 単語の比較用。大文字小文字と前後の記号は無視する */
function normalize(word: string): string {
	return word.toLowerCase().replace(/[^a-z0-9']/g, "");
}

/** 2連続以上のコンボ。倍率の高低に関わらず目立たせる */
function hasCombo(bonus: Bonus): boolean {
	return bonus.combo >= 2;
}

/** コンボ数に応じた文字の大きさ */
function comboSize(combo: number): string {
	if (combo >= 10) return "text-5xl";
	if (combo >= 5) return "text-4xl";
	return "text-3xl";
}

/** 倍率ボーナスとコンボのお祝い表示。どちらにも当たらない時は出さない */
function BonusPopup({ bonus }: { bonus: Bonus }) {
	const tier = bonusTier(bonus.mult);
	if (!tier && !hasCombo(bonus)) return null;
	const sparks = tier?.sparks ?? Math.min(bonus.combo + 2, 8);
	return (
		<div className="pointer-events-none absolute inset-x-0 top-[30%] z-10 flex justify-center">
			{Array.from({ length: sparks }, (_, i) => {
				const angle = (i / sparks) * Math.PI * 2;
				const dist = 110 + (i % 3) * 40;
				return (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: 固定個数の飾りで並びが変わらない
						key={i}
						className="absolute top-1/2 animate-spark text-3xl"
						style={
							{
								"--dx": `${Math.round(Math.cos(angle) * dist * 1.0)}px`,
								"--dy": `${Math.round(Math.sin(angle) * dist)}px`,
							} as React.CSSProperties
						}
					>
						{SPARKLES[i % SPARKLES.length]}
					</span>
				);
			})}
			<div className="flex animate-pop flex-col items-center">
				{tier && (
					<div
						className={`font-black text-4xl tracking-wide ${OUTLINED} ${tier.color}`}
					>
						{tier.label}
					</div>
				)}
				{hasCombo(bonus) && (
					<div
						className={`font-black tracking-wide ${OUTLINED} text-[#ff7a00] ${comboSize(bonus.combo)}`}
					>
						🔥 {bonus.combo} COMBO!
					</div>
				)}
				<div className="mt-1 rounded-full border-2 border-line bg-[#fff3b0] px-4 py-0.5 font-bold text-xl shadow-pop-sm">
					+{bonus.gain} ×{bonus.mult.toFixed(1)}
				</div>
			</div>
		</div>
	);
}

export function Game({
	level,
	sentences,
	speech,
	paused,
	speed,
	showJa,
	onEnd,
	onQuit,
}: Props) {
	const fieldRef = useRef<HTMLDivElement>(null);
	const blockEls = useRef(new Map<number, HTMLElement>());
	const engine = useRef<Engine>({
		deck: [],
		round: null,
		nextRound: 0,
		nextId: 0,
		score: 0,
		clear: 0,
		combo: 0,
		life: MAX_LIFE,
		ended: false,
	});
	// ループ内から常に最新の props を読むため
	const latest = useRef({ sentences, speech, paused, speed, showJa, onEnd });
	useEffect(() => {
		latest.current = { sentences, speech, paused, speed, showJa, onEnd };
		if (paused) stopSpeaking();
	});
	/** 画面のタップ処理をエンジンへ渡す */
	const tapRef = useRef<(id: number) => void>(() => {});

	const [view, setView] = useState<View | null>(null);
	const [hud, setHud] = useState({
		score: 0,
		clear: 0,
		combo: 0,
		life: MAX_LIFE,
	});

	useEffect(() => {
		const e = engine.current;
		let raf = 0;
		let last = performance.now();
		/** 一時停止中は進まない、ゲーム内の時計（ms） */
		let clock = last;
		let wrongId: number | null = null;
		let wrongTimer = 0;
		e.nextRound = clock + 500;

		const publish = () => {
			const r = e.round;
			setView(
				r && {
					sentence: r.sentence,
					words: r.words,
					next: r.next,
					blocks: r.blocks.map((b) => ({ id: b.id, word: b.word })),
					status: r.status,
					bonus: r.bonus,
					wrongId,
				},
			);
		};
		const publishHud = () =>
			setHud({
				score: e.score,
				clear: e.clear,
				combo: e.combo,
				life: e.life,
			});

		const nextSentence = (): Sentence => {
			if (e.deck.length === 0) e.deck = shuffled(latest.current.sentences);
			return e.deck.pop() as Sentence;
		};

		/** 同じ位置に重ならないよう、直近のブロックから離れた横位置を選ぶ */
		const pickX = (blocks: Block[]): number => {
			const recent = blocks.slice(-2);
			let best = Math.random();
			let bestGap = -1;
			for (let i = 0; i < 6; i++) {
				const x = Math.random();
				const gap = Math.min(1, ...recent.map((b) => Math.abs(b.x - x)));
				if (gap > bestGap) {
					best = x;
					bestGap = gap;
				}
			}
			return best;
		};

		const startRound = (now: number) => {
			const sentence = nextSentence();
			const words = sentence.en.split(/\s+/).filter(Boolean);
			e.round = {
				sentence,
				words,
				next: 0,
				queue: earlyFirst(words),
				blocks: [],
				nextSpawn: now,
				startedAt: now,
				status: "playing",
				until: 0,
				misses: 0,
				speed: latest.current.speed,
			};
			publish();
			if (latest.current.speech.onSpawn) speak(sentence.en);
		};

		/** 1文の完成。スコア加算と読み上げ */
		const clearRound = (r: Round, now: number) => {
			r.status = "cleared";
			r.until = now + CLEARED_VISIBLE_MS;
			r.blocks = [];
			e.clear++;
			e.combo++;
			const base = r.sentence.en.length * 10 + r.words.length * 20;
			const par = (r.words.length * FAST_SEC_PER_WORD) / r.speed;
			const pace = (now - r.startedAt) / 1000 / par;
			const mult =
				multiplier(e.combo, r.misses === 0, pace, r.speed) *
				(latest.current.showJa ? SHOW_JA_RATE : 1);
			const gain = Math.round(base * mult);
			r.bonus = { gain, mult, combo: e.combo };
			e.score += gain;
			publishHud();
			if (latest.current.speech.onClear) speak(r.sentence.en);
		};

		const tap = (id: number) => {
			const r = e.round;
			if (r?.status !== "playing" || e.ended || latest.current.paused) return;
			const block = r.blocks.find((b) => b.id === id);
			if (!block) return;
			if (normalize(block.word) === normalize(r.words[r.next] ?? "")) {
				r.blocks = r.blocks.filter((b) => b.id !== id);
				r.next++;
				if (r.next >= r.words.length) clearRound(r, clock);
			} else {
				r.misses++;
				wrongId = id;
				clearTimeout(wrongTimer);
				wrongTimer = window.setTimeout(() => {
					wrongId = null;
					publish();
				}, 300);
			}
			publish();
		};
		tapRef.current = tap;

		const tick = (frameTime: number) => {
			if (e.ended) return;
			const dt = Math.min((frameTime - last) / 1000, 0.1);
			last = frameTime;
			if (latest.current.paused) {
				raf = requestAnimationFrame(tick);
				return;
			}
			clock += dt * 1000;
			const now = clock;

			const r = e.round;
			if (!r) {
				if (e.life > 0 && now >= e.nextRound) startRound(now);
			} else if (r.status === "playing") {
				let changed = false;
				const spd = r.speed;
				if (r.queue.length > 0 && now >= r.nextSpawn) {
					r.blocks.push({
						id: e.nextId++,
						word: r.queue.shift() as string,
						x: pickX(r.blocks),
						progress: 0,
					});
					r.nextSpawn = now + (SPAWN_INTERVAL / spd) * 1000;
					changed = true;
				}
				for (const b of r.blocks) {
					b.progress += dt / (FALL_SECONDS / spd);
					if (b.progress >= 1) {
						// 落ちたブロックはライフを1つ失って、上から出直す
						b.progress = 0;
						b.x = pickX(r.blocks);
						e.combo = 0;
						e.life--;
						changed = true;
						publishHud();
						if (e.life <= 0) break;
					}
				}
				if (e.life <= 0) {
					e.ended = true;
					latest.current.onEnd({ score: e.score, clear: e.clear });
					return;
				}
				if (changed) publish();
			} else if (
				now >= r.until &&
				// クリア後の読み上げが終わるまで次の文を出さない
				!(isSpeaking() && now < r.until + CLEARED_SPEECH_WAIT_MAX_MS)
			) {
				e.round = null;
				e.nextRound = now + 400;
				publish();
			}

			// 位置は DOM を直接更新（React の再レンダリングを通さない）
			const field = fieldRef.current;
			if (e.round && field) {
				const W = field.clientWidth;
				const H = field.clientHeight;
				for (const b of e.round.blocks) {
					const el = blockEls.current.get(b.id);
					if (!el) continue;
					const x = b.x * Math.max(0, W - el.offsetWidth);
					const y = b.progress * Math.max(0, H - el.offsetHeight);
					el.style.transform = `translate(${x}px, ${y}px)`;
					el.style.opacity = String(Math.min(1, b.progress / 0.04));
				}
			}
			raf = requestAnimationFrame(tick);
		};

		raf = requestAnimationFrame(tick);
		return () => {
			e.ended = true;
			clearTimeout(wrongTimer);
			cancelAnimationFrame(raf);
			stopSpeaking();
		};
	}, []);

	const celebrated =
		view?.bonus && (bonusTier(view.bonus.mult) || hasCombo(view.bonus));

	return (
		<section className="flex min-h-0 flex-1 flex-col gap-1.5">
			<div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-sm text-muted">
				<span>
					級: <b>{level.name}</b>
				</span>
				<span>
					スコア: <b>{hud.score}</b>
				</span>
				<span>
					コンボ:{" "}
					<b
						className={
							hud.combo >= 2 ? "text-lg text-[#ff7a00]" : "text-accent"
						}
					>
						{hud.combo >= 2 && "🔥"}
						{hud.combo}
					</b>
				</span>
				<button type="button" className={btnSmall} onClick={onQuit}>
					やめる
				</button>
			</div>
			<div className="flex items-center justify-between text-sm text-muted">
				<span>
					クリア: <b>{hud.clear}</b>
				</span>
				<b className="text-ng">
					{"♥".repeat(hud.life) + "♡".repeat(MAX_LIFE - hud.life)}
				</b>
			</div>

			<div className="flex min-h-12 items-center justify-center rounded-2xl border-2 border-line bg-white px-3 py-1.5 text-center text-base text-ja">
				{view && (showJa || view.status === "cleared") && view.sentence.ja}
			</div>

			<div
				className={`flex min-h-16 flex-wrap content-start items-center gap-x-2 gap-y-1 rounded-2xl border-2 px-3 py-2 font-mono text-lg font-semibold ${celebrated ? "border-line bg-[#fff3b0]" : view?.status === "cleared" ? "border-ok bg-[#e6fff3]" : "border-line bg-white"}`}
			>
				{view?.words.map((w, i) =>
					i < view.next ? (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: 同じ単語が重複しうる固定の並び
							key={i}
							className="text-ok"
						>
							{w}
						</span>
					) : (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: 同じ単語が重複しうる固定の並び
							key={i}
							className={
								i === view.next && view.status === "playing"
									? "border-b-4 border-accent text-transparent"
									: "border-b-2 border-muted/40 text-transparent"
							}
						>
							{w}
						</span>
					),
				)}
				{view?.bonus && (
					<span className="ml-auto text-sm font-bold text-ok">
						+{view.bonus.gain}（×{view.bonus.mult.toFixed(1)}
						{view.bonus.combo > 1 && ` / ${view.bonus.combo}コンボ`}）
					</span>
				)}
			</div>

			<div
				ref={fieldRef}
				className="relative min-h-0 flex-1 touch-manipulation select-none overflow-hidden rounded-3xl border-2 border-line bg-linear-to-b from-[#bde7ff] via-[#e3d4ff] to-[#ffd6e8] shadow-pop"
			>
				{view?.blocks.map((b) => (
					<button
						key={b.id}
						type="button"
						ref={(el) => {
							if (el) blockEls.current.set(b.id, el);
							else blockEls.current.delete(b.id);
						}}
						onPointerDown={(ev) => {
							ev.preventDefault();
							tapRef.current(b.id);
						}}
						className={`absolute top-0 left-0 cursor-pointer rounded-2xl border-2 px-3.5 py-2 font-mono text-xl font-semibold whitespace-nowrap opacity-0 shadow-pop-sm ${view.wrongId === b.id ? "border-ng bg-[#ffe9ed]" : "border-line bg-white"}`}
					>
						{b.word}
					</button>
				))}
				{view?.bonus && (
					<BonusPopup key={view.sentence.en} bonus={view.bonus} />
				)}
				<div className="absolute inset-x-0 bottom-0 h-1.5 bg-ng" />
			</div>
			<p className="text-xs text-muted">
				落ちてくる単語を、英文の順番にタップ。
			</p>
		</section>
	);
}
