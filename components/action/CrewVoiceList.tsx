'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { formatRelative } from '@/lib/utils/date';
import type { ActionResultData } from '@/lib/types/view';

export function CrewVoiceList({
  voices,
}: {
  voices: ActionResultData['crewVoices'];
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = voices.length > 2;
  const visibleVoices = expanded ? voices : voices.slice(0, 2);

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visibleVoices.map((voice) => (
          <li
            key={voice.id}
            className="flex gap-3 rounded-xl border border-neutral-200 p-4"
          >
            <Avatar name={voice.author.nickname} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-label font-semibold text-neutral-900">
                  @{voice.author.nickname}
                </span>
                <span className="text-caption text-neutral-400">
                  {formatRelative(voice.createdAt)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-label leading-relaxed text-neutral-700">
                {voice.content}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {canExpand && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="self-center rounded-full px-4 py-2 text-label font-semibold text-neutral-600 hover:bg-neutral-50"
        >
          {expanded ? '접기' : '+ 더보기'}
        </button>
      )}
    </>
  );
}
