import { useCallback, useRef, useState } from "react";
import type {
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from "react-native";

type FocusEvent = NativeSyntheticEvent<TextInputFocusEventData>;

/**
 * Tracks focus across multiple fields in one card so the outer border
 * stays highlighted while moving between inputs (no flicker).
 */
export function useCardFocusHighlight() {
  const depth = useRef(0);
  const [highlighted, setHighlighted] = useState(false);

  const onFocus = useCallback((_e?: FocusEvent) => {
    depth.current += 1;
    setHighlighted(true);
  }, []);

  const onBlur = useCallback((_e?: FocusEvent) => {
    depth.current = Math.max(0, depth.current - 1);
    queueMicrotask(() => {
      if (depth.current === 0) setHighlighted(false);
    });
  }, []);

  return { highlighted, onFocus, onBlur };
}
