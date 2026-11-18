import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { placePicker } from "@/features/consult/plan-of-care/components/regimen/pickerPlacement";
import { searchDiagnosisCodesPage } from "@/lib/api/endpoints/consult-data";
import { useAuthUser } from "@/lib/auth/store";
import { AppModal, Button } from "@/ui";

import {
  loadRecentDiagnosisCodes,
  rememberDiagnosisCode,
} from "../recentDiagnosisCodes";
import {
  formatCodeLine,
  matchesRecent,
  type CodeSystem,
  type RecentDiagnosisCode,
} from "../soapText";
import type { DiagnosisCode } from "../types";

const PAGE_SIZE = 10;
const PANEL_MIN_WIDTH = 420;

const FIELD_CLASS =
  "rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900";

function CodeRow({
  code,
  label,
  recent,
  onPress,
}: {
  code: string;
  label: string;
  recent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start gap-2 px-3 py-2.5 active:bg-neutral-50"
    >
      {recent ? (
        <Ionicons
          name="time-outline"
          size={14}
          color="#6b7280"
          style={{ marginTop: 2 }}
        />
      ) : null}
      <Text
        numberOfLines={1}
        className="text-xs font-semibold text-brand"
        style={{ marginTop: 2 }}
      >
        {code}
      </Text>
      <Text className="min-w-0 flex-1 text-sm text-neutral-900">{label}</Text>
    </Pressable>
  );
}

function GroupHeading({ children }: { children: string }) {
  return (
    <Text className="px-3 pb-1 pt-2.5 text-[11px] font-semibold text-neutral-500">
      {children}
    </Text>
  );
}

/**
 * Turns a chosen code into a line of text. Opens on the doctor's recent codes; typing
 * filters those and searches ICD-10 on the server, 10 at a time. SNOMED has no bundled
 * list, so it is entered by hand. Either way the result is plain, editable text.
 */
export function CodeInsertPicker({
  onInsert,
}: {
  onInsert: (line: string) => void;
}) {
  const user = useAuthUser();
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [system, setSystem] = useState<CodeSystem>("ICD-10");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<DiagnosisCode[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<RecentDiagnosisCode[]>([]);
  const [snomedCode, setSnomedCode] = useState("");
  const [snomedLabel, setSnomedLabel] = useState("");
  const [anchorRight, setAnchorRight] = useState({ x: 0, y: 0, height: 0 });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const anchorRef = useRef<View>(null);
  const screen = useWindowDimensions();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void loadRecentDiagnosisCodes(userId).then((list) => {
      if (!cancelled) setRecent(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [open]);

  useEffect(() => {
    if (!open || system !== "ICD-10") return;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const data = await searchDiagnosisCodesPage(query, page, PAGE_SIZE);
          if (cancelled) return;
          setResults(data.codes);
          setTotal(data.total);
        } catch {
          if (!cancelled) {
            setResults([]);
            setTotal(0);
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, system, query, page]);

  const openUnderButton = () => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchorRight({ x: x + width, y, height });
      setOpen(true);
    });
  };

  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
    setQuery("");
    setPage(1);
    setSnomedCode("");
    setSnomedLabel("");
  };

  const finish = (line: string, picked?: RecentDiagnosisCode) => {
    if (!line.trim()) return;
    if (picked) void rememberDiagnosisCode(userId, picked);
    onInsert(line);
    close();
  };

  const pick = (r: RecentDiagnosisCode) =>
    finish(formatCodeLine(r.code, r.system, r.label), r);

  const insertSnomed = () => {
    const code = snomedCode.trim();
    const label = snomedLabel.trim();
    finish(
      formatCodeLine(code, "SNOMED", label),
      code ? { code, label, system: "SNOMED" } : undefined
    );
  };

  const typed = query.trim();
  const recentHere = recent.filter(
    (r) =>
      r.system === system &&
      matchesRecent(r, system === "ICD-10" ? query : snomedLabel || snomedCode)
  );
  // Recents already sit on top, so they are not listed again in the search page.
  const recentKeys = new Set(recentHere.map((r) => r.code));
  const pageRows = results.filter((r) => !recentKeys.has(r.code));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  // Right-aligned to the button, which sits at the right of the Assessment label.
  const panel = placePicker(
    {
      x: anchorRight.x - PANEL_MIN_WIDTH,
      y: anchorRight.y,
      width: 0,
      height: anchorRight.height,
    },
    screen,
    keyboardHeight
  );

  const recentGroup =
    recentHere.length > 0 ? (
      <>
        <GroupHeading>Recently used</GroupHeading>
        {recentHere.map((r) => (
          <CodeRow
            key={`recent:${r.system}:${r.code}`}
            recent
            code={r.code}
            label={r.label}
            onPress={() => pick(r)}
          />
        ))}
      </>
    ) : null;

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={openUnderButton}
          style={{ flexShrink: 0 }}
          className="h-9 flex-row items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 active:bg-neutral-50"
        >
          <Ionicons name="search-outline" size={15} color="#111827" />
          <Text
            numberOfLines={1}
            className="text-sm font-medium text-neutral-900"
          >
            Insert code
          </Text>
        </Pressable>
      </View>

      <AppModal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={close}
      >
        <View className="flex-1">
          <Pressable
            onPress={close}
            accessibilityLabel="Close code picker"
            className="bg-black/20"
            style={StyleSheet.absoluteFill}
          />
          <View
            className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
            style={{
              position: "absolute",
              left: panel.left,
              top: panel.top,
              width: panel.width,
              height: panel.height,
              elevation: 8,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <View className="flex-row items-center gap-1 border-b border-neutral-200 p-1.5">
              {(["ICD-10", "SNOMED"] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSystem(s)}
                  accessibilityState={{ selected: system === s }}
                  className={`h-9 flex-1 items-center justify-center rounded-md ${
                    system === s ? "bg-brand-50" : ""
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      system === s ? "text-brand" : "text-neutral-500"
                    }`}
                  >
                    {s}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={close}
                hitSlop={8}
                accessibilityLabel="Close"
                className="h-9 w-9 items-center justify-center rounded-md active:bg-neutral-100"
              >
                <Ionicons name="close" size={18} color="#6b7280" />
              </Pressable>
            </View>

            {system === "ICD-10" ? (
              <>
                <View className="border-b border-neutral-200 p-2">
                  <TextInput
                    value={query}
                    onChangeText={(t) => {
                      setQuery(t);
                      setPage(1);
                    }}
                    placeholder="Search ICD-10 by code or term…"
                    placeholderTextColor="#9ca3af"
                    autoCorrect={false}
                    className={FIELD_CLASS}
                    style={{ height: 44, paddingVertical: 0 }}
                  />
                </View>

                <ScrollView
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {recentGroup}
                  {searching ? (
                    <View className="flex-row items-center gap-2 px-3 py-3">
                      <ActivityIndicator size="small" color="#FD006A" />
                      <Text className="text-sm text-neutral-500">
                        Searching…
                      </Text>
                    </View>
                  ) : null}
                  {!searching && pageRows.length > 0 ? (
                    <>
                      <GroupHeading>
                        {typed ? "ICD-10-CM matches" : "Common ICD-10-CM codes"}
                      </GroupHeading>
                      {pageRows.map((r) => (
                        <CodeRow
                          key={r.code}
                          code={r.code}
                          label={r.label ?? ""}
                          onPress={() =>
                            pick({
                              code: r.code,
                              label: r.label ?? "",
                              system: "ICD-10",
                            })
                          }
                        />
                      ))}
                    </>
                  ) : null}
                  {!searching && total === 0 && recentHere.length === 0 ? (
                    <Text className="px-3 py-3 text-sm text-neutral-500">
                      No matching codes.
                    </Text>
                  ) : null}
                  {typed ? (
                    <>
                      <GroupHeading>Free text</GroupHeading>
                      <Pressable
                        onPress={() => finish(typed)}
                        className="flex-row items-center gap-2 px-3 py-2.5 active:bg-neutral-50"
                      >
                        <Ionicons
                          name="return-down-back-outline"
                          size={15}
                          color="#6b7280"
                        />
                        <Text className="min-w-0 flex-1 text-sm text-neutral-900">
                          Insert “{typed}” as typed
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </ScrollView>

                {total > PAGE_SIZE ? (
                  <View className="flex-row items-center justify-between gap-2 border-t border-neutral-200 px-3 py-1">
                    <Text className="text-xs text-neutral-500">
                      {firstRow}–{lastRow} of {total}
                    </Text>
                    <View className="flex-row gap-1">
                      <Pressable
                        accessibilityLabel="Previous page"
                        disabled={page <= 1 || searching}
                        onPress={() => setPage((p) => Math.max(1, p - 1))}
                        className={`h-10 w-10 items-center justify-center ${
                          page <= 1 ? "opacity-30" : ""
                        }`}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={18}
                          color="#111827"
                        />
                      </Pressable>
                      <Pressable
                        accessibilityLabel="Next page"
                        disabled={page >= pageCount || searching}
                        onPress={() =>
                          setPage((p) => Math.min(pageCount, p + 1))
                        }
                        className={`h-10 w-10 items-center justify-center ${
                          page >= pageCount ? "opacity-30" : ""
                        }`}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#111827"
                        />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                keyboardShouldPersistTaps="handled"
              >
                {recentGroup}
                <View className="gap-2 p-3">
                  <TextInput
                    value={snomedCode}
                    onChangeText={setSnomedCode}
                    placeholder="SNOMED CT concept id"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    className={FIELD_CLASS}
                    style={{ height: 44, paddingVertical: 0 }}
                  />
                  <TextInput
                    value={snomedLabel}
                    onChangeText={setSnomedLabel}
                    placeholder="Description (optional)"
                    placeholderTextColor="#9ca3af"
                    returnKeyType="done"
                    onSubmitEditing={insertSnomed}
                    className={FIELD_CLASS}
                    style={{ height: 44, paddingVertical: 0 }}
                  />
                  <View className="flex-row items-center justify-between gap-2 pt-1">
                    <Text
                      numberOfLines={2}
                      className="min-w-0 flex-1 text-xs text-neutral-500"
                    >
                      {snomedCode.trim() || snomedLabel.trim()
                        ? formatCodeLine(snomedCode, "SNOMED", snomedLabel)
                        : "Inserted as a line in Assessment"}
                    </Text>
                    <Button
                      label="Insert"
                      size="md"
                      disabled={!snomedCode.trim() && !snomedLabel.trim()}
                      onPress={insertSnomed}
                    />
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </AppModal>
    </>
  );
}
