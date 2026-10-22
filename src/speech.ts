export function speak(text: string, onEnd?: () => void): void {
	if (!("speechSynthesis" in window)) return;
	speechSynthesis.cancel();
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.lang = "en-US";
	utterance.rate = 0.9;
	if (onEnd) {
		utterance.onend = onEnd;
		utterance.onerror = onEnd;
	}
	speechSynthesis.speak(utterance);
}

export function isSpeaking(): boolean {
	return "speechSynthesis" in window && speechSynthesis.speaking;
}

export function stopSpeaking(): void {
	if ("speechSynthesis" in window) speechSynthesis.cancel();
}
