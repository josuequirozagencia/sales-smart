import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { useHistory } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import { AuthContext } from "../../context/Auth/AuthContext";

import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import usePlans from '../../hooks/usePlans';
import { i18n } from "../../translate/i18n";
import { FormControl } from "@material-ui/core";
import { InputLabel, MenuItem, Select } from "@material-ui/core";
import CircularProgress from "@material-ui/core/CircularProgress";

import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";
import useSettings from "../../hooks/useSettings";
import clsx from "clsx";

const useStyles = makeStyles(theme => ({
    // Root da página - forçar centralização
    root: {
        width: "100vw !important",
        height: "100vh !important",
        display: "flex !important",
        alignItems: "center !important",
        justifyContent: "center !important",
        padding: "20px 0 !important",
        margin: "0 !important",
        boxSizing: "border-box !important",
        overflow: "auto !important", // Permitir scroll se necessário
        background: theme.palette.background.default,
    },
    // Container específico para signup - forçar centralização
    containerSignup: {
        padding: "16px !important",
        maxWidth: "500px !important", // Signup é um pouco maior que login
        width: "auto !important",
        margin: "0 auto !important",
        position: "relative !important",
        left: "auto !important",
        right: "auto !important",
        transform: "none !important",
        flex: "none !important",
    },
    paper: {
        marginTop: theme.spacing(2),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px",
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        boxShadow: theme.shadows[3],
        maxWidth: "480px !important",
        width: "100% !important",
        margin: "0 auto !important",
    },
    avatar: {
        margin: theme.spacing(1),
        backgroundColor: theme.palette.secondary.main,
    },
    form: {
        width: "100%",
        marginTop: theme.spacing(3),
    },
    submit: {
        margin: theme.spacing(3, 0, 2),
    },
}));

const UserSchema = Yup.object().shape({
    name: Yup.string()
        .min(2, "Too Short!")
        .max(50, "Too Long!")
        .required("Required"),
    companyName: Yup.string()
        .min(2, "Too Short!")
        .max(50, "Too Long!")
        .required("Required"),
    password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
    email: Yup.string().email("Invalid email").required("Required"),
    phone: Yup.string().required("Required"),
});

const SignUp = () => {
    const classes = useStyles();
    const history = useHistory();
    const { handleLogin } = useContext(AuthContext);
    const { getPlanList } = usePlans()
    const [plans, setPlans] = useState([])
    const [loading, setLoading] = useState(false);
    const { getPublicSetting } = useSettings();

    // El registro publico crea siempre una empresa nueva.
    //
    // Aqui se leia un companyId de la URL y se enviaba al servidor, que
    // hasta ahora lo obedecia: /signup?companyId=3 creaba una cuenta de
    // administrador dentro de esa empresa, sin invitacion. El servidor ya
    // no lo acepta, y se quita tambien de aqui para no dejar un formulario
    // que aparenta hacer algo que no hace.
    const initialState = { name: "", email: "", password: "", phone: "", companyName: "", planId: "" };

    const [user, setUser] = useState(initialState);

    useEffect(() => {
        getPublicSetting("userCreation")
            .then((data) => {
                if (data === "disabled") {
                    toast.error(i18n.t("signup.toasts.disabled"));
                    history.push("/login");
                }
            })
            .catch((error) => {
                console.log("Error reading setting", error);
            });
    }, []);

    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            const planList = await getPlanList({ listPublic: "false" });

            setPlans(planList);
            // Automaticamente selecionar o primeiro plano disponível
            if (planList && planList.length > 0) {
                setUser(prevUser => ({ ...prevUser, planId: planList[0].id }));
            }
            setLoading(false);
        }
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);







    const handleSignUp = async values => {
        try {
            const { data } = await openApi.post("/auth/signup", values);

            // Si la instalacion exige aprobacion, la empresa nace
            // PENDIENTE y todavia no puede entrar. Se comprueba por el
            // valor que devuelve el servidor y no por el ajuste, porque
            // lo que importa es lo que de verdad se guardo.
            if (data?.approvalStatus === "pending") {
                // Ni mensaje de bienvenida ni intento de entrar: lo uno
                // prometeria un acceso que no hay, y lo otro fallaria a
                // proposito y dejaria dos avisos que se contradicen.
                toast.success(i18n.t("signup.toasts.pending"));
                history.push("/login");
                return;
            }

            toast.success(i18n.t("signup.toasts.success"));

            // Login automático após cadastro bem-sucedido
            try {
                await handleLogin({
                    email: values.email,
                    password: values.password
                });
                // O handleLogin já redireciona para a página principal após login bem-sucedido
            } catch (loginErr) {
                // Se o login automático falhar, redireciona para a página de login
                console.error("Auto-login failed:", loginErr);
                history.push("/login");
            }
        } catch (err) {
            toastError(err);
        }
    };

    return (
        <div 
            className={clsx(classes.root, "signup-page")}
            style={{
                // Backup inline styles - vão sobrescrever qualquer CSS global
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px 0',
                margin: '0',
                boxSizing: 'border-box',
                overflow: 'auto'
            }}
        >
            <Container 
                component="main" 
                maxWidth="sm"
                className={classes.containerSignup}
                style={{
                    // Backup inline styles para forçar centralização
                    maxWidth: '500px',
                    width: 'auto',
                    margin: '0 auto',
                    padding: '16px',
                    position: 'relative',
                    left: 'auto',
                    right: 'auto',
                    transform: 'none',
                    flex: 'none'
                }}
            >
                <CssBaseline />
                <div className={classes.paper}>
                    <Avatar className={classes.avatar}>
                        <LockOutlinedIcon />
                    </Avatar>
                    <Typography component="h1" variant="h5">
                        {i18n.t("signup.title")}
                    </Typography>
                    {/* <form className={classes.form} noValidate onSubmit={handleSignUp}> */}
                    <Formik
                        initialValues={user}
                        enableReinitialize={true}
                        validationSchema={UserSchema}
                        onSubmit={(values, actions) => {
                            // Garantir que o planId está preenchido com o primeiro plano disponível
                            const submitValues = {
                                ...values,
                                planId: values.planId || (plans[0]?.id || "")
                            };
                            setTimeout(() => {
                                handleSignUp(submitValues);
                                actions.setSubmitting(false);
                            }, 400);
                        }}
                    >
                        {({ touched, errors, isSubmitting, setFieldValue }) => (
                            <Form className={classes.form}>
                                <Grid container spacing={2}>

                                    <Grid item xs={12}>
                                        <Field
                                            as={TextField}
                                            variant="outlined"
                                            fullWidth
                                            id="companyName"
                                            label={i18n.t("signup.form.company")}
                                            error={touched.companyName && Boolean(errors.companyName)}
                                            helperText={touched.companyName && errors.companyName}
                                            name="companyName"
                                            autoComplete="companyName"
                                            autoFocus
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Field
                                            as={TextField}
                                            autoComplete="name"
                                            name="name"
                                            error={touched.name && Boolean(errors.name)}
                                            helperText={touched.name && errors.name}
                                            variant="outlined"
                                            fullWidth
                                            id="name"
                                            label={i18n.t("signup.form.name")}
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Field
                                            as={TextField}
                                            variant="outlined"
                                            fullWidth
                                            id="email"
                                            label={i18n.t("signup.form.email")}
                                            name="email"
                                            error={touched.email && Boolean(errors.email)}
                                            helperText={touched.email && errors.email}
                                            autoComplete="email"
                                            inputProps={{ style: { textTransform: 'lowercase' } }}
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Field
                                            as={TextField}
                                            variant="outlined"
                                            fullWidth
                                            name="password"
                                            error={touched.password && Boolean(errors.password)}
                                            helperText={touched.password && errors.password}
                                            label={i18n.t("signup.form.password")}
                                            type="password"
                                            id="password"
                                            autoComplete="current-password"
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Field
                                            as={TextField}
                                            variant="outlined"
                                            fullWidth
                                            id="phone"
                                            label={i18n.t("signup.form.phone")}
                                            name="phone"
                                            autoComplete="phone"
                                        />
                                    </Grid>

                                    {/* TOKEN */}
                                    {/* <Grid item xs={12}>
                                        <Field
                                            as={TextField}
                                            variant="outlined"
                                            fullWidth
                                            id="token"
                                            label={i18n.t("auth.token")}
                                            name="token"
                                            autoComplete="token"
                                        />
                                    </Grid> */}

                                    {/* Campo de plano removido - será selecionado automaticamente */}

                                </Grid>
                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    color="primary"
                                    className={classes.submit}
                                >
                                    {i18n.t("signup.buttons.submit")}
                                </Button>
                                <Grid container>
                                    <Grid item>
                                        <Link
                                            href="#"
                                            variant="body2"
                                            component={RouterLink}
                                            to="/login"
                                        >
                                            {i18n.t("signup.buttons.login")}
                                        </Link>
                                    </Grid>
                                </Grid>
                            </Form>
                        )}
                    </Formik>
                </div>
                <Box mt={5}>{/* <Copyright /> */}</Box>
            </Container>
        </div>
    );
};

export default SignUp;