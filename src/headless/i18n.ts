export function translateText(key: string, params: Record<string, string | number> = {}): string {
    let text = key;
    for (const param in params) {
        text = text.replace(`{${param}}`, String(params[param]));
    }
    return text;
}