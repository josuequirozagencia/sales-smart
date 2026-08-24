import React, { memo, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList, VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { makeStyles } from '@material-ui/core/styles';
import CircularProgress from '@material-ui/core/CircularProgress';

const useStyles = makeStyles((theme) => ({
    container: {
        height: '100%',
        width: '100%',
        position: 'relative'
    },
    loader: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: theme.spacing(3),
        color: theme.palette.text.secondary
    },
    scrollbar: {
        '& > div': {
            '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: theme.palette.primary.main,
                borderRadius: '4px',
                '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                }
            },
            '&::-webkit-scrollbar-track': {
                backgroundColor: theme.palette.action.hover,
                borderRadius: '4px',
            }
        }
    }
}));

/**
 * Componente de lista otimizada com virtualização
 * Suporta listas de tamanho fixo e variável
 * 
 * @param {Object} props - Propriedades do componente
 */
const OptimizedList = memo(({ 
    items = [], 
    renderItem,
    itemHeight = 50,
    variableHeight = false,
    getItemSize,
    onScroll,
    onItemsRendered,
    loading = false,
    emptyMessage = "Nenhum item encontrado",
    className = "",
    initialScrollOffset = 0,
    scrollToIndex,
    overscan = 5,
    useWindowScroll = false,
    estimatedItemSize = 50,
    threshold = 0.8,
    onEndReached,
    endReachedThreshold = 0.9,
    headerComponent = null,
    footerComponent = null,
    ...otherProps
}) => {
    const classes = useStyles();
    const listRef = useRef();
    const lastScrollOffset = useRef(0);
    const isEndReachedCalled = useRef(false);

    // Componente Row para renderização de cada item
    const Row = useCallback(({ index, style }) => {
        const item = items[index];
        if (!item) return null;
        
        // Ajustar estilo para incluir padding se necessário
        const adjustedStyle = {
            ...style,
            paddingRight: '8px', // Evitar sobreposição com scrollbar
        };
        
        return (
            <div style={adjustedStyle}>
                {renderItem(item, index)}
            </div>
        );
    }, [items, renderItem]);

    // Função de scroll personalizada
    const handleScroll = useCallback(({ scrollOffset, scrollHeight, scrollUpdateWasRequested }) => {
        lastScrollOffset.current = scrollOffset;
        
        // Verificar se chegou ao final
        if (onEndReached && !isEndReachedCalled.current) {
            const scrollPercentage = scrollOffset / scrollHeight;
            if (scrollPercentage >= endReachedThreshold) {
                isEndReachedCalled.current = true;
                onEndReached();
                
                // Reset flag após um delay
                setTimeout(() => {
                    isEndReachedCalled.current = false;
                }, 1000);
            }
        }
        
        if (onScroll) {
            onScroll({ 
                scrollOffset, 
                scrollHeight,
                scrollDirection: scrollOffset > lastScrollOffset.current ? 'forward' : 'backward'
            });
        }
    }, [onScroll, onEndReached, endReachedThreshold]);

    // Função para itens renderizados
    const handleItemsRendered = useCallback(({ 
        overscanStartIndex,
        overscanStopIndex,
        visibleStartIndex,
        visibleStopIndex
    }) => {
        if (onItemsRendered) {
            onItemsRendered({
                overscanStartIndex,
                overscanStopIndex,
                visibleStartIndex,
                visibleStopIndex,
                totalItems: items.length
            });
        }
    }, [onItemsRendered, items.length]);

    // Efeito para scroll até índice específico
    useEffect(() => {
        if (scrollToIndex !== undefined && listRef.current) {
            listRef.current.scrollToItem(scrollToIndex, 'start');
        }
    }, [scrollToIndex]);

    // Se estiver carregando, mostrar loader
    if (loading && items.length === 0) {
        return (
            <div className={classes.container}>
                <div className={classes.loader}>
                    <CircularProgress />
                </div>
            </div>
        );
    }

    // Se não houver itens, mostrar mensagem vazia
    if (!loading && items.length === 0) {
        return (
            <div className={classes.container}>
                <div className={classes.emptyState}>
                    {emptyMessage}
                </div>
            </div>
        );
    }

    // Componente de lista baseado no tipo
    const ListComponent = variableHeight ? VariableSizeList : FixedSizeList;
    
    // Props da lista
    const listProps = {
        ref: listRef,
        itemCount: items.length,
        overscanCount: overscan,
        onScroll: handleScroll,
        onItemsRendered: handleItemsRendered,
        initialScrollOffset,
        useIsScrolling: true,
        className: `${classes.scrollbar} ${className}`,
        ...otherProps
    };

    // Adicionar props específicas baseadas no tipo
    if (variableHeight) {
        listProps.itemSize = getItemSize || (() => estimatedItemSize);
        listProps.estimatedItemSize = estimatedItemSize;
    } else {
        listProps.itemSize = itemHeight;
    }

    return (
        <div className={classes.container}>
            {headerComponent}
            <AutoSizer>
                {({ height, width }) => (
                    <ListComponent
                        {...listProps}
                        height={height}
                        width={width}
                    >
                        {Row}
                    </ListComponent>
                )}
            </AutoSizer>
            {footerComponent}
            {loading && items.length > 0 && (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '10px',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(255, 255, 255, 0.9)'
                }}>
                    <CircularProgress size={20} />
                </div>
            )}
        </div>
    );
});

OptimizedList.displayName = 'OptimizedList';

export default OptimizedList;