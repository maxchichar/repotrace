import type { Person } from './types';

export function withoutEmDash(text: string) {
  return text.replace(/\s*\u2014\s*/g, ', ');
}

// Numeric account IDs survive login changes and work for previously saved reports.
// Never infer an avatar from a display name or an unresolved identity.
export function githubAvatar(person: Pick<Person, 'id' | 'identity'>) {
  const id = /^gh:([1-9]\d*)$/.exec(person.id)?.[1];
  return person.identity === 'github-account' && id
    ? `https://avatars.githubusercontent.com/u/${id}?s=96`
    : undefined;
}
