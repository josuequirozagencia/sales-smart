import { useRef, useCallback, useMemo } from 'react';
import { VariableSizeList } from 'react-window';

/**
 * Hook customizado para virtualização de listas com performance otimizada
 * @param {Array} items - Array de itens para renderizar
 * @param {Function} renderItem - Função para renderizar cada item
 * @param {Object} options - Opções de configuração
 * @returns {Object} - Objetos e funções necessários para a lista virtualizada
 */
export const useVirtualList = (items, renderItem, options = {}) => {
    const listRef = useRef();
    const itemHeightCache = useRef({});
    
    const {
        itemHeight = 100,
        overscan = 5,
        threshold = 0.8,
        estimateItemSize = null,
        width = '100%',
        height = 600
    } = options;

    // Função para calcular altura de cada item
    const getItemSize = useCallback((index) => {
        // Se já temos a altura cacheada, use-a
        if (itemHeightCache.current[index]) {
            return itemHeightCache.current[index];
        }
        
        // Se uma função de estimativa foi fornecida, use-a
        if (estimateItemSize && typeof estimateItemSize === 'function') {
            const estimatedHeight = estimateItemSize(items[index], index);
            itemHeightCache.current[index] = estimatedHeight;
            return estimatedHeight;
        }
        
        // Caso contrário, use a altura padrão
        return itemHeight;
    }, [items, itemHeight, estimateItemSize]);

    // Componente Row memoizado para renderização de cada item
    const Row = useCallback(({ index, style }) => {
        const item = items[index];
        if (!item) return null;
        
        return (
            <div style={style}>
                {renderItem(item, index)}
            </div>
        );
    }, [items, renderItem]);

    // Função para rolar até um item específico
    const scrollToItem = useCallback((index, align = 'start') => {
        if (listRef.current) {
            listRef.current.scrollToItem(index, align);
        }
    }, []);

    // Função para resetar o cache de alturas
    const resetHeightCache = useCallback(() => {
        itemHeightCache.current = {};
        if (listRef.current) {
            listRef.current.resetAfterIndex(0);
        }
    }, []);

    // Função para atualizar altura de um item específico
    const updateItemHeight = useCallback((index, height) => {
        if (itemHeightCache.current[index] !== height) {
            itemHeightCache.current[index] = height;
            if (listRef.current) {
                listRef.current.resetAfterIndex(index);
            }
        }
    }, []);

    // Configurações da lista memoizadas
    const listConfig = useMemo(() => ({
        ref: listRef,
        height,
        width,
        itemCount: items.length,
        itemSize: getItemSize,
        overscanCount: overscan,
        onItemsRendered: ({ visibleStartIndex, visibleStopIndex }) => {
            // Callback opcional para quando itens são renderizados
            if (options.onItemsRendered) {
                options.onItemsRendered({ 
                    visibleStartIndex, 
                    visibleStopIndex,
                    totalItems: items.length 
                });
            }
        },
        onScroll: ({ scrollOffset, scrollDirection }) => {
            // Callback opcional para scroll
            if (options.onScroll) {
                const scrollPercentage = scrollOffset / (items.length * itemHeight);
                options.onScroll({ 
                    scrollOffset, 
                    scrollDirection,
                    scrollPercentage 
                });
            }
        }
    }), [height, width, items.length, getItemSize, overscan, itemHeight, options]);

    return {
        listRef,
        Row,
        scrollToItem,
        resetHeightCache,
        updateItemHeight,
        listConfig,
        getItemSize,
        itemCount: items.length
    };
};

export default useVirtualList;