import { FC, useState } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaFilePdf } from "react-icons/fa6";
import { TbFileTypeCsv, TbFileTypePdf } from "react-icons/tb";
import CustomToast from "./CustomToast";

interface ExportButtonsProps {
  data?: any[];
  filename?: string;
  className?: string;
  csvLabel?: string;
  pdfLabel?: string;
  onExport?: () => Promise<any[]>;
}

export const ExportButtons: FC<ExportButtonsProps> = ({
  data = [],
  filename = "data",
  className = "",
  csvLabel = "Export to CSV",
  pdfLabel = "Export to PDF",
  onExport,
}) => {
  const [loading, setLoading] = useState(false);

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      const exportData = onExport ? await onExport() : data;
      if (!exportData?.length) {
        CustomToast.error("No data to export");
        return;
      }
      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      // console.error("Error exporting CSV:", error);
      CustomToast.error("Failed to export CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setLoading(true);
      const exportData = onExport ? await onExport() : data;
      if (!exportData?.length) {
        CustomToast.error("No data to export");
        return;
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "A4",
      });

      autoTable(doc, {
        head: [Object.keys(exportData[0])],
        body: exportData.map((row) =>
          Object.values(row).map((value) => value?.toString() || "")
        ),
        margin: 10,
        styles: {
          fontSize: 8,
          cellPadding: 4,
        },
        columnStyles: {
          1: { cellWidth: 120 },
          2: { cellWidth: 140 },
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 10,
        },
        bodyStyles: {
          textColor: 50,
        },
        tableWidth: "auto",
        theme: "grid",
      });
      doc.save(`${filename}.pdf`);
    } catch (error) {
      // console.error("Error exporting PDF:", error);
      CustomToast.error("Failed to export PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`dropdown dropdown-bottom ${className}`}>
      <button
        tabIndex={0}
        role="button"
        className="btn btn-outline btn-sm"
        disabled={loading}
      >
        {loading ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          "Export"
        )}
        <svg
          width="12px"
          height="12px"
          className="ml-1 inline-block h-2 w-2 fill-current opacity-60"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 2048 2048"
        >
          <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"></path>
        </svg>
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content z-[1] menu p-2 shadow bg-base-300 rounded-box w-52"
      >
        <li>
          <button type="button" onClick={handleExportCSV} disabled={loading}>
            <TbFileTypeCsv className="text-xl" /> {csvLabel}
          </button>
        </li>
        <li>
          <button type="button" onClick={handleExportPDF} disabled={loading}>
            <TbFileTypePdf className="text-xl" /> {pdfLabel}
          </button>
        </li>
      </ul>
    </div>
  );
};
