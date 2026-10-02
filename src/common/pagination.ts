import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** `?page=&pageSize=` — extend this in list query DTOs. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    default: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** Normalised page + Prisma skip/take. */
export function pageArgs(query: PaginationQueryDto = {}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** The standard paged response: `{ data, meta }`. */
export function paged<T>(
  data: T[],
  total: number,
  args: { page: number; pageSize: number },
): { data: T[]; meta: PageMeta } {
  return {
    data,
    meta: {
      page: args.page,
      pageSize: args.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
    },
  };
}

/** Pages an in-memory list (for results computed after the query). */
export function pageArray<T>(items: T[], query: PaginationQueryDto = {}) {
  const args = pageArgs(query);
  return paged(
    items.slice(args.skip, args.skip + args.take),
    items.length,
    args,
  );
}
