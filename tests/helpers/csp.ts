// A Content-Security-Policy header as a map from each directive to its
// sources, so tests assert exact values rather than match the string.
export const parsePolicy = (policy: string) => new Map(policy.split('; ').map((directive) => {
    const [name, ...sources] = directive.split(' ');
    return [name, sources] as const;
}));
