import { useState, type ReactNode } from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
  /** Renders inside the field on the right (e.g. password visibility toggle). */
  rightAccessory?: ReactNode;
}

export function TextField({
  label,
  error,
  containerClassName = "",
  labelClassName = "text-neutral-700",
  rightAccessory,
  multiline,
  style,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  const borderClass = error
    ? "border-red-400"
    : focused
      ? "border-brand"
      : "border-neutral-300";

  return (
    <View className={`gap-1.5 ${containerClassName}`}>
      {label ? (
        <Text className={`text-sm font-medium ${labelClassName}`}>{label}</Text>
      ) : null}
      <View className="relative justify-center">
        <TextInput
          placeholderTextColor="#9ca3af"
          multiline={multiline}
          className={`rounded-xl border bg-white px-4 text-base text-neutral-900 ${
            multiline ? "py-3" : "h-12"
          } ${borderClass}`}
          style={[
            multiline
              ? { textAlignVertical: "top" }
              : {
                  height: 48,
                  minHeight: 48,
                  textAlignVertical: "center",
                  paddingVertical: 0,
                },
            rightAccessory ? { paddingRight: 48 } : null,
            style,
          ]}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {rightAccessory ? (
          <View className="absolute right-3 top-0 bottom-0 items-center justify-center">
            {rightAccessory}
          </View>
        ) : null}
      </View>
      {error ? <Text className="text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
