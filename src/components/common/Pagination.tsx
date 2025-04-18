import { MdOutlineArrowBack, MdOutlineArrowForward } from "react-icons/md";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
}: PaginationProps) => {
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  return (
    <div className="flex justify-end items-center gap-4 mt-10">
      <div className="text-xs text-base-content/70">
        Showing {indexOfFirstItem + 1}-
        {Math.min(indexOfLastItem, totalItems)} of {totalItems} items
      </div>

      <div className="flex justify-end items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn btn-sm"
        >
          <MdOutlineArrowBack /> Previous
        </button>
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="btn btn-sm"
        >
          first
        </button>
        <span className="text-xs">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="btn btn-sm"
        >
          last
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn btn-sm"
        >
          Next <MdOutlineArrowForward />
        </button>
      </div>
    </div>
  );
};