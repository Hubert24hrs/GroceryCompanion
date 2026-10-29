// Native builds use the keyboard's built-in dictation key (iOS and Android
// keyboards both provide one); a dedicated speech module would require a
// custom dev client. The web build uses the Web Speech API (voice.web.ts).

export const voiceSupported = false;

export function startListening(_onResult: (text: string, final: boolean) => void, _onError: (message: string) => void): () => void {
    return () => undefined;
}
