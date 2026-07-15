'use client';

type Props = {
    prompts: string[];
    onSelect: (prompt: string) => void;
};

export default function StarterPrompts({ prompts, onSelect }: Props) {
    return (
        <div className="flex flex-wrap gap-2 justify-center pt-2">
            {prompts.map((prompt) => (
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
