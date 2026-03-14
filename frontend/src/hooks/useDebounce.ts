import { useRef, useCallback } from 'react';
import debounce from 'lodash.debounce';

export function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number = 300) {
  const ref = useRef(fn);
  ref.current = fn;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(debounce((...args: Parameters<T>) => ref.current(...args), delay), [delay]);
}
