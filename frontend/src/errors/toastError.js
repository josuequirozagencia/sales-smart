import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import { isString } from 'lodash';

const toastError = err => {
	// Hubo peticion pero no hubo respuesta: el servidor no esta escuchando.
	// Antes caia en el mensaje generico de mas abajo —"An error occurred!",
	// en ingles y sin pista de que hacer—, que es justo lo que se ve cuando
	// el backend esta caido.
	if (err?.request && !err?.response) {
		toast.error(i18n.t("backendErrors.ERR_NO_SERVER_RESPONSE"), {
			toastId: "ERR_NO_SERVER_RESPONSE",
			autoClose: 4000,
		});
		return;
	}

	const errorMsg = err.response?.data?.error;
	if (errorMsg) {
		if (i18n.exists(`backendErrors.${errorMsg}`)) {
			toast.error(i18n.t(`backendErrors.${errorMsg}`), {
				toastId: errorMsg,
				autoClose: 2000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: false,
				draggable: true,
				progress: undefined,
				theme: "light",
			});
			return
		} else {
			toast.error(errorMsg, {
				toastId: errorMsg,
				autoClose: 2000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: false,
				draggable: true,
				progress: undefined,
				theme: "light",
			});
			return
		}
	} if (isString(err)) {
		toast.error(err);
		return
	} else {
		toast.error("An error occurred!");
		return
	}
};

export default toastError;
