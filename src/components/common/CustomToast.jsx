import React from "react";
import toast from "react-hot-toast";

const CustomToast = {
    success: (message) => {
        toast.dismiss(); // Dismiss any existing toast
        toast.success(message, { id: "success-toast" });
    },
    error: (message) => {
        toast.dismiss(); // Dismiss any existing toast
        toast.error(message, { id: "error-toast" });
    },
    info: (message) => {
        toast.dismiss();
        toast(message, { id: "info-toast" });
    }
};

export default CustomToast;
