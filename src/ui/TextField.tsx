import { Text, TextInput, type TextInputProps, View } from "react-native";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export function TextField({
  label,
  error,
  containerClassName = "",
  ...props
}: TextFieldProps) {
  return (
    <View className={`gap-1.5 ${containerClassName}`}>
      {label ? (
        <Text className="text-sm font-medium text-neutral-700">{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor="#9ca3af"
        className={`rounded-xl border bg-white px-4 py-3 text-base text-neutral-900 ${
          error ? "border-red-400" : "border-neutral-300"
        }`}
        {...props}
      />
      {error ? <Text className="text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
