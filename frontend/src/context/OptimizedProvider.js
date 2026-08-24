import React, { createContext, useContext, useMemo, useCallback, useRef, useState } from 'react';

/**
 * Factory para criar contexts otimizados que evitam re-renders desnecessários
 */
export const createOptimizedContext = (name) => {
  const StateContext = createContext();
  const DispatchContext = createContext();

  const useStateContext = () => {
    const context = useContext(StateContext);
    if (!context) {
      throw new Error(`use${name}State must be used within ${name}Provider`);
    }
    return context;
  };

  const useDispatchContext = () => {
    const context = useContext(DispatchContext);
    if (!context) {
      throw new Error(`use${name}Dispatch must be used within ${name}Provider`);
    }
    return context;
  };

  return {
    StateContext,
    DispatchContext,
    useStateContext,
    useDispatchContext
  };
};

/**
 * Provider otimizado que separa state de dispatch para evitar re-renders
 */
export const OptimizedProvider = ({ 
  children, 
  initialState, 
  reducer,
  StateContext,
  DispatchContext 
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  // Memoizar o dispatch para que nunca mude
  const memoizedDispatch = useMemo(() => dispatch, []);
  
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={memoizedDispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
};

/**
 * Hook para criar selectors memoizados
 */
export const useSelector = (selector, deps = []) => {
  const ref = useRef();
  const state = useContext(StateContext);
  
  const selectedValue = useMemo(() => {
    const value = selector(state);
    ref.current = value;
    return value;
  }, [state, ...deps]);
  
  // Retorna o valor anterior se o novo for igual (shallow comparison)
  if (shallowEqual(ref.current, selectedValue)) {
    return ref.current;
  }
  
  return selectedValue;
};

/**
 * Hook para batch updates e evitar múltiplos re-renders
 */
export const useBatchUpdate = () => {
  const pendingUpdates = useRef([]);
  const timeoutRef = useRef();
  
  const batchUpdate = useCallback((updateFn) => {
    pendingUpdates.current.push(updateFn);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      ReactDOM.unstable_batchedUpdates(() => {
        pendingUpdates.current.forEach(fn => fn());
        pendingUpdates.current = [];
      });
    }, 0);
  }, []);
  
  return batchUpdate;
};

/**
 * Provider combinado otimizado para múltiplos contexts
 */
export const CombinedProvider = ({ children, providers }) => {
  return providers.reduceRight(
    (acc, Provider) => <Provider>{acc}</Provider>,
    children
  );
};

/**
 * Hook para prevenir re-renders com deep comparison
 */
export const useDeepMemo = (factory, deps) => {
  const ref = useRef();
  
  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = {
      deps,
      value: factory()
    };
  }
  
  return ref.current.value;
};

/**
 * Hook para callbacks estáveis
 */
export const useStableCallback = (callback) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  
  return useCallback((...args) => {
    return callbackRef.current(...args);
  }, []);
};

/**
 * Utility: Shallow comparison
 */
const shallowEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (let key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }
  
  return true;
};

/**
 * Utility: Deep comparison
 */
const deepEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (let key of keys1) {
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
};

/**
 * Context para cache global de dados
 */
const CacheContext = createContext(new Map());

export const CacheProvider = ({ children }) => {
  const cache = useRef(new Map());
  
  const getCached = useCallback((key, factory) => {
    if (cache.current.has(key)) {
      return cache.current.get(key);
    }
    
    const value = factory();
    cache.current.set(key, value);
    
    // Limpar cache antigo se ficar muito grande
    if (cache.current.size > 100) {
      const firstKey = cache.current.keys().next().value;
      cache.current.delete(firstKey);
    }
    
    return value;
  }, []);
  
  const clearCache = useCallback((key) => {
    if (key) {
      cache.current.delete(key);
    } else {
      cache.current.clear();
    }
  }, []);
  
  const value = useMemo(() => ({
    getCached,
    clearCache
  }), [getCached, clearCache]);
  
  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  );
};

export const useCache = () => useContext(CacheContext);

export default {
  createOptimizedContext,
  OptimizedProvider,
  useSelector,
  useBatchUpdate,
  CombinedProvider,
  useDeepMemo,
  useStableCallback,
  CacheProvider,
  useCache
};