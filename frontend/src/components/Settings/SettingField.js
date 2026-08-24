import React, { memo, useCallback, useMemo } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  CircularProgress,
  FormHelperText,
  Tooltip,
  IconButton
} from '@material-ui/core';
import { HelpOutline } from '@material-ui/icons';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  formControl: {
    marginBottom: theme.spacing(2),
    position: 'relative'
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    right: theme.spacing(1),
    transform: 'translateY(-50%)'
  },
  helperIcon: {
    marginLeft: theme.spacing(1)
  }
}));

/**
 * Componente genérico otimizado para campos de configuração
 * Suporta múltiplos tipos e previne re-renders desnecessários
 */
const SettingField = memo(({ 
  field, 
  value, 
  loading = false, 
  error = null,
  onChange, 
  disabled = false,
  user,
  className
}) => {
  const classes = useStyles();
  
  const {
    key,
    type = 'text',
    label,
    options = [],
    placeholder,
    helperText,
    tooltip,
    required = false,
    adminOnly = false,
    multiline = false,
    rows = 4,
    min,
    max,
    step
  } = field;

  // Skip rendering if user doesn't have permission
  if (adminOnly && (!user || !user.super)) {
    return null;
  }

  // Memoized change handler
  const handleChange = useCallback((event) => {
    const newValue = type === 'switch' 
      ? event.target.checked 
      : event.target.value;
    
    if (onChange) {
      onChange(key, newValue);
    }
  }, [key, type, onChange]);

  // Memoized value formatting
  const formattedValue = useMemo(() => {
    if (value === undefined || value === null) {
      return type === 'switch' ? false : '';
    }
    return value;
  }, [value, type]);

  // Render helper text with error priority
  const renderHelperText = () => {
    if (error) {
      return <FormHelperText error>{error}</FormHelperText>;
    }
    if (helperText) {
      return <FormHelperText>{helperText}</FormHelperText>;
    }
    return null;
  };

  // Render tooltip if provided
  const renderTooltip = () => {
    if (!tooltip) return null;
    
    return (
      <Tooltip title={tooltip} placement="right">
        <IconButton size="small" className={classes.helperIcon}>
          <HelpOutline fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  };

  // Main render based on type
  const renderField = () => {
    switch (type) {
      case 'select':
        return (
          <FormControl 
            fullWidth 
            className={classes.formControl}
            error={!!error}
            disabled={disabled || loading}
          >
            <InputLabel required={required}>
              {label}
            </InputLabel>
            <Select
              value={formattedValue}
              onChange={handleChange}
              label={label}
            >
              {options.map((option) => {
                const optionValue = typeof option === 'object' ? option.value : option;
                const optionLabel = typeof option === 'object' ? option.label : option;
                
                return (
                  <MenuItem key={optionValue} value={optionValue}>
                    {optionLabel}
                  </MenuItem>
                );
              })}
            </Select>
            {renderHelperText()}
            {loading && (
              <CircularProgress 
                size={20} 
                className={classes.loadingOverlay}
              />
            )}
          </FormControl>
        );

      case 'switch':
        return (
          <FormControl 
            fullWidth 
            className={classes.formControl}
            error={!!error}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={formattedValue}
                  onChange={handleChange}
                  disabled={disabled || loading}
                  color="primary"
                />
              }
              label={
                <span>
                  {label}
                  {required && ' *'}
                  {renderTooltip()}
                </span>
              }
            />
            {renderHelperText()}
            {loading && (
              <CircularProgress 
                size={20} 
                className={classes.loadingOverlay}
              />
            )}
          </FormControl>
        );

      case 'number':
        return (
          <FormControl 
            fullWidth 
            className={classes.formControl}
            error={!!error}
          >
            <TextField
              type="number"
              label={label}
              value={formattedValue}
              onChange={handleChange}
              disabled={disabled || loading}
              required={required}
              placeholder={placeholder}
              error={!!error}
              helperText={error || helperText}
              InputProps={{
                inputProps: { min, max, step },
                endAdornment: loading && (
                  <CircularProgress size={20} />
                )
              }}
            />
          </FormControl>
        );

      case 'textarea':
        return (
          <FormControl 
            fullWidth 
            className={classes.formControl}
            error={!!error}
          >
            <TextField
              label={label}
              value={formattedValue}
              onChange={handleChange}
              disabled={disabled || loading}
              required={required}
              placeholder={placeholder}
              multiline
              rows={rows}
              variant="outlined"
              error={!!error}
              helperText={error || helperText}
              InputProps={{
                endAdornment: loading && (
                  <CircularProgress size={20} />
                )
              }}
            />
          </FormControl>
        );

      case 'text':
      default:
        return (
          <FormControl 
            fullWidth 
            className={classes.formControl}
            error={!!error}
          >
            <TextField
              label={label}
              value={formattedValue}
              onChange={handleChange}
              disabled={disabled || loading}
              required={required}
              placeholder={placeholder}
              error={!!error}
              helperText={error || helperText}
              InputProps={{
                endAdornment: loading && (
                  <CircularProgress size={20} />
                )
              }}
            />
          </FormControl>
        );
    }
  };

  return (
    <div className={className}>
      {renderField()}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo
  return (
    prevProps.value === nextProps.value &&
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.field.key === nextProps.field.key
  );
});

SettingField.displayName = 'SettingField';

export default SettingField;