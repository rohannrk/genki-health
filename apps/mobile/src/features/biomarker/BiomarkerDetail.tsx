import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, TrendingUp } from 'lucide-react-native';
import { BiomarkerDetail as BiomarkerDetailData } from '@genki/types';
import { biomarkerInfo } from './data';
import DetailHeader from './components/DetailHeader';
import HeroValue from './components/HeroValue';
import RangeDots from './components/RangeDots';
import InfoCard from './components/InfoCard';
import TrendChart from './components/TrendChart';

type Props = {
  biomarker: BiomarkerDetailData;
  onBack?: () => void;
  onShare?: () => void;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function dateSpan(b: BiomarkerDetailData) {
  const first = b.history[0]?.measuredAt;
  const last = b.history[b.history.length - 1]?.measuredAt;
  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
  return first && last ? `${fmt(first)} – ${fmt(last)}` : fmt(last);
}

export default function BiomarkerDetail({ biomarker, onBack, onShare }: Props) {
  const insets = useSafeAreaInsets();
  const info = biomarkerInfo(biomarker.code);
  const hasRange = biomarker.refLow != null && biomarker.refHigh != null;
  const reportLabel = `${biomarker.count} ${biomarker.count === 1 ? 'reading' : 'readings'}`;

  return (
    <View className="flex-1 bg-genki-bg">
      <View style={{ paddingTop: Math.max(insets.top, 12) }} className="bg-genki-bg">
        <DetailHeader
          title={biomarker.name}
          subtitle={`${formatDate(biomarker.measuredAt)} · ${reportLabel}`}
          onBack={onBack}
          onShare={onShare}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <HeroValue value={biomarker.value} unit={biomarker.unit} status={biomarker.status} />

        {/* Range scale (only when a reference range is known) */}
        {hasRange && (
          <View className="mt-5 mb-2">
            <RangeDots
              value={biomarker.value}
              refLow={biomarker.refLow as number}
              refHigh={biomarker.refHigh as number}
            />
          </View>
        )}

        {/* About */}
        <View className="mt-5">
          <InfoCard label="About" icon={BookOpen}>
            <Text className="text-[16px] leading-[23px] text-genki-text">{info.about}</Text>
            {info.aboutSecondary ? (
              <Text className="text-[14px] leading-[21px] text-genki-muted mt-2">
                {info.aboutSecondary}
              </Text>
            ) : null}
          </InfoCard>
        </View>

        {/* Trend — only meaningful with 2+ real data points */}
        <View className="mt-4">
          <InfoCard
            label="Trend"
            icon={TrendingUp}
            right={
              biomarker.history.length >= 2 ? (
                <Text className="text-[12px] text-genki-faint">{dateSpan(biomarker)}</Text>
              ) : undefined
            }
          >
            {biomarker.history.length >= 2 ? (
              <TrendChart
                data={biomarker.history}
                unit={biomarker.unit}
                delta={biomarker.delta}
                refLow={biomarker.refLow}
                refHigh={biomarker.refHigh}
              />
            ) : (
              <View className="items-center py-5">
                <Text className="text-[13px] text-genki-faint text-center leading-5">
                  Upload a second report to start tracking{'\n'}this value over time.
                </Text>
              </View>
            )}
          </InfoCard>
        </View>
      </ScrollView>
    </View>
  );
}
