import React, { useContext, useEffect } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import ErrorBoundary from "../components/ErrorBoundary";

const Route = ({ component: Component, isPrivate = false, ...rest }) => {
	const { isAuth, loading, user } = useContext(AuthContext);

	// Salvar rota atual para redirecionamento após login
	useEffect(() => {
		if (isPrivate && !isAuth && rest.location?.pathname) {
			localStorage.setItem("redirectAfterLogin", rest.location.pathname);
		}
	}, [isPrivate, isAuth, rest.location]);

	// Aguardar carregamento inicial antes de decidir redirecionamento
	if (loading) {
		return <BackdropLoading />;
	}

	if (!isAuth && isPrivate) {
		return <Redirect to={{ pathname: "/login", state: { from: rest.location } }} />;
	}

	if (isAuth && !isPrivate && rest.path === "/login") {
		const redirectTo = localStorage.getItem("redirectAfterLogin") || "/tickets";
		localStorage.removeItem("redirectAfterLogin");
		return <Redirect to={{ pathname: redirectTo, state: { from: rest.location } }} />;
	}

	// Cada rota tem seu próprio ErrorBoundary: uma exceção em uma tela não
	// derruba o restante da aplicação nem deixa a página em branco.
	return (
		<RouterRoute
			{...rest}
			render={props => (
				<ErrorBoundary key={rest.path} scope={rest.path}>
					<Component {...props} />
				</ErrorBoundary>
			)}
		/>
	);
};

export default Route;
