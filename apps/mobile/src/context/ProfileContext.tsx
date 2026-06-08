import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';
import { PatientProfile } from '@medcopilot/types';
import { profiles as profilesApi } from '@medcopilot/api-client';

const ACTIVE_PROFILE_KEY = 'activeProfileId';

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type State = {
  profiles: PatientProfile[];
  activeProfile: PatientProfile | null;
  isLoading: boolean;
};

type Action =
  | { type: 'SET_PROFILES'; payload: PatientProfile[] }
  | { type: 'ADD_PROFILE'; payload: PatientProfile }
  | { type: 'SET_ACTIVE'; payload: PatientProfile | null }
  | { type: 'UPDATE_PROFILE'; payload: PatientProfile }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: State = {
  profiles: [],
  activeProfile: null,
  isLoading: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PROFILES': {
      const profiles = action.payload;
      // Keep the active profile if it still exists, else default to the first.
      const active =
        (state.activeProfile &&
          profiles.find(p => p.id === state.activeProfile!.id)) ||
        profiles[0] ||
        null;
      return { ...state, profiles, activeProfile: active };
    }
    case 'ADD_PROFILE': {
      const profiles = [...state.profiles, action.payload];
      // First profile becomes active automatically.
      const activeProfile = state.activeProfile ?? action.payload;
      return { ...state, profiles, activeProfile };
    }
    case 'SET_ACTIVE':
      return { ...state, activeProfile: action.payload };
    case 'UPDATE_PROFILE': {
      const profiles = state.profiles.map(p =>
        p.id === action.payload.id ? action.payload : p
      );
      const activeProfile =
        state.activeProfile?.id === action.payload.id
          ? action.payload
          : state.activeProfile;
      return { ...state, profiles, activeProfile };
    }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type ProfileContextType = State & {
  refreshProfiles: () => Promise<void>;
  addProfile: (profile: PatientProfile) => void;
  setActiveProfile: (profile: PatientProfile | null) => void;
  updateProfile: (profile: PatientProfile) => void;
};

const ProfileContext = createContext<ProfileContextType>({
  ...initialState,
  refreshProfiles: async () => {},
  addProfile: () => {},
  setActiveProfile: () => {},
  updateProfile: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshProfiles = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        dispatch({ type: 'SET_PROFILES', payload: [] });
        return;
      }
      const list = await profilesApi.list(token);

      dispatch({ type: 'SET_PROFILES', payload: list });

      // Restore the previously-active profile from storage, if it still exists.
      const storedId = await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
      if (storedId) {
        const stored = list.find(p => p.id === storedId);
        if (stored) dispatch({ type: 'SET_ACTIVE', payload: stored });
      }
    } catch (error) {
      console.warn('[ProfileContext] refreshProfiles failed:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [getToken]);

  // Fetch profiles on mount / when auth state becomes available.
  useEffect(() => {
    if (isSignedIn) {
      dispatch({ type: 'SET_LOADING', payload: true });
      refreshProfiles();
    } else {
      dispatch({ type: 'SET_PROFILES', payload: [] });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [isSignedIn, refreshProfiles]);

  const addProfile = useCallback((profile: PatientProfile) => {
    dispatch({ type: 'ADD_PROFILE', payload: profile });
  }, []);

  const setActiveProfile = useCallback((profile: PatientProfile | null) => {
    dispatch({ type: 'SET_ACTIVE', payload: profile });
    // Persist the selection (non-sensitive, so AsyncStorage is fine).
    if (profile) {
      AsyncStorage.setItem(ACTIVE_PROFILE_KEY, profile.id).catch(() => {});
    } else {
      AsyncStorage.removeItem(ACTIVE_PROFILE_KEY).catch(() => {});
    }
  }, []);

  const updateProfile = useCallback((profile: PatientProfile) => {
    dispatch({ type: 'UPDATE_PROFILE', payload: profile });
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        ...state,
        refreshProfiles,
        addProfile,
        setActiveProfile,
        updateProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}

// Backwards-compatible alias.
export const useProfileContext = useProfile;
