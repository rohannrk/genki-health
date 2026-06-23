import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { biomarkers as biomarkersApi } from '@genki/api-client';
import { BiomarkerDetail as BiomarkerDetailData } from '@genki/types';
import { useProfile } from '../../../src/context/ProfileContext';
import BiomarkerDetail from '../../../src/features/biomarker/BiomarkerDetail';

export default function BiomarkerDetailScreen() {
  // `id` is the biomarker code (e.g. 'hemoglobin').
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const { activeProfile } = useProfile();

  const [data, setData] = useState<BiomarkerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id || !activeProfile) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const token = await getTokenRef.current();
        if (!token) {
          setError('You need to be signed in.');
          return;
        }
        const detail = await biomarkersApi.get(id, activeProfile.id, token);
        if (!cancelled) setData(detail);
      } catch (e) {
        if (!cancelled) setError('No data found for this biomarker yet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, activeProfile?.id]);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)');

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator size="large" color="#14532d" />
      </Centered>
    );
  }

  if (error || !data) {
    return (
      <Centered onBack={goBack}>
        <Ionicons name="flask-outline" size={44} color="#cbd5e1" style={{ marginBottom: 12 }} />
        <Text className="text-slate-500 text-center text-sm">
          {error ?? 'No data found for this biomarker yet.'}
        </Text>
      </Centered>
    );
  }

  return <BiomarkerDetail biomarker={data} onBack={goBack} onShare={() => {}} />;
}

/** Minimal scaffold (with a back button) for loading / empty states. */
function Centered({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-slate-50">
      <View style={{ paddingTop: Math.max(insets.top, 12) }} className="px-4 py-2">
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color="#334155" />
          </TouchableOpacity>
        )}
      </View>
      <View className="flex-1 items-center justify-center px-10" style={{ marginTop: -60 }}>
        {children}
      </View>
    </View>
  );
}
