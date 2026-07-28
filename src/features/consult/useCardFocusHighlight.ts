import { useCallback, useRef, useState } from "react";
import type { TextInputProps } from "react-native";

type FocusHandler = NonNullable<TextInputProps["onFocus"]>;
type BlurHandler = NonNullable<TextInputProps["onBlur"]>;

/**
 * Tracks focus across multiple fields in one card so the outer border
 * stays highlighted while moving between inputs (no flicker).
 */
export function useCardFocusHighlight() {
  const depth = useRef(0);
  const [highlighted, setHighlighted] = useState(false);

  const onFocus = useCallback<FocusHandler>(() => {
    depth.current += 1;
    setHighlighted(true);
  }, []);

  const onBlur = useCallback<BlurHandler>(() => {
    depth.current = Math.max(0, depth.current - 1);
    queueMicrotask(() => {
      if (depth.current === 0) setHighlighted(false);
    });
  }, []);

  return { highlighted, onFocus, onBlur };
}
