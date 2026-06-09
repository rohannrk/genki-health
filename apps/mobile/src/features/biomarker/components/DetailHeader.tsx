import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SERIF, INK } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onShare?: () => void;
};

function CircleButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
    >
      <Ionicons name={icon} size={18} color="#334155" />
    </TouchableOpacity>
  );
}

export default function DetailHeader({ title, subtitle, onBack, onShare }: Props) {
  return (
    <View className="flex-row items-center px-4 py-2">
      <CircleButton icon="chevron-back" onPress={onBack} />
      <View className="flex-1 items-center px-2">
        <Text
          numberOfLines={1}
          style={{ fontFamily: SERIF, fontSize: 19, color: INK }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[12px] text-slate-400 mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <CircleButton icon="share-outline" onPress={onShare} />
    </View>
  );
}
