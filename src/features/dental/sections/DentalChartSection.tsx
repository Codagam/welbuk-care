import { ActivityIndicator, Text, View } from "react-native";

import { TeethChart } from "../components/TeethChart";
import { FindingsSheet } from "../components/FindingsSheet";
import { useDentalConsult } from "../DentalConsultContext";

export function DentalChartSection() {
  const dental = useDentalConsult();

  if (dental.loading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color="#FD006A" />
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
        <Text className="text-lg font-semibold text-neutral-900">
          Odontogram
        </Text>
        <TeethChart
          teethStates={dental.chartTeethStates}
          selectedTooth={dental.selectedTooth}
          treatedTeeth={dental.treatedToothIds}
          onToothPress={dental.openTooth}
        />
        <Text className="text-center text-xs text-neutral-400">
          Tap a tooth to record findings. Gold = diagnosed · green = treated ·
          faded = missing.
        </Text>
      </View>

      {dental.error ? (
        <Text className="text-sm text-red-500">{dental.error}</Text>
      ) : null}
      {dental.statusMsg ? (
        <Text className="text-sm text-emerald-600">{dental.statusMsg}</Text>
      ) : null}

      <FindingsSheet
        visible={dental.findingsOpen}
        toothId={dental.selectedTooth}
        entries={dental.entries}
        planItems={dental.planItems}
        diagnosisOptions={dental.diagnosisOptions}
        catalog={dental.catalog}
        facilityId={dental.facilityId}
        defaultDoctorId={dental.defaultDoctorId}
        saving={dental.saving}
        onClose={dental.closeFindings}
        onSave={dental.saveFindings}
        onClearTooth={dental.clearTooth}
      />
    </View>
  );
}
