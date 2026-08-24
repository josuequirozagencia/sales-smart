import React, { memo, useMemo } from "react";

import Paper from "@material-ui/core/Paper";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Tooltip from '@material-ui/core/Tooltip';
import Skeleton from "@material-ui/lab/Skeleton";

import { makeStyles } from "@material-ui/core/styles";
import { green, grey } from '@material-ui/core/colors';

import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import moment from 'moment';

import Rating from '@material-ui/lab/Rating';
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
    on: {
        color: green[600],
        fontSize: '20px'
    },
    off: {
        color: grey[600],
        fontSize: '20px'
    },
    pointer: {
        cursor: "pointer"
    }
}));

// Componente memoizado para o Rating
export const RatingBox = memo(({ rating }) => {
    const ratingTrunc = rating === null ? 0 : Math.trunc(rating);
    return <Rating
        defaultValue={ratingTrunc}
        max={3}
        readOnly
    />
});

// Função de formatação movida para fora do componente
const formatTime = (minutes) => {
    return moment().startOf('day').add(minutes, 'minutes').format('HH[h] mm[m]');
};

// Componente memoizado para cada linha da tabela
const AttendantRow = memo(({ attendant, classes }) => {
    return (
        <TableRow>
            <TableCell>{attendant.name}</TableCell>
            <TableCell align="center">{attendant.rating}</TableCell>
            <TableCell align="center">{attendant.countRating}</TableCell>
            <TableCell align="center">{attendant.tickets}</TableCell>
            <TableCell align="center">{formatTime(attendant.avgWaitTime)}</TableCell>
            <TableCell align="center">{formatTime(attendant.avgSupportTime)}</TableCell>
            <TableCell align="center">
                {attendant.online ?
                    <Tooltip title="Online">
                        <CheckCircleIcon className={classes.on} />
                    </Tooltip>
                    :
                    <Tooltip title="Offline">
                        <ErrorIcon className={classes.off} />
                    </Tooltip>
                }
            </TableCell>
        </TableRow>
    );
});

// Componente principal memoizado
const TableAttendantsStatus = memo(({ loading, attendants }) => {
    const classes = useStyles();

    // Memoizar os headers da tabela
    const tableHeaders = useMemo(() => (
        <TableHead>
            <TableRow>
                <TableCell>{i18n.t("dashboard.users.name")}</TableCell>
                <TableCell align="center">{i18n.t("dashboard.assessments.score")}</TableCell>
                <TableCell align="center">{i18n.t("dashboard.assessments.ratedCalls")}</TableCell>
                <TableCell align="center">{i18n.t("dashboard.assessments.totalCalls")}</TableCell>
                <TableCell align="center">{i18n.t("dashboard.cards.averageWaitingTime")}</TableCell>
                <TableCell align="center">{i18n.t("dashboard.cards.averageServiceTime")}</TableCell>
                <TableCell align="center">{i18n.t("dashboard.cards.status")}</TableCell>
            </TableRow>
        </TableHead>
    ), []);

    // Memoizar o corpo da tabela
    const tableBody = useMemo(() => (
        <TableBody>
            {attendants.map((attendant, index) => (
                <AttendantRow 
                    key={attendant.id || index} 
                    attendant={attendant} 
                    classes={classes} 
                />
            ))}
        </TableBody>
    ), [attendants, classes]);

    if (loading) {
        return <Skeleton variant="rect" height={150} />;
    }

    return (
        <TableContainer component={Paper}>
            <Table>
                {tableHeaders}
                {tableBody}
            </Table>
        </TableContainer>
    );
});

export default TableAttendantsStatus;