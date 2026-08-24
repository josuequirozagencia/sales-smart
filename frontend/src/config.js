function getConfig(name, defaultValue = null) {
    // If inside a docker container, use window.ENV
    if (window.ENV !== undefined) {
        return window.ENV[name] || defaultValue;
    }

    // Try process.env if available
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
        return process.env[name];
    }

    return defaultValue;
}

export function getBackendUrl() {
    // Default to localhost:8080 if not configured
    const url = getConfig('REACT_APP_BACKEND_URL', 'http://localhost:8080');
    
    // If we're in development and no URL is set, use relative path (proxy will handle it)
    if (!url && process.env.NODE_ENV === 'development') {
        return '';
    }
    
    return url;
}

export function getHoursCloseTicketsAuto() {
    return getConfig('REACT_APP_HOURS_CLOSE_TICKETS_AUTO');
}

export function getFrontendPort() {
    return getConfig('SERVER_PORT');
}

export function getPrimaryColor() {
    return getConfig("REACT_APP_PRIMARY_COLOR");
}

export function getPrimaryDark() {
    return getConfig("REACT_APP_PRIMARY_DARK");
}

export function getNumberSupport() {
    return getConfig("REACT_APP_NUMBER_SUPPORT");
}