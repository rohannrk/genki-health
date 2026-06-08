import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import type { PatientProfile } from '@medcopilot/types';
import { useProfile } from '../context/ProfileContext';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="bg-teal-500 items-center justify-center"
    >
      <Text className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function ProfileSwitcher() {
  const router = useRouter();
  const { profiles, activeProfile, setActiveProfile } = useProfile();
  const [open, setOpen] = useState(false);

  const handleSelect = (profile: PatientProfile) => {
    setActiveProfile(profile);
    setOpen(false);
  };

  const handleAdd = () => {
    setOpen(false);
    router.push('/(app)/create-profile');
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Switch profile"
        className="flex-row items-center"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Avatar name={activeProfile?.name ?? '?'} />
        <Text className="text-white font-bold text-base ml-2" numberOfLines={1}>
          {activeProfile?.name ?? 'Select profile'}
        </Text>
        <Text className="text-white/70 ml-1">▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1 bg-black/40" onPress={() => setOpen(false)}>
          <Pressable
            className="mt-24 mx-6 bg-white rounded-2xl overflow-hidden"
            onPress={() => {}}
          >
            <View className="px-4 py-3 border-b border-slate-100">
              <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Switch profile
              </Text>
            </View>

            <FlatList
              data={profiles}
              keyExtractor={p => p.id}
              renderItem={({ item }) => {
                const active = item.id === activeProfile?.id;
                return (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    className="flex-row items-center px-4 py-3 active:bg-slate-50"
                  >
                    <Avatar name={item.name} size={36} />
                    <View className="flex-1 ml-3">
                      <Text className="text-slate-900 font-semibold">{item.name}</Text>
                      <Text className="text-slate-400 text-xs capitalize">
                        {item.relation}
                      </Text>
                    </View>
                    {active && <Text className="text-teal-600 font-bold">✓</Text>}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text className="text-slate-400 text-sm px-4 py-3">No profiles yet</Text>
              }
            />

            <Pressable
              onPress={handleAdd}
              className="flex-row items-center px-4 py-3 border-t border-slate-100 active:bg-slate-50"
              accessibilityRole="button"
              accessibilityLabel="Add profile"
            >
              <View className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center">
                <Text className="text-slate-500 text-lg">+</Text>
              </View>
              <Text className="text-teal-600 font-semibold ml-3">Add profile</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default ProfileSwitcher;
