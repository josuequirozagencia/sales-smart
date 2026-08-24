// Utilitários para gerenciamento de cache e atualização da aplicação

/**
 * Limpa todo o cache do navegador
 */
export const clearAllCache = async () => {
  // Limpar cache do navegador
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('Cache do navegador limpo');
  }

  // Limpar localStorage exceto dados importantes
  const keysToKeep = ['token', 'username', 'companyId', 'userId', 'i18nextLng'];
  const savedData = {};
  
  keysToKeep.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) savedData[key] = value;
  });
  
  localStorage.clear();
  
  // Restaurar dados importantes
  Object.keys(savedData).forEach(key => {
    localStorage.setItem(key, savedData[key]);
  });
  
  console.log('LocalStorage limpo (dados importantes preservados)');
  
  // Limpar sessionStorage
  sessionStorage.clear();
  console.log('SessionStorage limpo');
};

/**
 * Força uma atualização completa da aplicação
 */
export const forceAppUpdate = () => {
  clearAllCache().then(() => {
    // Reload com bypass de cache
    window.location.reload(true);
  });
};

/**
 * Verifica se há uma nova versão disponível
 */
export const checkForUpdates = async (api) => {
  try {
    const response = await api.get("/version");
    const { data } = response;
    const currentVersion = window.localStorage.getItem("frontendVersion");
    
    if (currentVersion && currentVersion !== data.version) {
      return {
        hasUpdate: true,
        currentVersion,
        newVersion: data.version
      };
    }
    
    return {
      hasUpdate: false,
      currentVersion: data.version,
      newVersion: data.version
    };
  } catch (error) {
    console.error("Erro ao verificar atualizações:", error);
    return {
      hasUpdate: false,
      error: true
    };
  }
};

/**
 * Adiciona um listener para detectar quando a aplicação volta a ficar visível
 */
export const addVisibilityChangeListener = (callback) => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      callback();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Retorna função para remover o listener
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};

/**
 * Adiciona meta tag para prevenir cache no desenvolvimento
 */
export const addNoCacheMetaTags = () => {
  const metaTags = [
    { httpEquiv: 'Cache-Control', content: 'no-cache, no-store, must-revalidate' },
    { httpEquiv: 'Pragma', content: 'no-cache' },
    { httpEquiv: 'Expires', content: '0' }
  ];
  
  metaTags.forEach(tag => {
    const meta = document.createElement('meta');
    meta.httpEquiv = tag.httpEquiv;
    meta.content = tag.content;
    document.head.appendChild(meta);
  });
};