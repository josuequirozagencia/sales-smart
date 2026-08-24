import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook para monitorar e otimizar performance
 * Detecta re-renders excessivos e componentes lentos
 */
export const usePerformanceMonitor = (componentName, props = {}) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const propsRef = useRef(props);

  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    // Alerta se houver re-renders muito frequentes (menos de 100ms entre renders)
    if (timeSinceLastRender < 100 && renderCount.current > 1) {
      console.warn(
        `[Performance] ${componentName} está re-renderizando muito frequentemente!`,
        {
          renderCount: renderCount.current,
          timeBetweenRenders: timeSinceLastRender + 'ms',
          props: Object.keys(props)
        }
      );
    }

    // Detectar mudanças de props
    const changedProps = [];
    Object.keys(props).forEach(key => {
      if (propsRef.current[key] !== props[key]) {
        changedProps.push(key);
      }
    });

    if (changedProps.length > 0 && process.env.NODE_ENV === 'development') {
      console.log(
        `[Performance] ${componentName} re-renderizado devido a mudanças em:`,
        changedProps
      );
    }

    propsRef.current = props;
  });

  // Medir tempo de execução de funções
  const measureFunction = useCallback((fn, fnName) => {
    return (...args) => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();
      
      if (end - start > 16) { // Mais que 1 frame (16ms)
        console.warn(
          `[Performance] ${componentName}.${fnName} levou ${(end - start).toFixed(2)}ms`
        );
      }
      
      return result;
    };
  }, [componentName]);

  return {
    renderCount: renderCount.current,
    measureFunction
  };
};

/**
 * Hook para detectar memory leaks
 */
export const useMemoryLeakDetector = (componentName) => {
  useEffect(() => {
    const startMemory = performance.memory?.usedJSHeapSize;
    
    return () => {
      if (performance.memory) {
        const endMemory = performance.memory.usedJSHeapSize;
        const diff = endMemory - startMemory;
        
        // Alerta se houver aumento significativo de memória (> 5MB)
        if (diff > 5 * 1024 * 1024) {
          console.warn(
            `[Memory] Possível memory leak em ${componentName}:`,
            `${(diff / 1024 / 1024).toFixed(2)}MB não liberados`
          );
        }
      }
    };
  }, [componentName]);
};

/**
 * Hook para lazy loading de imagens
 */
export const useLazyImageLoader = (imageSrc, placeholder = '') => {
  const [src, setSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = new Image();
            img.src = imageSrc;
            img.onload = () => {
              setSrc(imageSrc);
              setIsLoading(false);
            };
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [imageSrc]);

  return { src, isLoading, imgRef };
};

/**
 * Hook para debounce otimizado
 */
export const useOptimizedDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef();

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook para virtualização de listas
 */
export const useVirtualList = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight)
  );
  
  const visibleItems = items.slice(startIndex, endIndex + 1);
  
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);
  
  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex
  };
};

export default usePerformanceMonitor;