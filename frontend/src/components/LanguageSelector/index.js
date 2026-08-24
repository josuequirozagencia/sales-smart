import React, { useState, useEffect } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  makeStyles,
  Typography,
  Box,
} from '@material-ui/core';
import { Language } from '@material-ui/icons';
import { i18n } from '../../translate/i18n';
import useSettings from '../../hooks/useSettings';

const useStyles = makeStyles((theme) => ({
  formControl: {
    minWidth: 120,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    position: 'relative',
    zIndex: 2,
  },
  select: {
    backgroundColor: theme.palette.background.paper,
    borderRadius: '8px',
    padding: '4px 8px',
    position: 'relative',
    zIndex: 2,
    '& .MuiSelect-icon': {
      color: theme.palette.primary.main,
    },
    // Mantém o fundo visível no hover/focus dentro do AppBar
    '&:hover': {
      backgroundColor: theme.palette.background.paper,
    },
    '& .MuiSelect-select:focus': {
      backgroundColor: 'transparent',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none',
    },
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  flag: {
    width: '24px',
    height: '18px',
    borderRadius: '2px',
    marginRight: theme.spacing(1),
  },
  languageIcon: {
    marginRight: theme.spacing(1),
    color: theme.palette.primary.main,
  },
  languageContainer: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: theme.spacing(1),
    borderRadius: '8px',
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

const languages = [
  { 
    code: 'pt', 
    name: 'Português', 
    flag: '🇧🇷',
    nativeName: 'Português (Brasil)'
  },
  { 
    code: 'en', 
    name: 'English', 
    flag: '🇺🇸',
    nativeName: 'English (US)'
  },
  { 
    code: 'es', 
    name: 'Español', 
    flag: '🇪🇸',
    nativeName: 'Español'
  },
  { 
    code: 'ar', 
    name: 'العربية', 
    flag: '🇸🇦',
    nativeName: 'العربية'
  },
  { 
    code: 'tr', 
    name: 'Türkçe', 
    flag: '🇹🇷',
    nativeName: 'Türkçe'
  },
];

const LanguageSelector = ({ variant = 'default' }) => {
  const classes = useStyles();
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // Inicializa com o idioma salvo ou vazio (será definido quando carregar as configurações)
    // Verifica ambas as chaves do localStorage por compatibilidade
    const saved = localStorage.getItem('i18nextLng') || localStorage.getItem('language');
    console.log('🔍 LanguageSelector - Idioma inicial do localStorage:', saved);
    return saved || '';
  });
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { get, getAll } = useSettings();

  useEffect(() => {
    const fetchEnabledLanguages = async () => {
      try {
        console.log('🔍 LanguageSelector - Buscando idiomas habilitados...');
        setIsLoading(true);
        
        // Tenta buscar todas as configurações
        const allSettings = await getAll();
        console.log('🔍 LanguageSelector - Todas as configurações:', allSettings);
        
        // Procura pela configuração enabledLanguages
        const enabledLangSetting = allSettings?.find(s => s.key === 'enabledLanguages');
        console.log('🔍 LanguageSelector - Configuração enabledLanguages encontrada:', enabledLangSetting);
        
        let langs = ['pt', 'en']; // Valores padrão apenas se não houver configuração
        
        if (enabledLangSetting && enabledLangSetting.value) {
          try {
            // Tenta parsear se for string JSON
            if (typeof enabledLangSetting.value === 'string') {
              // Remove aspas extras se houver
              const cleanValue = enabledLangSetting.value.replace(/^["']|["']$/g, '');
              langs = JSON.parse(cleanValue);
              console.log('🔍 LanguageSelector - Idiomas parseados:', langs);
            } else if (Array.isArray(enabledLangSetting.value)) {
              // Se já for array, usa direto
              langs = enabledLangSetting.value;
              console.log('🔍 LanguageSelector - Idiomas já em array:', langs);
            }
          } catch (e) {
            console.error('Erro ao parsear idiomas habilitados:', e);
            console.log('🔍 LanguageSelector - Valor que causou erro:', enabledLangSetting.value);
          }
        } else {
          console.log('🔍 LanguageSelector - Nenhuma configuração de idiomas encontrada, usando padrão');
        }
        
        // Garante que langs é um array válido
        if (Array.isArray(langs) && langs.length > 0) {
          setAvailableLanguages(langs);
          console.log('🔍 LanguageSelector - Idiomas disponíveis definidos:', langs);
          
          // Pega o idioma salvo no localStorage (verifica ambas as chaves)
          const savedLanguage = localStorage.getItem('i18nextLng') || localStorage.getItem('language');
          
          // Se tiver idioma salvo e ele está na lista, usa ele
          if (savedLanguage && langs.includes(savedLanguage)) {
            console.log('🔍 LanguageSelector - Usando idioma salvo:', savedLanguage);
            setCurrentLanguage(savedLanguage);
            i18n.changeLanguage(savedLanguage);
          }
          // Caso contrário, usa o primeiro disponível
          else {
            const firstLang = langs[0];
            console.log('🔍 LanguageSelector - Usando primeiro idioma disponível:', firstLang);
            setCurrentLanguage(firstLang);
            i18n.changeLanguage(firstLang);
            localStorage.setItem('i18nextLng', firstLang);
          }
        } else {
          // Fallback final
          setAvailableLanguages(['pt', 'en']);
          const fallbackLang = localStorage.getItem('i18nextLng') || 'pt';
          setCurrentLanguage(fallbackLang);
          i18n.changeLanguage(fallbackLang);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao buscar configurações de idiomas:', error);
        console.log('🔍 LanguageSelector - Usando idiomas padrão devido a erro');
        setAvailableLanguages(['pt', 'en']);
        const fallbackLang = localStorage.getItem('i18nextLng') || 'pt';
        setCurrentLanguage(fallbackLang);
        i18n.changeLanguage(fallbackLang);
        setIsLoading(false);
      }
    };

    fetchEnabledLanguages();
    
    // Adiciona listener para mudanças nas configurações
    const handleStorageChange = (e) => {
      if (e.key === 'settingsUpdated') {
        console.log('🔍 LanguageSelector - Configurações atualizadas, recarregando idiomas...');
        fetchEnabledLanguages();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Adiciona listener customizado para atualizações de idiomas
    const handleLanguageSettingsUpdate = () => {
      console.log('🔍 LanguageSelector - Evento languageSettingsUpdated recebido');
      fetchEnabledLanguages();
    };
    
    window.addEventListener('languageSettingsUpdated', handleLanguageSettingsUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('languageSettingsUpdated', handleLanguageSettingsUpdate);
    };
  }, []); // Remove dependências para evitar loops

  const handleLanguageChange = (event) => {
    const newLanguage = event.target.value;
    setCurrentLanguage(newLanguage);
    i18n.changeLanguage(newLanguage);
    
    // Salva em ambas as chaves para manter compatibilidade
    localStorage.setItem('i18nextLng', newLanguage);
    localStorage.setItem('language', newLanguage);
    
    // Dispara evento para componentes que precisam reagir à mudança
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: newLanguage }));
    
    // Força re-render apenas dos componentes necessários
    // sem recarregar a página inteira
  };

  const getCurrentLanguage = () => {
    return languages.find(lang => lang.code === currentLanguage) || languages[0];
  };

  // Filtra apenas os idiomas disponíveis configurados pelo admin
  const filteredLanguages = languages.filter(lang => availableLanguages.includes(lang.code));

  // Não renderiza nada enquanto está carregando
  if (isLoading) {
    return null;
  }

  // Se não houver idiomas configurados, usa padrão
  if (filteredLanguages.length === 0) {
    return null;
  }


  if (variant === 'compact') {
    return (
      <FormControl size="small" className={classes.formControl}>
        <Select
          value={currentLanguage}
          onChange={handleLanguageChange}
          className={classes.select}
          variant="standard"
          disableUnderline
        >
          {filteredLanguages.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              <Box className={classes.menuItem}>
                <span>{lang.flag}</span>
                <Typography variant="body2">{lang.name}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <FormControl className={classes.formControl} size="small">
      <Select
        value={currentLanguage}
        onChange={handleLanguageChange}
        className={classes.select}
        variant="outlined"
        renderValue={(value) => {
          const lang = getCurrentLanguage();
          return (
            <Box display="flex" alignItems="center">
              <Language className={classes.languageIcon} fontSize="small" />
              <span style={{ marginRight: 8 }}>{lang.flag}</span>
              <Typography variant="body2">{lang.name}</Typography>
            </Box>
          );
        }}
      >
        {filteredLanguages.map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            <Box className={classes.menuItem}>
              <span>{lang.flag}</span>
              <Box>
                <Typography variant="body2" style={{ fontWeight: 500 }}>
                  {lang.name}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {lang.nativeName}
                </Typography>
              </Box>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default LanguageSelector;