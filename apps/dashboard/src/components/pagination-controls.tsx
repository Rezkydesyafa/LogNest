import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export function PaginationControls({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage(page: number): void;
}) {
  const last = Math.max(1, Math.ceil(total / limit));
  if (last === 1) return null;
  return (
    <Pagination className="justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={page <= 1}
            onClick={(event) => {
              event.preventDefault();
              if (page > 1) onPage(page - 1);
            }}
          />
        </PaginationItem>
        <PaginationItem>
          <span className="px-3 text-sm text-muted-foreground">
            Page {page} of {last}
          </span>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={page >= last}
            onClick={(event) => {
              event.preventDefault();
              if (page < last) onPage(page + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
