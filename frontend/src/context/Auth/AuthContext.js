import React, { createContext, useMemo } from "react";
import useAuth from "../../hooks/useAuth.js";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
	const { loading, user, isAuth, handleLogin, handleLogout, socket } = useAuth();

	// Memoizar o valor do contexto para evitar re-renders desnecessários
	const contextValue = useMemo(() => ({
		loading,
		user,
		isAuth,
		handleLogin,
		handleLogout,
		socket
	}), [loading, user, isAuth, handleLogin, handleLogout, socket]);

	return (
		<AuthContext.Provider value={contextValue}>
			{children}
		</AuthContext.Provider>
	);
};

export { AuthContext, AuthProvider };