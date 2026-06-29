import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, Share2, LucideIcon } from 'lucide-react-native';
import { SERIF, INK } from '../theme';
import { colors } from '../../../theme/genki';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onShare?: () => void;
};

function CircleButton({
  icon: Icon,
  onPress,
}: {
  icon: LucideIcon;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className="w-10 h-10 rounded-full bg-white items-center justify-center"
    >
      <Icon size={18} color={colors.g8} />
    </TouchableOpacity>
  );
}

export default function DetailHeader({ title, subtitle, onBack, onShare }: Props) {
  return (
    <View className="flex-row items-center px-4 py-2">
      <CircleButton icon={ChevronLeft} onPress={onBack} />
      <View className="flex-1 items-center px-2">
        <Text
          numberOfLines={1}
          style={{ fontFamily: SERIF, fontSize: 19, color: INK }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-[12px] text-genki-faint mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <CircleButton icon={Share2} onPress={onShare} />
    </View>
  );
}
