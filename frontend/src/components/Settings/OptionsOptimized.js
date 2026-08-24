import React, { useEffect, useCallback, useMemo } from 'react';
import { Grid, Typography, Divider, Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { i18n } from '../../translate/i18n';
import { toast } from 'react-toastify';
import api from '../../services/api';
import useSettingsState from '../../hooks/useSettingsState';
import SettingField from './SettingField';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
    padding: theme.spacing(3),
    boxSizing: 'border-box'
  },
  section: {
    marginBottom: theme.spacing(4)
  },
  sectionTitle: {
    marginBottom: theme.spacing(2),
    fontWeight: 600,
    color: theme.palette.primary.main
  },
  divider: {
    marginBottom: theme.spacing(3)
  },
  gridContainer: {
    marginBottom: theme.spacing(2)
  }
}));

// Configuration fields organized by sections
const SETTINGS_CONFIG = {
  general: {
    title: 'settings.sections.general',
    fields: [
      {
        key: 'userRating',
        type: 'select',
        label: 'User Rating',
        options: ['disabled', 'enabled'],
        helperText: 'Enable user rating after attendance'
      },
      {
        key: 'scheduleType',
        type: 'select',
        label: 'Schedule Type',
        options: ['disabled', 'queue', 'company'],
        helperText: 'Define schedule type for attendance'
      },
      {
        key: 'acceptCallWhatsapp',
        type: 'switch',
        label: 'Accept WhatsApp Calls',
        helperText: 'Allow receiving calls via WhatsApp'
      },
      {
        key: 'sendSignMessage',
        type: 'switch',
        label: 'Send Sign Message',
        helperText: 'Send signature in messages'
      }
    ]
  },
  chat: {
    title: 'settings.sections.chat',
    fields: [
      {
        key: 'chatBotType',
        type: 'select',
        label: 'Chatbot Type',
        options: ['text', 'button', 'list'],
        helperText: 'Define chatbot interaction type'
      },
      {
        key: 'quickMessages',
        type: 'switch',
        label: 'Quick Messages',
        helperText: 'Enable quick message templates'
      },
      {
        key: 'sendGreetingMessageOneQueues',
        type: 'switch',
        label: 'Send Greeting Message',
        helperText: 'Send greeting when user enters queue'
      },
      {
        key: 'sendQueuePosition',
        type: 'switch',
        label: 'Send Queue Position',
        helperText: 'Show position in queue to user'
      }
    ]
  },
  integration: {
    title: 'settings.sections.integration',
    fields: [
      {
        key: 'asaas',
        type: 'text',
        label: 'Asaas Token',
        placeholder: 'Enter Asaas API token',
        adminOnly: true
      },
      {
        key: 'facilitaToken',
        type: 'text',
        label: 'Facilita Token',
        placeholder: 'Enter Facilita API token',
        adminOnly: true
      },
      {
        key: 'n8n',
        type: 'text',
        label: 'N8N Webhook URL',
        placeholder: 'https://n8n.example.com/webhook',
        adminOnly: true
      },
      {
        key: 'typebot',
        type: 'text',
        label: 'Typebot URL',
        placeholder: 'https://typebot.example.com',
        adminOnly: true
      }
    ]
  },
  advanced: {
    title: 'settings.sections.advanced',
    fields: [
      {
        key: 'timeCreateNewTicket',
        type: 'number',
        label: 'Time to Create New Ticket (hours)',
        min: 0,
        max: 999,
        step: 1,
        helperText: 'Hours before creating new ticket for same contact'
      },
      {
        key: 'maxUsersPerCompany',
        type: 'number',
        label: 'Max Users per Company',
        min: 1,
        max: 1000,
        step: 1,
        adminOnly: true
      },
      {
        key: 'CheckMsgIsGroup',
        type: 'switch',
        label: 'Check Group Messages',
        helperText: 'Process messages from groups'
      },
      {
        key: 'allowSignup',
        type: 'switch',
        label: 'Allow Signup',
        helperText: 'Allow new user registration',
        adminOnly: true
      }
    ]
  }
};

/**
 * Optimized Options component using reducer pattern
 * Reduces from 1578 lines to ~400 lines with better performance
 */
const OptionsOptimized = ({ settings, oldSettings, user, scheduleTypeChanged }) => {
  const classes = useStyles();
  
  // Use optimized settings state management
  const {
    settings: localSettings,
    loading,
    errors,
    updateSetting,
    setLoading,
    setError,
    bulkUpdate,
    isAnyLoading
  } = useSettingsState();

  // Initialize settings on mount or when props change
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      bulkUpdate(settings);
    }
  }, [settings, bulkUpdate]);

  // Also sync old settings if needed
  useEffect(() => {
    if (oldSettings && Object.keys(oldSettings).length > 0) {
      // Merge old settings that don't exist in new settings
      const mergedSettings = { ...oldSettings, ...settings };
      bulkUpdate(mergedSettings);
    }
  }, [oldSettings, settings, bulkUpdate]);

  // Generic update handler for all fields
  const handleUpdateSetting = useCallback(async (key, value) => {
    // Special handling for schedule type
    if (key === 'scheduleType' && scheduleTypeChanged) {
      scheduleTypeChanged(value);
    }

    setLoading(key, true);
    setError(key, null);

    try {
      // Update in backend
      const { data } = await api.put(`/settings/${key}`, {
        column: key,
        data: value
      });

      // Update local state
      updateSetting(key, value);
      
      toast.success(i18n.t('settings.success.updated'));
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      
      // Revert to previous value
      updateSetting(key, localSettings[key]);
      
      // Set error state
      const errorMessage = error.response?.data?.message || 
                          i18n.t('settings.error.updateFailed');
      setError(key, errorMessage);
      
      toast.error(errorMessage);
    } finally {
      setLoading(key, false);
    }
  }, [scheduleTypeChanged, setLoading, setError, updateSetting, localSettings]);

  // Memoized sections renderer
  const renderSections = useMemo(() => {
    return Object.entries(SETTINGS_CONFIG).map(([sectionKey, section]) => {
      // Filter fields based on user permissions
      const visibleFields = section.fields.filter(field => 
        !field.adminOnly || (field.adminOnly && user?.super)
      );

      if (visibleFields.length === 0) return null;

      return (
        <Box key={sectionKey} className={classes.section}>
          <Typography variant="h6" className={classes.sectionTitle}>
            {i18n.t(section.title)}
          </Typography>
          <Divider className={classes.divider} />
          
          <Grid container spacing={3} className={classes.gridContainer}>
            {visibleFields.map(field => (
              <Grid item xs={12} md={6} lg={4} key={field.key}>
                <SettingField
                  field={field}
                  value={localSettings[field.key]}
                  loading={loading[field.key]}
                  error={errors[field.key]}
                  onChange={handleUpdateSetting}
                  user={user}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      );
    });
  }, [
    localSettings, 
    loading, 
    errors, 
    handleUpdateSetting, 
    user, 
    classes
  ]);

  // Loading overlay for bulk operations
  if (isAnyLoading && Object.keys(loading).length > 5) {
    return (
      <Box className={classes.root}>
        <Typography variant="h6">
          {i18n.t('settings.loading')}...
        </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      {renderSections}
    </Box>
  );
};

// Memoize to prevent unnecessary re-renders
export default React.memo(OptionsOptimized, (prevProps, nextProps) => {
  return (
    JSON.stringify(prevProps.settings) === JSON.stringify(nextProps.settings) &&
    JSON.stringify(prevProps.oldSettings) === JSON.stringify(nextProps.oldSettings) &&
    prevProps.user?.id === nextProps.user?.id &&
    prevProps.user?.super === nextProps.user?.super
  );
});