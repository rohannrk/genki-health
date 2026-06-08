import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ApiClient } from '@medcopilot/api-client';
import { PatientProfile, MedicalDocument } from '@medcopilot/types';
import { MedicalCard } from '@medcopilot/ui';
import { formatDate } from '@medcopilot/utils';
import Constants from 'expo-constants';
import { getToken } from '../../../src/lib/storage';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.medcopilot.in';

export default function TimelineTab() {
  const [api, setApi] = useState<ApiClient | null>(null);
  const [profiles, setProfiles] = useState<PatientProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PatientProfile | null>(null);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState<boolean>(true);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(false);

  useEffect(() => {
    async function initClientAndLoadProfiles() {
      try {
        const token = await getToken();
        const client = new ApiClient(token, API_URL);
        setApi(client);

        const data = await client.profiles.list();
        setProfiles(data);
        if (data.length > 0) {
          setSelectedProfile(data[0]);
        }
      } catch (error) {
        console.error('Error loading patient profiles:', error);
      } finally {
        setLoadingProfiles(false);
      }
    }
    initClientAndLoadProfiles();
  }, []);

  useEffect(() => {
    if (!selectedProfile || !api) return;
    const profileId = selectedProfile.id;

    async function loadDocuments() {
      setLoadingDocuments(true);
      try {
        const data = await api!.documents.list(profileId);
        setDocuments(data);
      } catch (error) {
        console.error('Error loading medical documents:', error);
      } finally {
        setLoadingDocuments(false);
      }
    }
    loadDocuments();
  }, [selectedProfile, api]);

  if (loadingProfiles) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#059669" />
        <Text className="mt-4 text-slate-600 font-medium">Loading Patient Profiles...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {/* Patient Profile Selector */}
      <View className="bg-white border-b border-slate-200 p-4">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Select Patient Profile
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {profiles.map((profile) => {
            const isSelected = selectedProfile?.id === profile.id;
            return (
              <TouchableOpacity
                key={profile.id}
                onPress={() => setSelectedProfile(profile)}
                className={`mr-3 px-4 py-2.5 rounded-full border ${
                  isSelected
                    ? 'bg-slate-900 border-slate-900'
                    : 'bg-white border-slate-200'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    isSelected ? 'text-white' : 'text-slate-700'
                  }`}
                >
                  {profile.name} ({profile.relation})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Patient Profile Details Summary */}
      {selectedProfile && (
        <View className="bg-white p-4 mb-4 border-b border-slate-200">
          <Text className="text-xl font-bold text-slate-800">
            {selectedProfile.name}
          </Text>
          <View className="flex-row mt-2 flex-wrap">
            <Text className="text-sm text-slate-500 mr-4">
              <Text className="font-semibold text-slate-700">Date of Birth: </Text>
              {formatDate(selectedProfile.dob)}
            </Text>
            <Text className="text-sm text-slate-500 mr-4">
              <Text className="font-semibold text-slate-700">Relationship: </Text>
              {selectedProfile.relation}
            </Text>
          </View>
        </View>
      )}

      {/* Medical Documents List */}
      <ScrollView className="flex-1 px-4">
        <Text className="text-sm font-semibold text-slate-500 mb-3 mt-1">
          Clinical Documents Timeline
        </Text>

        {loadingDocuments ? (
          <View className="py-8 justify-center items-center">
            <ActivityIndicator size="small" color="#059669" />
            <Text className="mt-2 text-slate-500 text-sm">Retrieving records...</Text>
          </View>
        ) : documents.length === 0 ? (
          <View className="bg-white rounded-xl border border-slate-200 p-8 justify-center items-center my-4">
            <Text className="text-slate-400 text-sm font-medium">No medical documents found.</Text>
          </View>
        ) : (
          documents.map((doc) => (
            <MedicalCard
              key={doc.id}
              title={`${doc.type.toUpperCase()} - ${doc.hospitalName || 'Clinic'}`}
              date={formatDate(doc.date)}
              diagnosis={doc.metadata.diagnosis || 'Standard Review'}
              treatment={doc.metadata.treatment || 'Check-up / Observation'}
              provider={doc.doctorName || 'Attending Physician'}
              notes={doc.extractedText}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
