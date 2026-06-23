import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BiomarkerReading } from '@genki/types';
import { statusMeta, formatValue, classifyStatus } from '../data';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Only the measured value is user-editable; reference ranges come from the lab. */
type Draft = {
  value: string;
};

type Props = {
  readings: BiomarkerReading[];
  onSave: (
    updates: Array<{ id: string; value: number; refLow: number | null; refHigh: number | null }>
  ) => Promise<void>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function refRangeLabel(refLow: number | null, refHigh: number | null): string {
  if (refLow != null && refHigh != null) return `${formatValue(refLow)} – ${formatValue(refHigh)}`;
  if (refLow != null) return `≥ ${formatValue(refLow)}`;
  if (refHigh != null) return `≤ ${formatValue(refHigh)}`;
  return '—';
}

function numOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === '' || trimmed === '-') return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

function initialDraft(r: BiomarkerReading): Draft {
  return { value: formatValue(r.value) };
}

const PRIMARY = '#14532d';
const PRIMARY_LIGHT = '#15803d';

// ─── Row (view mode) ──────────────────────────────────────────────────────────

function ViewRow({ reading }: { reading: BiomarkerReading }) {
  const status = classifyStatus(reading.value, reading.refLow, reading.refHigh);
  const { color, label } = statusMeta(status);
  return (
    <View className="flex-row items-center py-3">
      {/* Name */}
      <View style={{ flex: 1 }}>
        <Text className="text-sm font-semibold text-slate-800" numberOfLines={1}>
          {reading.name}
        </Text>
        <Text className="text-xs text-slate-400 mt-0.5">
          {refRangeLabel(reading.refLow, reading.refHigh)}
        </Text>
      </View>
      {/* Value + unit */}
      <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
        <Text className="text-sm font-bold text-slate-900">
          {formatValue(reading.value)}{' '}
          <Text className="text-slate-400 font-normal">{reading.unit}</Text>
        </Text>
      </View>
      {/* Status dot + label */}
      <View className="flex-row items-center" style={{ minWidth: 72 }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            marginRight: 5,
          }}
        />
        <Text style={{ fontSize: 11, color, fontWeight: '600' }}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Row (edit mode) ─────────────────────────────────────────────────────────

function EditRow({
  reading,
  draft,
  onChange,
}: {
  reading: BiomarkerReading;
  draft: Draft;
  onChange: (val: string) => void;
}) {
  return (
    <View className="flex-row items-center py-3">
      {/* Name + ref range (static) */}
      <View style={{ flex: 1 }}>
        <Text className="text-sm font-semibold text-slate-800" numberOfLines={1}>
          {reading.name}
        </Text>
        <Text className="text-xs text-slate-400 mt-0.5">
          {refRangeLabel(reading.refLow, reading.refHigh)}
        </Text>
      </View>

      {/* Editable value + static unit */}
      <View className="flex-row items-center gap-1.5">
        <TextInput
          value={draft.value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor="#cbd5e1"
          style={{
            width: 72,
            borderWidth: 1,
            borderColor: '#14532d',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 6,
            fontSize: 14,
            fontWeight: '700',
            color: '#0f172a',
            textAlign: 'center',
            backgroundColor: '#f0fdf4',
          }}
        />
        <Text className="text-sm text-slate-400" style={{ minWidth: 36 }}>
          {reading.unit}
        </Text>
      </View>
    </View>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function BiomarkersReviewCard({ readings, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const enterEdit = useCallback(() => {
    const initial: Record<string, Draft> = {};
    for (const r of readings) initial[r.id] = initialDraft(r);
    setDrafts(initial);
    setEditing(true);
  }, [readings]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDrafts({});
  }, []);

  const handleChange = useCallback((id: string, val: string) => {
    setDrafts((prev) => ({ ...prev, [id]: { value: val } }));
  }, []);

  const handleSave = useCallback(async () => {
    // Validate: every value must be a finite number.
    for (const r of readings) {
      const d = drafts[r.id];
      if (!d) continue;
      if (numOrNull(d.value) == null) {
        Alert.alert('Invalid value', `"${r.name}" has a blank or invalid value.`);
        return;
      }
    }

    const updates = readings
      .map((r) => {
        const d = drafts[r.id];
        if (!d) return null;
        const value = numOrNull(d.value)!;
        // Skip rows whose value hasn't changed.
        if (value === r.value) return null;
        // Pass through existing ref range unchanged.
        return { id: r.id, value, refLow: r.refLow, refHigh: r.refHigh };
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);

    if (updates.length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(updates);
      setEditing(false);
      setDrafts({});
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [readings, drafts, onSave]);

  if (readings.length === 0) return null;

  return (
    <View className="bg-white rounded-2xl border border-slate-200 mb-4 overflow-hidden">
      {/* Card header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Lab Results
          </Text>
          <View
            style={{
              backgroundColor: '#f0fdf4',
              borderRadius: 10,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 11, color: PRIMARY_LIGHT, fontWeight: '700' }}>
              {readings.length}
            </Text>
          </View>
        </View>
        {!editing ? (
          <TouchableOpacity
            onPress={enterEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="flex-row items-center gap-1"
          >
            <Ionicons name="create-outline" size={16} color={PRIMARY_LIGHT} />
            <Text style={{ fontSize: 13, color: PRIMARY_LIGHT, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={cancelEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={saving}
          >
            <Text className="text-slate-400 text-sm font-medium">Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Rows */}
      <View className="px-4">
        {readings.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <View className="border-t border-slate-100" />}
            {editing ? (
              <EditRow
                reading={r}
                draft={drafts[r.id] ?? initialDraft(r)}
                onChange={(val) => handleChange(r.id, val)}
              />
            ) : (
              <ViewRow reading={r} />
            )}
          </View>
        ))}
      </View>

      {/* Save bar (edit mode only) */}
      {editing && (
        <View className="px-4 pt-3 pb-4 border-t border-slate-100 mt-1">
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: PRIMARY }}
            className="py-3 rounded-xl items-center"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View className="flex-row items-center gap-2">
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text className="text-white font-bold text-sm">Save corrections</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
