'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Code2 } from 'lucide-react';
import type { Person } from '@/lib/types';
import { githubAvatar } from '@/lib/presentation';
import { cn } from '@/lib/utils';

export function ContributorAvatar({ person }: { person: Person }) {
  const source = githubAvatar(person);
  const [failedSource, setFailedSource] = useState<string>();
  return (
    <span className={cn('person-mark', person.bot && 'bot-mark')} aria-hidden="true">
      {source && source !== failedSource ? (
        <Image
          src={source}
          alt=""
          width={48}
          height={48}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailedSource(source)}
        />
      ) : person.bot ? (
        <Code2 size={17} />
      ) : (
        person.name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
