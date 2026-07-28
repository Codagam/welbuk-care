import { useState } from "react";
import { Text, TextInput, type TextInputProps, View } from "react-native";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
}

export function TextField({
  label,
  error,
  containerClassName = "",
  labelClassName = "text-neutral-700",
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
      {error ? <Text className="text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
