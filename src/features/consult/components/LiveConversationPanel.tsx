import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/ui";
import { describeError } from "@/lib/api/errors";
import { useConversation } from "../hooks";
import type { ConversationMessage } from "../types";

/**
 * Web-parity Live Conversation: load messages + local mic recording flag.
 * Mic does not stream/POST (matches Practice web).
 */
export function LiveConversationPanel({
  consultationId,
}: {
  consultationId: string;
}) {
  const q = useConversation(consultationId);
  const [isRecording, setIsRecording] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  const messages: ConversationMessage[] = q.data ?? [];

  const handleSummarize = () => {
    const fullText = messages
      .map(
        (msg) =>
          `${msg.speaker === "doctor" ? "Doctor" : "Patient"}: ${msg.text}`
      )
      .join("\n\n");
    setSummaryText(fullText);
  };

  return (
    <View className="min-h-[300px] overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <View className="flex-row items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <View className="flex-row items-center gap-2">
          <Ionicons name="mic-outline" size={16} color="#6b7280" />
          <Text className="text-sm font-semibold text-neutral-900">
            Live Conversation
          </Text>
        </View>
        {isRecording ? (
          <View className="flex-row items-center gap-2 rounded-full bg-neutral-100 px-2 py-1">
            <View className="h-2 w-2 rounded-full bg-red-600" />
            <Text className="text-sm font-medium text-red-600">Recording</Text>
          </View>
        ) : null}
      </View>

      {q.isLoading ? (
        <View className="items-center justify-center py-16">
          <ActivityIndicator color="#FD006A" />
        </View>
      ) : q.isError ? (
        <View className="items-center px-4 py-10">
          <Text className="text-center text-sm text-red-500">
            {describeError(q.error)}
          </Text>
        </View>
      ) : messages.length === 0 ? (
        <View className="items-center justify-center gap-4 px-4 py-12">
          <Pressable
            onPress={() => setIsRecording((v) => !v)}
            className={`h-24 w-24 items-center justify-center rounded-full ${
              isRecording ? "bg-red-600" : "bg-brand"
            }`}
            accessibilityLabel="Start consultation"
          >
            <Ionicons name="mic" size={40} color="#fff" />
          </Pressable>
          <Text className="max-w-xs text-center text-sm text-neutral-500">
            No conversation yet. Click the mic button to start consult.
          </Text>
        </View>
      ) : (
        <View className="min-h-[280px]">
          <ScrollView
            className="max-h-72"
            contentContainerStyle={{ padding: 12, gap: 8 }}
          >
            {messages.map((msg, index) => {
              const isDoctor = msg.speaker === "doctor";
              const isLast =
                index === messages.length - 1 ||
                messages[index + 1]?.speaker !== msg.speaker;
              return (
                <View
                  key={msg.id}
                  className={`flex-row ${isDoctor ? "justify-end" : "justify-start"}`}
                >
                  <View
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      isDoctor
                        ? "bg-brand-50"
                        : "border border-neutral-200 bg-neutral-100"
                    }`}
                  >
                    {isLast ? (
                      <Text className="mb-0.5 text-[11px] font-semibold text-neutral-500">
                        {isDoctor ? "Doctor" : "Patient"}
                      </Text>
                    ) : null}
                    <Text className="text-sm leading-snug text-neutral-900">
                      {msg.text}
                    </Text>
                    <Text className="mt-1 text-right text-[10px] text-neutral-400">
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View className="gap-3 border-t border-neutral-200 bg-neutral-50 p-3">
            <TextInput
              value={summaryText}
              onChangeText={setSummaryText}
              placeholder="Conversation summary will appear here..."
              multiline
              className="min-h-[96px] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
              textAlignVertical="top"
            />
            <Button label="Summarize" onPress={handleSummarize} />
            <Pressable
              onPress={() => setIsRecording((v) => !v)}
              className="items-center py-1"
            >
              <Text className="text-xs text-brand">
                {isRecording ? "Stop recording indicator" : "Toggle mic"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
