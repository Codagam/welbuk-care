import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "md" | "lg";

const CONTAINER: Record<Variant, string> = {
  primary: "bg-brand active:bg-brand-600",
  outline: "border border-neutral-300 bg-white active:bg-neutral-50",
  ghost: "bg-transparent active:bg-neutral-100",
  danger: "bg-red-600 active:bg-red-700",
};

const LABEL: Record<Variant, string> = {
  primary: "text-brand-foreground",
  outline: "text-neutral-900",
  ghost: "text-neutral-900",
  danger: "text-white",
};

const SIZE: Record<Size, string> = {
  md: "px-4 py-2.5",
  lg: "px-5 py-3.5",
};

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  icon,
  className = "",
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const spinnerColor =
    variant === "primary" || variant === "danger" ? "#fff" : "#111827";
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={{ flexShrink: 0 }}
      className={`flex-row items-center justify-center gap-2 rounded-xl ${SIZE[size]} ${CONTAINER[variant]} ${isDisabled ? "opacity-50" : ""} ${className}`}
    >
      {loading ? <ActivityIndicator color={spinnerColor} /> : icon}
      <Text
        numberOfLines={1}
        className={`shrink-0 text-base font-semibold ${LABEL[variant]}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
