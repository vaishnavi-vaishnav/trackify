import { useEffect, useState } from "react";

/**
 * Trails `value` by `delay` ms.
 *
 * Search boxes drive server queries, and firing one per keystroke turns a
 * six-letter name into six round trips whose responses can land out of order.
 * Debouncing the value the query depends on means one request per pause.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
