import { Text } from "react-native";

export interface FieldLabelProps {
  label: string;
  /** Appends a red `*` — use for fields that block submit when empty. */
  required?: boolean;
  /** Appends a muted "(optional)" hint. */
  optional?: boolean;
  className?: string;
}

export function FieldLabel({
  label,
  required = false,
  optional = false,
  className = "text-neutral-700",
}: FieldLabelProps) {
  return (
    <Text
      className={`text-sm font-medium ${className}`}
      accessibilityLabel={required ? `${label}, required` : label}
    >
      {label}
      {required ? <Text className="text-red-500"> *</Text> : null}
      {optional ? (
        <Text className="font-normal text-neutral-400"> (optional)</Text>
      ) : null}
    </Text>
  );
}
