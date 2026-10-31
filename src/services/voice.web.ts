type Recognition = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
};

const Ctor: (new () => Recognition) | undefined =
    typeof window !== 'undefined' ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;

export const voiceSupported = Boolean(Ctor);

/** Dictate grocery items ("milk, two pounds of chicken and bananas"). Returns a stop function. */
export function startListening(onResult: (text: string, final: boolean) => void, onError: (message: string) => void): () => void {
    if (!Ctor) {
        onError('Voice entry is not supported in this browser.');
        return () => undefined;
    }
    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = e => {
        let text = '';
        let final = false;
        for (let i = 0; i < e.results.length; i++) {
            text += e.results[i][0].transcript;
            final = e.results[i].isFinal;
        }
        onResult(text.trim(), final);
    };
    rec.onerror = e => onError(e.error === 'not-allowed' ? 'Microphone permission was denied.' : `Voice entry stopped (${e.error}).`);
    rec.start();
    return () => rec.stop();
}
