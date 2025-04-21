import { FC } from "react";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaFilePdf } from "react-icons/fa6";
import { TbFileTypeCsv, TbFileTypePdf } from "react-icons/tb";

interface ExportButtonsProps {
  data: any[];
  filename?: string;
  className?: string;
  csvLabel?: string;
  pdfLabel?: string;
}

export const ExportButtons: FC<ExportButtonsProps> = ({
  data,
  filename = "data",
  className = "",
  csvLabel = "Export to CSV",
  pdfLabel = "Export to PDF",
}) => {
  const handleExportCSV = () => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (data.length === 0) return;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "A4",
    });
    autoTable(doc, {
      head: [Object.keys(data[0])],
      body: data.map((row) =>
        Object.values(row).map((value) => value?.toString() || "")
      ),
      margin: 10,
      styles: {
        fontSize: 8,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        textColor: 50,
      },
      tableWidth: 'auto',
      theme: 'grid',
    });
    doc.save(`${filename}.pdf`);
  };

  return (
    <div className={`dropdown dropdown-bottom ${className}`}>
      <button
        tabIndex={0}
        role="button"
        className="btn btn-outline btn-sm"
        disabled={data.length === 0}
      >
        Export
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
          <button type="button" onClick={handleExportCSV}>
          <TbFileTypeCsv className="text-xl" /> {csvLabel}
          </button>
        </li>
        <li>
          <button type="button" onClick={handleExportPDF}>
          <TbFileTypePdf className="text-xl" /> {pdfLabel}
          </button>
        </li>
      </ul>
    </div>
  );
};
