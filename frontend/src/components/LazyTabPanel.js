import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { Box, CircularProgress, Fade } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    width: '100%'
  },
  fadeContainer: {
    width: '100%'
  }
}));

/**
 * TabPanel otimizado que só renderiza o conteúdo quando a tab está ativa
 * Implementa lazy loading e previne re-renders desnecessários
 */
const LazyTabPanel = ({ 
  children, 
  value, 
  name, 
  keepMounted = false,
  lazyLoad = true,
  onMount,
  onUnmount,
  ...rest 
}) => {
  const classes = useStyles();
  const [hasBeenActive, setHasBeenActive] = useState(false);
  
  const isActive = useMemo(() => value === name, [value, name]);

  // Track if this tab has ever been active
  useEffect(() => {
    if (isActive && !hasBeenActive) {
      setHasBeenActive(true);
      if (onMount) onMount();
    }
    
    return () => {
      if (isActive && onUnmount) {
        onUnmount();
      }
    };
  }, [isActive, hasBeenActive, onMount, onUnmount]);

  // Determine if we should render content
  const shouldRenderContent = useMemo(() => {
    if (isActive) return true;
    if (keepMounted && hasBeenActive) return true;
    if (!lazyLoad) return true;
    return false;
  }, [isActive, keepMounted, hasBeenActive, lazyLoad]);

  // Don't render anything if conditions aren't met
  if (!shouldRenderContent) return null;

  const content = (
    <Fade in={isActive} timeout={300}>
      <Box
        role="tabpanel"
        hidden={!isActive}
        id={`tabpanel-${name}`}
        aria-labelledby={`tab-${name}`}
        {...rest}
        className={`${classes.fadeContainer} ${rest.className || ''}`}
      >
        {isActive && children}
      </Box>
    </Fade>
  );

  // If lazy loading is enabled and content might be async
  if (lazyLoad && React.isValidElement(children) && children.type?.constructor?.name === 'Promise') {
    return (
      <Suspense 
        fallback={
          <Box className={classes.loadingContainer}>
            <CircularProgress />
          </Box>
        }
      >
        {content}
      </Suspense>
    );
  }

  return content;
};

// Memoized version to prevent unnecessary re-renders
export default React.memo(LazyTabPanel, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.value === nextProps.value &&
    prevProps.name === nextProps.name &&
    prevProps.children === nextProps.children
  );
});