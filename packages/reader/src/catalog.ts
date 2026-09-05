/**
 * 书架与目录树（v5 §9.3）：卷 → 章 → 节 → 段
 */

export interface CatalogNode {
  volume?: string;
  chapter: string;
  section?: string;
  segIds: string[];
}

export interface BookEntry {
  canonicalId: string;
  title: string;
  author?: string;
  edition: string;
  license: '公有领域' | '用户自有' | '未知';
  sourceUrl?: string;
  /** 三态索引（v8 D29）：builtin / collation-only / forbidden */
  status: 'builtin' | 'collation-only' | 'forbidden';
  toc: CatalogNode[];
  progress?: { readSegIds: number; totalSegIds: number };
}

export class Bookshelf {
  private books = new Map<string, BookEntry>();

  add(book: BookEntry): void {
    this.books.set(book.canonicalId, book);
  }

  get(canonicalId: string): BookEntry | undefined {
    return this.books.get(canonicalId);
  }

  list(): BookEntry[] {
    return [...this.books.values()];
  }

  /** 目录树：给定 segId 定位到卷/章/节 */
  locateSeg(canonicalId: string, segId: string): { node: CatalogNode | undefined; depth: number } {
    const book = this.books.get(canonicalId);
    if (!book) return { node: undefined, depth: 0 };
    for (const node of book.toc) {
      if (node.segIds.includes(segId)) return { node, depth: node.section ? 3 : node.volume ? 2 : 1 };
    }
    return { node: undefined, depth: 0 };
  }
}
