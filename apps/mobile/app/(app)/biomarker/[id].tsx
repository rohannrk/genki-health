import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { FlaskConical, ChevronLeft } from 'lucide-react-native';
import { biomarkers as biomarkersApi } from '@genki/api-client';
import { BiomarkerDetail as BiomarkerDetailData } from '@genki/types';
import BiomarkerDetail from '../../../src/features/biomarker/BiomarkerDetail';
import { colors } from '../../../src/theme/genki';

export default function BiomarkerDetailScreen() {
  // `id` is the biomarker code (e.g. 'hemoglobin').
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [data, setData] = useState<BiomarkerDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
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
        const detail = await biomarkersApi.get(id, token);
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
  }, [id]);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)');

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator size="large" color={colors.g8} />
      </Centered>
    );
  }

  if (error || !data) {
    return (
      <Centered onBack={goBack}>
        <FlaskConical size={44} color={colors.g3} style={{ marginBottom: 12 }} />
        <Text className="text-genki-muted text-center text-sm">
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
    <View className="flex-1 bg-genki-bg">
      <View style={{ paddingTop: Math.max(insets.top, 12) }} className="px-4 py-2">
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            className="w-10 h-10 rounded-full bg-white items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={18} color={colors.g8} />
          </TouchableOpacity>
        )}
      </View>
      <View className="flex-1 items-center justify-center px-10" style={{ marginTop: -60 }}>
        {children}
      </View>
    </View>
  );
}
