import { useEffect, useState } from "react";
import { parseSentences } from "./csv";
import { Game } from "./Game";
import { LEVELS } from "./levels";
import { Menu } from "./Menu";
import type { Level, Result, Sentence, SpeechOptions } from "./types";
import { btn, panel } from "./ui";

type Screen =
	| { name: "menu" }
	| { name: "game"; level: Level; sentences: Sentence[] }
	| { name: "over"; level: Level; sentences: Sentence[]; result: Result };

const PHONE_PORTRAIT = "(orientation: portrait) and (max-width: 820px)";

/** スマホ縦（縦向きで幅が狭い）かどうか */
function usePhonePortrait(): boolean {
	const [ok, setOk] = useState(() => matchMedia(PHONE_PORTRAIT).matches);
	useEffect(() => {
		const mq = matchMedia(PHONE_PORTRAIT);
		const onChange = () => setOk(mq.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return ok;
}

export function App() {
	const portrait = usePhonePortrait();
	const [screen, setScreen] = useState<Screen>({ name: "menu" });
	const [speech, setSpeech] = useState<SpeechOptions>({
		onSpawn: true,
		onClear: true,
	});

	const [speed, setSpeed] = useState(1);
	const [showJa, setShowJa] = useState(true);

	const [loading, setLoading] = useState(false);

	const start = async (level: Level) => {
		if (loading) return;
		setLoading(true);
		try {
			const sentences = parseSentences(await level.load());
			if (sentences.length === 0) return;
			setScreen({ name: "game", level, sentences });
		} catch {
			alert("英文データの読み込みに失敗しました");
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="mx-auto flex h-dvh max-w-md flex-col gap-2 p-3">
			{!portrait && (
				<div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
					<div className="text-5xl">📱</div>
					<p className="text-xl font-black">
						スマホを縦向きにして遊んでください
					</p>
					<p className="text-sm text-muted">
						{screen.name === "game"
							? "ゲームは一時停止中です。縦にすると再開します。"
							: "このゲームはスマホ縦画面専用です。"}
					</p>
				</div>
			)}
			{screen.name !== "game" && (
				<h1 className="mt-1 text-[1.6rem] font-black tracking-wide text-fg [text-shadow:3px_3px_0_var(--color-accent)]">
					タップ英文
				</h1>
			)}

			{screen.name === "menu" && (
				<Menu
					levels={LEVELS}
					speech={speech}
					onSpeechChange={setSpeech}
					speed={speed}
					onSpeedChange={setSpeed}
					showJa={showJa}
					onShowJaChange={setShowJa}
					loading={loading}
					onStart={start}
				/>
			)}

			{screen.name === "game" && (
				<Game
					level={screen.level}
					sentences={screen.sentences}
					speech={speech}
					paused={!portrait}
					speed={speed}
					showJa={showJa}
					onEnd={(result) => setScreen({ ...screen, name: "over", result })}
					onQuit={() => setScreen({ name: "menu" })}
				/>
			)}

			{screen.name === "over" && (
				<section className={`${panel} text-center`}>
					<h2 className="mb-2 text-xl font-bold">ゲームオーバー</h2>
					<p>
						スコア: <b>{screen.result.score}</b> / クリア文数:{" "}
						<b>{screen.result.clear}</b>
					</p>
					<div className="mt-3 flex flex-wrap justify-center gap-2.5">
						<button
							type="button"
							className={btn}
							onClick={() => start(screen.level)}
						>
							もう一度
						</button>
						<button
							type="button"
							className={btn}
							onClick={() => setScreen({ name: "menu" })}
						>
							級選択へ
						</button>
					</div>
				</section>
			)}
		</main>
	);
}
