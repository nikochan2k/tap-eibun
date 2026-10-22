import type { Level, SpeechOptions } from "./types";
import { btnLevel, levelColors, panel } from "./ui";

type Props = {
	levels: Level[];
	speech: SpeechOptions;
	onSpeechChange: (speech: SpeechOptions) => void;
	speed: number;
	onSpeedChange: (speed: number) => void;
	showJa: boolean;
	onShowJaChange: (show: boolean) => void;
	loading: boolean;
	onStart: (level: Level) => void;
};

export function Menu({
	levels,
	speech,
	onSpeechChange,
	speed,
	onSpeedChange,
	showJa,
	onShowJaChange,
	loading,
	onStart,
}: Props) {
	return (
		<section className={`${panel} min-h-0 overflow-y-auto`}>
			<p>
				英検の級を選んでスタート。バラバラに落ちてくる単語を順番にタップして英文を完成させよう。
			</p>
			<div className="my-3 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
				{levels.map((level, i) => (
					<button
						key={level.id}
						type="button"
						className={`${btnLevel} ${levelColors[i % levelColors.length]}`}
						disabled={loading}
						onClick={() => onStart(level)}
					>
						英検{level.name}
					</button>
				))}
			</div>
			<div>
				<label className="mr-4 inline-flex items-center gap-1.5 text-sm text-muted">
					<input
						type="checkbox"
						checked={speech.onSpawn}
						onChange={(e) =>
							onSpeechChange({ ...speech, onSpawn: e.target.checked })
						}
					/>
					英文を読み上げる
				</label>
				<label className="mr-4 inline-flex items-center gap-1.5 text-sm text-muted">
					<input
						type="checkbox"
						checked={speech.onClear}
						onChange={(e) =>
							onSpeechChange({ ...speech, onClear: e.target.checked })
						}
					/>
					完成時も読み上げる
				</label>
				<label className="mr-4 inline-flex items-center gap-1.5 text-sm text-muted">
					<input
						type="checkbox"
						checked={showJa}
						onChange={(e) => onShowJaChange(e.target.checked)}
					/>
					日本語訳を落下中に表示
				</label>
				<label className="mt-2 flex items-center gap-2 text-sm text-muted">
					落下速度:
					<input
						type="range"
						min={0.5}
						max={2}
						step={0.25}
						value={speed}
						onChange={(e) => onSpeedChange(Number(e.target.value))}
					/>
					<b>×{speed}</b>
				</label>
			</div>
		</section>
	);
}
