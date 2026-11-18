import { useEffect, useMemo, useRef, useState } from "react";
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

import { searchDrugs, type DrugCatalogItem } from "@/lib/api/endpoints/drugs";
import {
  listRecentDrugs,
  listRegimens,
  type RecentDrug,
} from "@/lib/api/endpoints/regimens";
import { AppModal, Button } from "@/ui";

import {
  describeSig,
  drugDisplayName,
  formatShortDate,
  medicineNameKey,
  type RegimenView,
} from "../../lineDraft";
import { placePicker, type PickerAnchor } from "./pickerPlacement";

export type PickedDrug = {
  id: string;
  name: string;
  /** Catalogue brand alone: older lines store this rather than brand + strength. */
  brandName?: string | null;
  genericName?: string | null;
  dosageForm?: string | null;
  strength?: string | null;
  expiry?: string | null;
};

const PAGE_SIZE = 10;
/** Rows shown before any search: the five most recent. */
const RECENT_PAGE_SIZE = 5;

function pickedFromCatalog(d: DrugCatalogItem): PickedDrug {
  return {
    id: d.id,
    name: drugDisplayName(d.brandName || d.genericName || "", d.strength),
    brandName: d.brandName,
    genericName: d.genericName,
    dosageForm: d.dosageForm,
    strength: d.strength,
    expiry: d.expiry ?? d.expiryDate,
  };
}

/**
 * Pick several medicines at once. An empty search opens on the five most recent:
 * the doctor's regimens by last use, topped up with what was prescribed lately.
 * Typing searches this facility's catalogue on the server, 10 at a time.
 */
export function MedicinePicker({
  facilityId,
  consultationId,
  excludeDrugIds,
  excludeNameKeys,
  onAdd,
}: {
  facilityId: string;
  consultationId: string;
  excludeDrugIds: Set<string>;
  excludeNameKeys: Set<string>;
  onAdd: (drugs: PickedDrug[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<DrugCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<RegimenView[]>([]);
  const [recentDrugs, setRecentDrugs] = useState<RecentDrug[]>([]);
  const [recentPage, setRecentPage] = useState(1);
  const [recentTotal, setRecentTotal] = useState(0);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, PickedDrug>>(new Map());

  const [anchor, setAnchor] = useState<PickerAnchor>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const anchorRef = useRef<View>(null);
  const screen = useWindowDimensions();

  const typed = query.trim();

  // Keep the list above the keyboard when the search box is tapped.
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
    if (!open || typed) return;
    let cancelled = false;
    void (async () => {
      setSearching(true);
      try {
        const data = await listRegimens({
          facilityId,
          consultationId,
          page: recentPage,
          pageSize: RECENT_PAGE_SIZE,
        });
        if (cancelled) return;
        setRecent(data.regimens);
        setOwnerName(data.readOnly ? data.doctorName : null);
        setRecentTotal(data.total);
        // Fewer than five regimens: top the first page up, so it never opens empty.
        let extra: RecentDrug[] = [];
        if (recentPage === 1 && data.regimens.length < RECENT_PAGE_SIZE) {
          extra = await listRecentDrugs({
            facilityId,
            consultationId,
            limit: RECENT_PAGE_SIZE - data.regimens.length,
            exclude: data.regimens.map((r) => r.drugId),
          });
          if (cancelled) return;
        }
        setRecentDrugs(extra);
      } catch {
        // A non-doctor gets a refusal here and simply sees no recent list.
        if (!cancelled) {
          setRecent([]);
          setRecentDrugs([]);
          setRecentTotal(0);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, typed, recentPage, facilityId, consultationId]);

  useEffect(() => {
    if (!open || !typed) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const data = await searchDrugs({
            facilityId,
            search: typed,
            page,
            pageSize: PAGE_SIZE,
          });
          if (cancelled) return;
          setResults(data.drugs);
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
  }, [open, typed, page, facilityId]);

  const isAlreadyAdded = (d: PickedDrug) =>
    excludeDrugIds.has(d.id) ||
    excludeNameKeys.has(medicineNameKey(d.name)) ||
    Boolean(d.brandName && excludeNameKeys.has(medicineNameKey(d.brandName)));

  const toggle = (d: PickedDrug) => {
    if (isAlreadyAdded(d)) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(d.id)) next.delete(d.id);
      else next.set(d.id, d);
      return next;
    });
  };

  const recentByDrug = useMemo(
    () => new Map(recent.map((r) => [r.drugId, r])),
    [recent]
  );

  const rows: { drug: PickedDrug; sig?: string; last?: string }[] = typed
    ? results.map((d) => {
        const r = recentByDrug.get(d.id);
        return {
          drug: pickedFromCatalog(d),
          sig: r ? describeSig(r) : undefined,
        };
      })
    : [
        ...recent.map((r) => ({
          drug: { id: r.drugId, name: r.drugName },
          sig: describeSig(r),
        })),
        ...recentDrugs.map((d) => ({ drug: d, last: d.lastPrescribedAt })),
      ];

  const pageNow = typed ? page : recentPage;
  const totalNow = typed ? total : recentTotal;
  const sizeNow = typed ? PAGE_SIZE : RECENT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(totalNow / sizeNow));
  const setPageNow = (p: number) => (typed ? setPage(p) : setRecentPage(p));

  const openUnderBox = () => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
    setSelected(new Map());
    setQuery("");
    setPage(1);
    setRecentPage(1);
  };

  const panel = placePicker(anchor, screen, keyboardHeight);

  const add = () => {
    onAdd([...selected.values()]);
    close();
  };

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          onPress={openUnderBox}
          className="h-11 flex-row items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 active:bg-neutral-50"
        >
          <Ionicons name="search-outline" size={16} color="#6b7280" />
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 text-sm text-neutral-500"
          >
            Add medicines…
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
          {/* Tapping anywhere outside the list closes it. */}
          <Pressable
            onPress={close}
            accessibilityLabel="Close medicine list"
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
            <View className="flex-row items-center gap-2 border-b border-neutral-200 p-2">
              {/* No autofocus: the recent medicines stay in view, and the keyboard
                  comes up only for someone who wants to search. */}
              <View className="h-11 min-w-0 flex-1 flex-row items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3">
                <Ionicons name="search-outline" size={16} color="#6b7280" />
                <TextInput
                  value={query}
                  onChangeText={(t) => {
                    setQuery(t);
                    setPage(1);
                  }}
                  placeholder="Search by name, generic or strength…"
                  placeholderTextColor="#9ca3af"
                  autoCorrect={false}
                  className="min-w-0 flex-1 text-sm text-neutral-900"
                  style={{ height: 44, paddingVertical: 0 }}
                />
                {query ? (
                  <Pressable
                    onPress={() => {
                      setQuery("");
                      setPage(1);
                    }}
                    hitSlop={8}
                    accessibilityLabel="Clear search"
                  >
                    <Ionicons name="close-circle" size={16} color="#9ca3af" />
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                onPress={close}
                hitSlop={8}
                accessibilityLabel="Close"
                className="h-11 w-10 items-center justify-center rounded-lg active:bg-neutral-100"
              >
                <Ionicons name="close" size={20} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
            >
              <View className="flex-row items-center gap-1.5 px-3 pb-1 pt-2.5">
                <Ionicons
                  name={typed ? "medkit-outline" : "time-outline"}
                  size={12}
                  color="#6b7280"
                />
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {typed
                    ? "Medicines"
                    : recent.length === 0 && recentDrugs.length > 0
                      ? "Recently prescribed"
                      : ownerName
                        ? `${ownerName}'s regimens, recent first`
                        : "Your regimens, recent first"}
                </Text>
              </View>

              {searching ? (
                <View className="flex-row items-center gap-2 px-3 py-3">
                  <ActivityIndicator size="small" color="#FD006A" />
                  <Text className="text-sm text-neutral-500">Searching…</Text>
                </View>
              ) : null}

              {!searching && rows.length === 0 ? (
                <Text className="px-3 py-3 text-sm text-neutral-500">
                  {typed
                    ? "No medicine matches. Add it to the catalogue with “Add medicine”."
                    : "No regimens yet. Search for a medicine, and set its regimen the first time you prescribe it."}
                </Text>
              ) : null}

              {!searching
                ? rows.map(({ drug, sig, last }) => {
                    const already = isAlreadyAdded(drug);
                    const checked = already || selected.has(drug.id);
                    const sub = sig
                      ? `usual: ${sig}`
                      : last
                        ? `no regimen yet · last prescribed ${formatShortDate(last)}`
                        : drug.genericName
                          ? [drug.genericName, drug.dosageForm]
                              .filter(Boolean)
                              .join(" · ")
                          : null;
                    return (
                      <Pressable
                        key={drug.id}
                        onPress={() => toggle(drug)}
                        className={`flex-row items-start gap-2.5 px-3 py-2.5 ${
                          already ? "opacity-60" : "active:bg-neutral-50"
                        }`}
                      >
                        <View
                          className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
                            checked
                              ? "border-brand bg-brand"
                              : "border-neutral-400 bg-white"
                          }`}
                        >
                          {checked ? (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          ) : null}
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text
                            numberOfLines={1}
                            className="text-sm font-medium text-neutral-900"
                          >
                            {drug.name}
                          </Text>
                          {sub ? (
                            <Text
                              numberOfLines={1}
                              className="text-xs text-neutral-500"
                            >
                              {sub}
                            </Text>
                          ) : null}
                        </View>
                        {already ? (
                          <Text className="text-[11px] text-neutral-500">
                            added
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })
                : null}
            </ScrollView>

            <View className="flex-row items-center justify-between gap-2 border-t border-neutral-200 p-3">
              {totalNow > sizeNow ? (
                <View className="flex-row items-center gap-1">
                  <Pressable
                    accessibilityLabel="Previous page"
                    disabled={pageNow <= 1 || searching}
                    onPress={() => setPageNow(Math.max(1, pageNow - 1))}
                    className={`h-10 w-10 items-center justify-center ${
                      pageNow <= 1 ? "opacity-30" : ""
                    }`}
                  >
                    <Ionicons name="chevron-back" size={18} color="#111827" />
                  </Pressable>
                  <Text className="text-xs text-neutral-500">
                    {(pageNow - 1) * sizeNow + 1}–
                    {Math.min(pageNow * sizeNow, totalNow)} of {totalNow}
                  </Text>
                  <Pressable
                    accessibilityLabel="Next page"
                    disabled={pageNow >= pageCount || searching}
                    onPress={() => setPageNow(Math.min(pageCount, pageNow + 1))}
                    className={`h-10 w-10 items-center justify-center ${
                      pageNow >= pageCount ? "opacity-30" : ""
                    }`}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#111827"
                    />
                  </Pressable>
                </View>
              ) : (
                <View />
              )}
              <Button
                label={
                  selected.size === 0
                    ? "Add medicines"
                    : `Add ${selected.size} medicine${selected.size === 1 ? "" : "s"}`
                }
                size="md"
                disabled={selected.size === 0}
                onPress={add}
              />
            </View>
          </View>
        </View>
      </AppModal>
    </>
  );
}
