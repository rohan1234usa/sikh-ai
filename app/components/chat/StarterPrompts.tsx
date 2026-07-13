'use client';

const PROMPTS = [
    'What is Seva, and why is it central to Sikhi?',
    'Explain the meaning of the Mool Mantar',
    "Tell me about Guru Nanak Dev Ji's life",
    'What does Gurbani teach about facing hardship?',
];

export default function StarterPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
    return (
        <div className="flex flex-wrap gap-2 justify-center pt-2">
            {PROMPTS.map((prompt) => (
                <button
                    key={prompt}
                    type="button"
                    onClick={() => onSelect(prompt)}
                    className="border border-kesri/50 text-accent-text text-sm px-4 py-2 rounded-full hover:bg-kesri/10 transition-colors"
                >
                    {prompt}
                </button>
            ))}
        </div>
    );
}
