import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { User } from '@genki/types';
import { me as meApi } from '@genki/api-client';

// ---------------------------------------------------------------------------
// The app is single-user: the signed-in account is its own patient ("me").
// This context exposes that one record. `activeProfile` is kept as an alias of
// `me` so existing screens that read `.name`/`.id`/`.hasApiKey` keep working.
// ---------------------------------------------------------------------------

type State = {
  me: User | null;
  isLoading: boolean;
};

type Action =
  | { type: 'SET_ME'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean };

const initialState: State = {
  me: null,
  isLoading: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_ME':
      return { ...state, me: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

type ProfileContextType = {
  me: User | null;
  /** Alias of `me` — the single patient. */
  activeProfile: User | null;
  /** Whether the one-time "about you" details (name) have been filled in. */
  hasProfile: boolean;
  isLoading: boolean;
  refreshMe: () => Promise<void>;
  /** Back-compat alias of refreshMe. */
  refreshProfiles: () => Promise<void>;
  setMe: (user: User) => void;
};

const ProfileContext = createContext<ProfileContextType>({
  me: null,
  activeProfile: null,
  hasProfile: false,
  isLoading: true,
  refreshMe: async () => {},
  refreshProfiles: async () => {},
  setMe: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const refreshMe = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      if (!token) {
        dispatch({ type: 'SET_ME', payload: null });
        return;
      }
      const user = await meApi.get(token);
      dispatch({ type: 'SET_ME', payload: user });
    } catch (error) {
      console.warn('[ProfileContext] refreshMe failed:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      dispatch({ type: 'SET_LOADING', payload: true });
      refreshMe();
    } else {
      dispatch({ type: 'SET_ME', payload: null });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [isSignedIn, refreshMe]);

  const setMe = useCallback((user: User) => {
    dispatch({ type: 'SET_ME', payload: user });
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        me: state.me,
        activeProfile: state.me,
        hasProfile: !!state.me?.name,
        isLoading: state.isLoading,
        refreshMe,
        refreshProfiles: refreshMe,
        setMe,
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
