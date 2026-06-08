import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ListRenderItem,
} from 'react-native';
import { useRouter } from 'expo-router';
import { markOnboardingSeen } from '../../src/lib/storage';

const { width } = Dimensions.get('window');

type Slide = { id: string; emoji: string; title: string; subtitle: string };

const SLIDES: Slide[] = [
  {
    id: '1',
    emoji: '🏥',
    title: "Your family's health,\norganized",
    subtitle: 'Store prescriptions, lab reports, and scans — all in one place, organized by family member.',
  },
  {
    id: '2',
    emoji: '🤖',
    title: 'AI-powered\ninsights',
    subtitle: 'Ask questions about your health records in plain English. Get instant summaries and second opinions.',
  },
  {
    id: '3',
    emoji: '🔒',
    title: 'Your data,\nyour keys',
    subtitle: 'Bring your own AI key. Your records stay private — we never read your documents without permission.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleNext = async () => {
    if (activeIndex < SLIDES.length - 1) {
      const next = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    } else {
      await markOnboardingSeen();
      router.replace('/(auth)/login');
    }
  };

  const renderSlide: ListRenderItem<Slide> = ({ item }) => (
    <View style={{ width }} className="flex-1 items-center justify-center px-8">
      <Text className="text-7xl mb-8">{item.emoji}</Text>
      <Text className="text-3xl font-bold text-slate-900 text-center leading-tight mb-4">
        {item.title}
      </Text>
      <Text className="text-base text-slate-500 text-center leading-relaxed">{item.subtitle}</Text>
    </View>
  );

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View className="flex-1 bg-white">
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      <View className="flex-row justify-center mb-10 gap-2">
        {SLIDES.map((_, i) => (
          <View
            key={i}
            className={`h-2 rounded-full ${i === activeIndex ? 'w-6 bg-emerald-600' : 'w-2 bg-slate-200'}`}
          />
        ))}
      </View>

      <View className="px-6 mb-12">
        <TouchableOpacity
          onPress={handleNext}
          className="bg-emerald-600 py-4 rounded-2xl items-center"
          activeOpacity={0.85}
        >
          <Text className="text-white text-base font-bold">{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
        {!isLast && (
          <TouchableOpacity
            onPress={async () => { await markOnboardingSeen(); router.replace('/(auth)/login'); }}
            className="mt-3 py-2 items-center"
          >
            <Text className="text-slate-400 text-sm">Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
