import { useMemo, useRef, useCallback } from 'react';

/**
 * Hook para gerenciar cache de mensagens processadas
 * Evita reprocessamento de mensagens já formatadas
 */
export const useMessageCache = () => {
    const cache = useRef(new Map());
    const formatCache = useRef(new Map());
    const mediaCache = useRef(new Map());
    
    /**
     * Obtém uma mensagem cacheada
     * @param {string} messageId - ID da mensagem
     * @returns {Object|null} - Mensagem cacheada ou null
     */
    const getCachedMessage = useCallback((messageId) => {
        return cache.current.get(messageId) || null;
    }, []);
    
    /**
     * Armazena uma mensagem processada no cache
     * @param {string} messageId - ID da mensagem
     * @param {Object} processedMessage - Mensagem processada
     */
    const setCachedMessage = useCallback((messageId, processedMessage) => {
        cache.current.set(messageId, {
            ...processedMessage,
            cachedAt: Date.now()
        });
        
        // Limitar tamanho do cache (máximo 1000 mensagens)
        if (cache.current.size > 1000) {
            const firstKey = cache.current.keys().next().value;
            cache.current.delete(firstKey);
        }
    }, []);
    
    /**
     * Cache para formatação de datas
     * @param {string} dateString - String da data
     * @param {string} format - Formato desejado
     * @returns {string} - Data formatada
     */
    const getCachedDateFormat = useCallback((dateString, format) => {
        const cacheKey = `${dateString}-${format}`;
        return formatCache.current.get(cacheKey);
    }, []);
    
    /**
     * Armazena formatação de data no cache
     * @param {string} dateString - String da data
     * @param {string} format - Formato
     * @param {string} formatted - Data formatada
     */
    const setCachedDateFormat = useCallback((dateString, format, formatted) => {
        const cacheKey = `${dateString}-${format}`;
        formatCache.current.set(cacheKey, formatted);
        
        // Limitar cache de formatação
        if (formatCache.current.size > 500) {
            const firstKey = formatCache.current.keys().next().value;
            formatCache.current.delete(firstKey);
        }
    }, []);
    
    /**
     * Cache para verificações de mídia
     * @param {string} messageId - ID da mensagem
     * @returns {Object|null} - Informações de mídia cacheadas
     */
    const getCachedMediaCheck = useCallback((messageId) => {
        return mediaCache.current.get(messageId);
    }, []);
    
    /**
     * Armazena resultado de verificação de mídia
     * @param {string} messageId - ID da mensagem
     * @param {Object} mediaInfo - Informações da mídia
     */
    const setCachedMediaCheck = useCallback((messageId, mediaInfo) => {
        mediaCache.current.set(messageId, mediaInfo);
        
        // Limitar cache de mídia
        if (mediaCache.current.size > 300) {
            const firstKey = mediaCache.current.keys().next().value;
            mediaCache.current.delete(firstKey);
        }
    }, []);
    
    /**
     * Limpa todo o cache
     */
    const clearCache = useCallback(() => {
        cache.current.clear();
        formatCache.current.clear();
        mediaCache.current.clear();
    }, []);
    
    /**
     * Limpa mensagens antigas do cache (mais de 10 minutos)
     */
    const clearOldCache = useCallback(() => {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        
        for (const [key, value] of cache.current.entries()) {
            if (value.cachedAt && value.cachedAt < tenMinutesAgo) {
                cache.current.delete(key);
            }
        }
    }, []);
    
    /**
     * Obtém estatísticas do cache
     */
    const getCacheStats = useCallback(() => {
        return {
            messagesCount: cache.current.size,
            formatsCount: formatCache.current.size,
            mediaCount: mediaCache.current.size,
            totalSize: cache.current.size + formatCache.current.size + mediaCache.current.size
        };
    }, []);
    
    /**
     * Verifica se uma mensagem está cacheada
     * @param {string} messageId - ID da mensagem
     * @returns {boolean}
     */
    const isCached = useCallback((messageId) => {
        return cache.current.has(messageId);
    }, []);
    
    /**
     * Remove uma mensagem específica do cache
     * @param {string} messageId - ID da mensagem
     */
    const removeCachedMessage = useCallback((messageId) => {
        cache.current.delete(messageId);
        mediaCache.current.delete(messageId);
    }, []);
    
    // Retornar métodos e propriedades úteis
    return useMemo(() => ({
        // Mensagens
        getCachedMessage,
        setCachedMessage,
        isCached,
        removeCachedMessage,
        
        // Formatação de datas
        getCachedDateFormat,
        setCachedDateFormat,
        
        // Verificações de mídia
        getCachedMediaCheck,
        setCachedMediaCheck,
        
        // Gerenciamento de cache
        clearCache,
        clearOldCache,
        getCacheStats,
        
        // Tamanho atual do cache
        size: cache.current.size
    }), [
        getCachedMessage,
        setCachedMessage,
        isCached,
        removeCachedMessage,
        getCachedDateFormat,
        setCachedDateFormat,
        getCachedMediaCheck,
        setCachedMediaCheck,
        clearCache,
        clearOldCache,
        getCacheStats
    ]);
};

export default useMessageCache;