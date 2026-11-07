'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ReferenceRange } from '../forward-reference';
import { boundedSelection } from '../review-workflow';

type ReviewTimeline = {
  start: number; setStart: (value: number) => void;
  windowSize: number; setWindowSize: (value: number) => void;
  selection: ReferenceRange; setSelection: (value: ReferenceRange) => void;
  cursor: number; setCursor: (value: number) => void;
};
const Context = createContext<ReviewTimeline | null>(null);
export function ReviewTimelineProvider({ duration, children }: { duration: number; children: ReactNode }) {
  const [start, setStart] = useState(0), [windowSize, setWindowSize] = useState(30000);
  const [selection, setSelection] = useState<ReferenceRange>([0, Math.min(duration, 30000)]), [cursor, setCursor] = useState(0);
  return <Context.Provider value={{ start, setStart, windowSize, setWindowSize, selection, setSelection, cursor, setCursor }}>{children}</Context.Provider>;
}
export const useReviewTimeline = () => useContext(Context);
export function useReviewSelection(bounds: ReferenceRange) {
  const shared = useReviewTimeline();
  const [localSelection, setLocalSelection] = useState<ReferenceRange>(bounds), [localCursor, setLocalCursor] = useState(bounds[0]);
  return {
    selection: boundedSelection(shared?.selection ?? localSelection, bounds), setSelection: shared?.setSelection ?? setLocalSelection,
    cursor: Math.max(bounds[0], Math.min(bounds[1], shared?.cursor ?? localCursor)), setCursor: shared?.setCursor ?? setLocalCursor,
  };
}
