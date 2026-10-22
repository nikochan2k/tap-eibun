// Tailwind は文字列の順序ではなく CSS の定義順で競合を解決するため、
// 同じ性質（余白・文字サイズ）のクラスは変種ごとに分けて持つ
const btnBase =
	"rounded-full border-2 border-line bg-btn font-bold text-fg cursor-pointer shadow-pop-sm transition-all hover:enabled:-translate-y-0.5 hover:enabled:bg-accent hover:enabled:text-white hover:enabled:shadow-pop active:enabled:translate-y-0.5 active:enabled:shadow-none disabled:cursor-not-allowed disabled:opacity-40";

export const btn = `${btnBase} px-5 py-2.5 text-base`;
export const btnSmall = `${btnBase} px-3.5 py-1 text-sm`;
export const btnLevel =
	"rounded-2xl border-2 border-line font-black text-fg cursor-pointer shadow-pop transition-all hover:enabled:-translate-y-1 hover:enabled:rotate-[-2deg] hover:enabled:shadow-[6px_6px_0_var(--color-line)] active:enabled:translate-x-0.5 active:enabled:translate-y-0.5 active:enabled:shadow-none disabled:cursor-not-allowed disabled:opacity-40 flex h-20 items-center justify-center px-2 text-[1.1rem]";

/** 級ボタンの色（順に割り当てる） */
export const levelColors = [
	"bg-[#ffd166]",
	"bg-[#ff9ec7]",
	"bg-[#9be7c4]",
	"bg-[#a5d8ff]",
	"bg-[#d0bfff]",
	"bg-[#ffb48a]",
	"bg-[#b8f28b]",
	"bg-[#ff8fa3]",
];

export const panel = "rounded-3xl border-2 border-line bg-panel p-5 shadow-pop";
