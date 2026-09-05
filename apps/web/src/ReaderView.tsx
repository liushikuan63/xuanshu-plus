/**
 * 典籍书阁：书目 → 章节 → 分段阅读，并提供字形无关搜索、阅读进度与本地批注。
 * 展示文字始终保留语料原貌；搜索归一化只作用于匹配过程。
 */
import { useEffect, useMemo, useState } from 'react';
import { includesNormalizedText, normalizeSearchText, type CorpusSection } from '@xuanshu/knowledge';

interface ReaderViewProps {
  corpus: CorpusSection[];
  initialCanonicalId?: string;
  initialBook?: string;
  initialQuery?: string;
}

type TextMode = 'scan' | 'calib' | 'notes' | 'plain';

interface ReaderBook {
  book: string;
  count: number;
  canonicalIds: string[];
  chapters: Array<{ chapter: string; segs: CorpusSection[] }>;
  author?: string;
  edition?: string;
  license?: CorpusSection['license'];
}

const TEXT_MODES: Array<{ id: TextMode; label: string; hint: string }> = [
  { id: 'scan', label: '扫描文', hint: 'OCR 直出 · 未经校对' },
  { id: 'calib', label: '真实校准文字', hint: '经校对定本（默认）' },
  { id: 'notes', label: '注释文', hint: '带注释版本' },
  { id: 'plain', label: '白话文', hint: '现代白话翻译' },
];

const PROGRESS_KEY = 'xuanshu.reader.progress.v1';
const NOTES_KEY = 'xuanshu.reader.notes.v1';
const FONT_SIZE_KEY = 'xuanshu.reader.font-size.v1';

function readRecord(key: string): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeRecord(key: string, value: Record<string, string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储不可用时仍保持当前会话可读，不中断书阁。
  }
}

function readFontSize(): number {
  try {
    const value = Number(localStorage.getItem(FONT_SIZE_KEY));
    return Number.isFinite(value) && value >= 14 && value <= 22 ? value : 16;
  } catch {
    return 16;
  }
}

function versionedText(section: CorpusSection, mode: TextMode): { body: string; fallback: boolean } {
  switch (mode) {
    case 'scan': return section.scanText != null ? { body: section.scanText, fallback: false } : { body: section.text, fallback: true };
    case 'calib': return { body: section.text, fallback: false };
    case 'notes': return section.notes != null ? { body: section.notes, fallback: false } : { body: section.text, fallback: true };
    case 'plain': return section.plain != null ? { body: section.plain, fallback: false } : { body: section.text, fallback: true };
  }
}

export function ReaderView({ corpus, initialCanonicalId, initialBook, initialQuery = '' }: ReaderViewProps) {
  const books = useMemo<ReaderBook[]>(() => {
    const grouped = new Map<string, {
      chapters: Map<string, CorpusSection[]>;
      count: number;
      canonicalIds: Set<string>;
      first: CorpusSection;
    }>();
    for (const section of corpus) {
      const bookName = section.book ?? '未名';
      const current = grouped.get(bookName) ?? {
        chapters: new Map<string, CorpusSection[]>(),
        count: 0,
        canonicalIds: new Set<string>(),
        first: section,
      };
      current.count += 1;
      if (section.canonicalId) current.canonicalIds.add(section.canonicalId);
      const chapterName = section.chapter ?? '全卷';
      const chapterSections = current.chapters.get(chapterName) ?? [];
      chapterSections.push(section);
      current.chapters.set(chapterName, chapterSections);
      grouped.set(bookName, current);
    }
    return [...grouped.entries()].map(([book, value]) => ({
      book,
      count: value.count,
      canonicalIds: [...value.canonicalIds],
      chapters: [...value.chapters.entries()].map(([chapter, segs]) => ({ chapter, segs })),
      author: value.first.author,
      edition: value.first.edition,
      license: value.first.license,
    }));
  }, [corpus]);

  const requestedBook = books.find((candidate) => (
    (initialCanonicalId && candidate.canonicalIds.some((id) => (
      id === initialCanonicalId || id.startsWith(`${initialCanonicalId}.`) || initialCanonicalId.startsWith(`${id}.`)
    ))) || (initialBook && (candidate.book === initialBook || candidate.book.includes(initialBook)))
  ));
  const [bookName, setBookName] = useState(requestedBook?.book ?? books[0]?.book ?? '');
  const [chapterName, setChapterName] = useState('');
  const [filter, setFilter] = useState(initialQuery);
  const [bookFilter, setBookFilter] = useState('');
  const [showAllBook, setShowAllBook] = useState(Boolean(initialQuery));
  const [showShelf, setShowShelf] = useState(!requestedBook);
  const [mode, setMode] = useState<TextMode>('calib');
  const [fontSize, setFontSize] = useState(readFontSize);
  const [progress, setProgress] = useState<Record<string, string>>(() => readRecord(PROGRESS_KEY));
  const [annotations, setAnnotations] = useState<Record<string, string>>(() => readRecord(NOTES_KEY));
  const [openAnnotation, setOpenAnnotation] = useState<string | null>(null);
  const [resumeSegment, setResumeSegment] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const book = books.find((candidate) => candidate.book === bookName) ?? books[0];
  const chapter = showAllBook
    ? null
    : (book?.chapters.find((candidate) => candidate.chapter === chapterName) ?? book?.chapters[0] ?? null);
  const segments = useMemo(() => {
    const pool = chapter ? chapter.segs : (book?.chapters.flatMap((candidate) => candidate.segs) ?? []);
    const query = filter.trim();
    return query ? pool.filter((section) => includesNormalizedText(section.text, query)) : pool;
  }, [book, chapter, filter]);
  const shelfBooks = useMemo(() => {
    const query = normalizeSearchText(bookFilter.trim());
    if (!query) return books;
    return books.filter((candidate) => normalizeSearchText([
      candidate.book,
      candidate.author,
      candidate.edition,
      ...candidate.chapters.map((item) => item.chapter),
    ].filter(Boolean).join(' ')).includes(query));
  }, [bookFilter, books]);
  const modeCount = useMemo(() => {
    const pool = chapter ? chapter.segs : (book?.chapters.flatMap((candidate) => candidate.segs) ?? []);
    return {
      scan: pool.filter((section) => section.scanText != null).length,
      calib: pool.length,
      notes: pool.filter((section) => section.notes != null).length,
      plain: pool.filter((section) => section.plain != null).length,
    };
  }, [book, chapter]);

  useEffect(() => {
    if (!resumeSegment || showShelf) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`reader-segment-${resumeSegment}`)?.scrollIntoView({ block: 'start' });
      setResumeSegment(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [resumeSegment, showShelf, segments]);

  function openBook(nextBook: string, resume = false) {
    setBookName(nextBook);
    setChapterName('');
    setFilter('');
    setShowAllBook(resume);
    setShowShelf(false);
    setOpenAnnotation(null);
    setStatus('');
    if (resume && progress[nextBook]) setResumeSegment(progress[nextBook]);
  }

  function changeFontSize(delta: number) {
    const next = Math.max(14, Math.min(22, fontSize + delta));
    setFontSize(next);
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(next));
    } catch {
      // 存储不可用时保留当前会话设置。
    }
  }

  function saveProgress(section: CorpusSection) {
    const next = { ...progress, [book?.book ?? bookName]: section.segId };
    setProgress(next);
    writeRecord(PROGRESS_KEY, next);
    setStatus(`已记录阅读位置：${section.chapter ?? '全卷'} · ${section.segId}`);
  }

  function saveAnnotation(segId: string, value: string) {
    const next = { ...annotations };
    if (value.trim()) next[segId] = value;
    else delete next[segId];
    setAnnotations(next);
    writeRecord(NOTES_KEY, next);
  }

  if (showShelf) {
    return (
      <section className="reader-shell" aria-labelledby="reader-shelf-title">
        <div className="section-heading">
          <div>
            <h2 id="reader-shelf-title">典籍书阁</h2>
            <p className="meta">{books.length} 部 · {corpus.length} 段原文</p>
          </div>
          <input
            className="case-search"
            value={bookFilter}
            onChange={(event) => setBookFilter(event.target.value)}
            placeholder="搜索书名、作者、版本或章节"
            aria-label="搜索书目"
          />
        </div>
        {shelfBooks.length === 0 ? (
          <p className="meta reader-empty">没有匹配的书目。</p>
        ) : (
          <div className="reader-shelf-grid">
            {shelfBooks.map((item) => (
              <article key={item.book} className="reader-book-card">
                <button className="reader-book-open" onClick={() => openBook(item.book)}>
                  <span className="reader-book-title">《{item.book}》</span>
                  <span>{item.author ?? '作者未详'}</span>
                  <span>{item.chapters.length} 章 · {item.count} 段</span>
                  <small>{item.edition ?? '版本未详'} · {item.license ?? '许可未标注'}</small>
                </button>
                {progress[item.book] && (
                  <button className="secondary small" onClick={() => openBook(item.book, true)}>继续阅读</button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="reader-shell" aria-labelledby="reader-title">
      <div className="reader-head">
        <div>
          <button className="secondary small" onClick={() => setShowShelf(true)}>返回书阁</button>
          <h2 id="reader-title">《{book?.book ?? ''}》</h2>
          <p className="meta">
            {book?.author ?? '作者未详'} · {book?.edition ?? '版本未详'} · {book?.license ?? '许可未标注'}
          </p>
        </div>
        <div className="reader-font-controls" role="group" aria-label="正文字号">
          <button className="icon-button" onClick={() => changeFontSize(-1)} disabled={fontSize <= 14} title="减小字号" aria-label="减小字号">−</button>
          <output aria-label="当前字号">{fontSize}px</output>
          <button className="icon-button" onClick={() => changeFontSize(1)} disabled={fontSize >= 22} title="增大字号" aria-label="增大字号">+</button>
        </div>
      </div>

      <div className="reader-toolbar">
        <label className="birth-field">
          <span>章节</span>
          <select
            className="reader-chapter-select"
            value={chapter?.chapter ?? ''}
            disabled={showAllBook}
            onChange={(event) => setChapterName(event.target.value)}
          >
            {book?.chapters.map((item) => (
              <option key={item.chapter} value={item.chapter}>{item.chapter}（{item.segs.length}）</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={showAllBook} onChange={(event) => setShowAllBook(event.target.checked)} />
          整书检索
        </label>
      </div>

      <div className="chips reader-modes" role="group" aria-label="阅读文本版本">
        {TEXT_MODES.map((item) => (
          <button
            key={item.id}
            className={`chip ${mode === item.id ? 'active' : ''}`}
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id)}
            title={item.hint}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="meta">
        当前范围：扫描文 {modeCount.scan} 段 · 校准文 {modeCount.calib} 段 · 注释文 {modeCount.notes} 段 · 白话文 {modeCount.plain} 段
      </p>

      <input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="检索正文，支持繁简字与异体字"
        aria-label="检索正文"
        className="question"
      />
      {status && <p className="ok" role="status">{status}</p>}

      <div className="reader-body">
        {segments.length === 0 && <p className="meta">当前范围没有匹配段落。</p>}
        {segments.slice(0, 500).map((section) => {
          const { body, fallback } = versionedText(section, mode);
          const isProgress = progress[book?.book ?? bookName] === section.segId;
          return (
            <article
              key={section.segId}
              id={`reader-segment-${section.segId}`}
              className={`reader-seg ${isProgress ? 'reader-current' : ''}`}
            >
              {fallback && <p className="meta">该段暂未收录“{TEXT_MODES.find((item) => item.id === mode)?.label}”，以下显示校准文字。</p>}
              <div className="reader-text" style={{ fontSize }}>{body}</div>
              <div className="reader-meta">
                {section.chapter ?? '全卷'} · {section.segId} · {TEXT_MODES.find((item) => item.id === mode)?.label}
              </div>
              <div className="reader-seg-actions">
                <button className="secondary small" onClick={() => saveProgress(section)}>
                  {isProgress ? '当前阅读位置' : '标记阅读位置'}
                </button>
                <button
                  className="secondary small"
                  aria-expanded={openAnnotation === section.segId}
                  onClick={() => setOpenAnnotation(openAnnotation === section.segId ? null : section.segId)}
                >
                  {annotations[section.segId] ? '编辑批注' : '添加批注'}
                </button>
              </div>
              {openAnnotation === section.segId && (
                <label className="reader-note">
                  <span>本地批注</span>
                  <textarea
                    value={annotations[section.segId] ?? ''}
                    onChange={(event) => saveAnnotation(section.segId, event.target.value)}
                    placeholder="记录校勘、理解或案例关联"
                    rows={3}
                  />
                </label>
              )}
            </article>
          );
        })}
        {segments.length > 500 && <p className="meta">仅显示前 500 段，请缩小检索范围。</p>}
      </div>
    </section>
  );
}
