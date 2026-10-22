export type Sentence = {
	en: string;
	ja: string;
};

export type Level = {
	id: string;
	name: string;
	/** CSV 本文を動的に読み込む */
	load: () => Promise<string>;
};

export type SpeechOptions = {
	onSpawn: boolean;
	onClear: boolean;
};

export type Result = {
	score: number;
	clear: number;
};
