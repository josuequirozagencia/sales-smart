import React, { useState, useEffect, useContext, useCallback, useMemo, lazy } from "react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { makeStyles, Paper, Tabs, Tab } from "@material-ui/core";
import LazyTabPanel from "../../components/LazyTabPanel";
import { i18n } from "../../translate/i18n";
import { toast } from "react-toastify";
import useCompanies from "../../hooks/useCompanies";
import { AuthContext } from "../../context/Auth/AuthContext";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import useSettings from "../../hooks/useSettings";
import ForbiddenPage from "../../components/ForbiddenPage";

// Lazy load heavy components
const SchedulesForm = lazy(() => import("../../components/SchedulesForm"));
const CompaniesManager = lazy(() => import("../../components/CompaniesManager"));
const PlansManager = lazy(() => import("../../components/PlansManager"));
const HelpsManager = lazy(() => import("../../components/HelpsManager"));
const OptionsOptimized = lazy(() => import("../../components/Settings/OptionsOptimized"));
const Whitelabel = lazy(() => import("../../components/Settings/Whitelabel"));
const FinalizacaoAtendimento = lazy(() => import("../../components/Settings/FinalizacaoAtendimento"));

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  mainPaper: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  tab: {
    backgroundColor: theme.mode === "light" ? "#f2f2f2" : "#7f7f7f",
    borderRadius: 4,
    flexShrink: 0,
  },
  paper: {
    display: "flex",
    width: "100%",
    flex: 1,
    overflow: "hidden",
    padding: 0,
  },
  container: {
    width: "100%",
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    ...theme.scrollbarStyles,
  },
}));

/**
 * Settings page otimizada com lazy loading e redução de re-renders
 */
const SettingsOptimized = () => {
  const classes = useStyles();
  const [activeTab, setActiveTab] = useState("options");
  const [data, setData] = useState({
    company: {},
    schedules: [],
    settings: {},
    oldSettings: {},
    schedulesEnabled: false,
    loading: false
  });

  const { find, updateSchedules } = useCompanies();
  const { getAll: getAllSettings } = useCompanySettings();
  const { getAll: getAllSettingsOld } = useSettings();
  const { user, socket } = useContext(AuthContext);

  // Memoized user checks
  const isSuper = useMemo(() => user?.super === true, [user?.super]);
  const isAdmin = useMemo(() => user?.profile === "admin", [user?.profile]);
  const canViewFinalizacao = useMemo(() => 
    isAdmin && user?.finalizacaoComValorVendaAtiva, 
    [isAdmin, user?.finalizacaoComValorVendaAtiva]
  );

  // Load data with Promise.all for parallel loading
  useEffect(() => {
    if (!user?.companyId) return;

    const loadData = async () => {
      setData(prev => ({ ...prev, loading: true }));
      
      try {
        const [company, settingList, settingListOld] = await Promise.all([
          find(user.companyId),
          getAllSettings(user.companyId),
          getAllSettingsOld()
        ]);

        // Single state update
        setData({
          company,
          schedules: company.schedules || [],
          settings: settingList || {},
          oldSettings: settingListOld || {},
          schedulesEnabled: settingList?.scheduleType === "company",
          loading: false
        });
      } catch (error) {
        console.error("Error loading settings:", error);
        toast.error(i18n.t("settings.loadError"));
        setData(prev => ({ ...prev, loading: false }));
      }
    };

    loadData();
  }, [user?.companyId, find, getAllSettings, getAllSettingsOld]);

  // Socket listener with cleanup
  useEffect(() => {
    if (!socket || !user?.companyId) return;

    const handleSettingsUpdate = async () => {
      try {
        const updatedSettings = await getAllSettingsOld();
        setData(prev => ({ ...prev, oldSettings: updatedSettings }));
      } catch (error) {
        console.error("Error updating settings from socket:", error);
      }
    };

    const eventName = `company-${user.companyId}-settings`;
    socket.on(eventName, handleSettingsUpdate);

    return () => {
      socket.off(eventName, handleSettingsUpdate);
    };
  }, [socket, user?.companyId, getAllSettingsOld]);

  // Memoized callbacks
  const handleTabChange = useCallback((event, newValue) => {
    setActiveTab(newValue);
  }, []);

  const handleSubmitSchedules = useCallback(async (scheduleData) => {
    setData(prev => ({ ...prev, loading: true }));
    
    try {
      await updateSchedules({ 
        id: data.company.id, 
        schedules: scheduleData 
      });
      
      setData(prev => ({ 
        ...prev, 
        schedules: scheduleData,
        loading: false 
      }));
      
      toast.success(i18n.t("settings.settings.options.successOperation"));
    } catch (error) {
      console.error("Error updating schedules:", error);
      toast.error(i18n.t("settings.updateError"));
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [data.company.id, updateSchedules]);

  const handleSettingsChange = useCallback((newSettings) => {
    setData(prev => ({ 
      ...prev, 
      settings: { ...prev.settings, ...newSettings } 
    }));
  }, []);

  const handleScheduleTypeChange = useCallback((value) => {
    setData(prev => ({ 
      ...prev, 
      schedulesEnabled: value === "company" 
    }));
  }, []);

  // Memoized tab configuration
  const tabs = useMemo(() => {
    const tabList = [
      { label: i18n.t("settings.tabs.options"), value: "options", show: true }
    ];

    if (data.schedulesEnabled) {
      tabList.push({ 
        label: i18n.t("settings.settings.options.schedules"), 
        value: "schedules", 
        show: true 
      });
    }

    if (canViewFinalizacao) {
      tabList.push({ 
        label: i18n.t("settings.settings.options.finalizationAttendance"), 
        value: "finalizacao", 
        show: true 
      });
    }

    if (isSuper) {
      tabList.push(
        { label: i18n.t("settings.tabs.companies"), value: "companies", show: true },
        { label: i18n.t("settings.tabs.helps"), value: "helps", show: true },
        { label: "Whitelabel", value: "whitelabel", show: true }
      );
    }

    if (isSuper || isAdmin) {
      tabList.push({ 
        label: i18n.t("settings.tabs.plans"), 
        value: "plans", 
        show: true 
      });
    }

    return tabList.filter(tab => tab.show);
  }, [data.schedulesEnabled, canViewFinalizacao, isSuper, isAdmin]);

  // Check user permissions
  if (user?.profile === "user") {
    return <ForbiddenPage />;
  }

  return (
    <MainContainer className={classes.root}>
      <MainHeader>
        <Title>{i18n.t("settings.title")}</Title>
      </MainHeader>
      
      <Paper className={classes.mainPaper} elevation={1}>
        <Tabs
          value={activeTab}
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          onChange={handleTabChange}
          className={classes.tab}
        >
          {tabs.map(tab => (
            <Tab key={tab.value} label={tab.label} value={tab.value} />
          ))}
        </Tabs>

        <Paper className={classes.paper} elevation={0}>
          {/* Options Tab - Always visible */}
          <LazyTabPanel
            className={classes.container}
            value={activeTab}
            name="options"
            keepMounted
          >
            <OptionsOptimized
              settings={data.settings}
              oldSettings={data.oldSettings}
              user={user}
              scheduleTypeChanged={handleScheduleTypeChange}
            />
          </LazyTabPanel>

          {/* Schedules Tab */}
          {data.schedulesEnabled && (
            <LazyTabPanel
              className={classes.container}
              value={activeTab}
              name="schedules"
            >
              <SchedulesForm
                loading={data.loading}
                onSubmit={handleSubmitSchedules}
                initialValues={data.schedules}
              />
            </LazyTabPanel>
          )}

          {/* Finalization Tab */}
          {canViewFinalizacao && (
            <LazyTabPanel
              className={classes.container}
              value={activeTab}
              name="finalizacao"
            >
              <FinalizacaoAtendimento
                settings={data.settings}
                onSettingsChange={handleSettingsChange}
              />
            </LazyTabPanel>
          )}

          {/* Plans Tab */}
          {(isSuper || isAdmin) && (
            <LazyTabPanel
              className={classes.container}
              value={activeTab}
              name="plans"
            >
              <PlansManager />
            </LazyTabPanel>
          )}

          {/* Super User Only Tabs */}
          {isSuper && (
            <>
              <LazyTabPanel
                className={classes.container}
                value={activeTab}
                name="companies"
              >
                <CompaniesManager />
              </LazyTabPanel>

              <LazyTabPanel
                className={classes.container}
                value={activeTab}
                name="helps"
              >
                <HelpsManager />
              </LazyTabPanel>

              <LazyTabPanel
                className={classes.container}
                value={activeTab}
                name="whitelabel"
              >
                <Whitelabel settings={data.oldSettings} />
              </LazyTabPanel>
            </>
          )}
        </Paper>
      </Paper>
    </MainContainer>
  );
};

export default SettingsOptimized;