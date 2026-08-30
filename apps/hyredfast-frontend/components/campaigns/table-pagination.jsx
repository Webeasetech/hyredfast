"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

/**
 * Page controls for a server-paged list.
 *
 * Lifted out of DataTable so the grouped leads view can page too: there the
 * rows are split across several tables, one per company/role, so pagination
 * can no longer live inside the table that renders them.
 */
export default function TablePagination({
  pageCount,
  currentPage = 1,
  onPageChange,
  isLoading = false,
}) {
  if (!pageCount || pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-center space-x-2 py-4">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isLoading}
            />
          </PaginationItem>

          {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
            // Show pages around current page
            let pageNum;
            if (pageCount <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= pageCount - 2) {
              pageNum = pageCount - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  onClick={() => onPageChange(pageNum)}
                  isActive={pageNum === currentPage}
                  disabled={isLoading}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            );
          })}

          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage === pageCount || isLoading}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
