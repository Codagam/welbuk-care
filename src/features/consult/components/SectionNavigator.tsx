import { Pressable, ScrollView, Text, View } from "react-native";

import type { SectionNavItem } from "../sectionIds";

type Props = {
  sections: SectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
};

/**
 * Top section rail — mirrors Practice SectionNavigator labels.
 * Tapping a chip scrolls the consult page to that section header.
 */
export function SectionNavigator({ sections, activeId, onSelect }: Props) {
  return (
    <View className="border-b border-neutral-200 bg-white">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
          alignItems: "center",
          flexGrow: 1,
        }}
      >
        {sections.map((s) => {
          const isActive = s.id === activeId;
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(s.id)}
              accessibilityRole="button"
              accessibilityLabel={`Go to ${s.label}`}
              style={{ flexShrink: 0 }}
              className={`rounded-full px-4 py-2.5 ${
                isActive ? "bg-brand" : "bg-neutral-100"
              }`}
            >
              <Text
                numberOfLines={1}
                className={`text-sm font-medium ${
                  isActive ? "text-brand-foreground" : "text-neutral-600"
                }`}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
