import React, { useContext } from "react";
import toastError  from "../../errors/toastError";
import { Checkbox } from "@mui/material";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";

const SelectMessageCheckbox = ({ message }) => {
    const [isChecked, setIsChecked] = React.useState(false);
    const { showSelectMessageCheckbox,
      setSelectedMessages,
      selectedMessages,
   } = useContext(ForwardMessageContext);

    const handleSelectMessage = (e, message) => {
        const isChecking = e.target.checked;
        setIsChecked(isChecking);  // ✅ Valor correto
        
        setSelectedMessages(prev => {
            if (isChecking) {
                // if (prev.length >= 4) {
                //   toastError("Não é possível selecionar mais de 4 mensagens para encaminhar.");
                //   setIsChecked(false);
                //   return prev;
                // }
                return [...prev, message];  // ✅ Novo array
            } else {
                return prev.filter(m => m.id !== message.id);  // ✅ Novo array
            }
        });
      }

    if (showSelectMessageCheckbox) {
        return <Checkbox color="primary" checked={isChecked} onChange={(e) => handleSelectMessage(e, message)}  />;
    } else {
        return null;
    }
}

export default React.memo(SelectMessageCheckbox, (prevProps, nextProps) => {
    return prevProps.message.id === nextProps.message.id;
});