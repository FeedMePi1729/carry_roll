import { useRef, useState } from 'react';

interface UseDragReorderResult {
  dragOverIdx: number | null;
  handleDragStart: (idx: number) => void;
  handleDragOver: (e: React.DragEvent, idx: number) => void;
  handleDrop: (idx: number) => void;
  handleDragEnd: () => void;
}

export function useDragReorder<T>(
  items: T[],
  onReorder: (reordered: T[]) => void,
): UseDragReorderResult {
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    const from = dragIdx.current;
    if (from !== null && from !== idx) {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      onReorder(next);
    }
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  return { dragOverIdx, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}
