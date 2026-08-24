import { useReducer, useCallback, useMemo } from 'react';

/**
 * Hook otimizado para gerenciar estado de configurações
 * Reduz 68 states individuais para um único reducer
 */

const initialState = {
  settings: {},
  loading: {},
  errors: {},
  isDirty: false
};

const settingsReducer = (state, action) => {
  switch (action.type) {
    case 'SET_SETTING':
      return {
        ...state,
        settings: { ...state.settings, [action.key]: action.value },
        isDirty: true
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.key]: action.value }
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.key]: action.error }
      };
    
    case 'BULK_UPDATE':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
        isDirty: false
      };
    
    case 'RESET':
      return initialState;
    
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: {}
      };
    
    default:
      return state;
  }
};

export const useSettingsState = (initialSettings = {}) => {
  const [state, dispatch] = useReducer(settingsReducer, {
    ...initialState,
    settings: initialSettings
  });

  // Memoized actions
  const updateSetting = useCallback((key, value) => {
    dispatch({ type: 'SET_SETTING', key, value });
  }, []);

  const setLoading = useCallback((key, value) => {
    dispatch({ type: 'SET_LOADING', key, value });
  }, []);

  const setError = useCallback((key, error) => {
    dispatch({ type: 'SET_ERROR', key, error });
  }, []);

  const bulkUpdate = useCallback((payload) => {
    dispatch({ type: 'BULK_UPDATE', payload });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);

  // Memoized getters
  const getSetting = useCallback((key) => {
    return state.settings[key];
  }, [state.settings]);

  const isLoading = useCallback((key) => {
    return state.loading[key] || false;
  }, [state.loading]);

  const getError = useCallback((key) => {
    return state.errors[key];
  }, [state.errors]);

  // Memoized computed values
  const isAnyLoading = useMemo(() => {
    return Object.values(state.loading).some(Boolean);
  }, [state.loading]);

  const hasErrors = useMemo(() => {
    return Object.keys(state.errors).length > 0;
  }, [state.errors]);

  const changedSettings = useMemo(() => {
    return state.isDirty ? state.settings : {};
  }, [state.isDirty, state.settings]);

  return {
    // State
    settings: state.settings,
    loading: state.loading,
    errors: state.errors,
    isDirty: state.isDirty,
    
    // Actions
    updateSetting,
    setLoading,
    setError,
    bulkUpdate,
    reset,
    clearErrors,
    
    // Getters
    getSetting,
    isLoading,
    getError,
    
    // Computed
    isAnyLoading,
    hasErrors,
    changedSettings
  };
};

export default useSettingsState;