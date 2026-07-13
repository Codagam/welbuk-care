import { Pressable, Text, View } from "react-native";

export interface SegmentedProps<T extends string> {
  options: readonly T[];
  value: T | "";
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  className = "",
}: SegmentedProps<T>) {
  return (
    <View
      className={`flex-row rounded-xl border border-neutral-300 bg-white p-1 ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            disabled={disabled}
            onPress={() => onChange(opt)}
            className={`flex-1 items-center rounded-lg py-2 ${
              active ? "bg-brand" : "bg-transparent"
            }`}
          >
            <Text
              numberOfLines={1}
              className={`px-0.5 text-center text-xs font-medium ${
                active ? "text-brand-foreground" : "text-neutral-600"
              }`}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
