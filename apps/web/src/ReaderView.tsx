/**
 * 典籍阅读器（轻量版）：基于内置语料的书架 → 章节 → 分段阅读 + 关键词过滤。
 * 数据来自启动时已预导入的 builtinCorpus（books 分组的 CorpusSection[]）。
 */
import { useMemo, useState } from 'react';
import { includesNormalizedText, type CorpusSection } from '@xuanshu/knowledge';

interface ReaderViewProps {
  corpus: CorpusSection[];
}

/** 文本版本：扫描文（OCR 原样）／真实校准文字（定本）／注释文／白话文 */
type TextMode = 'scan' | 'calib' | 'notes' | 'plain';

const TEXT_MODES: Array<{ id: TextMode; label: string; hint: string }> = [
  { id: 'scan', label: '扫描文', hint: 'OCR 直出 · 未经校对' },
  { id: 'calib', label: '真实校准文字', hint: '经校对定本（默认）' },
  { id: 'notes', label: '注释文', hint: '带注释版本' },
  { id: 'plain', label: '白话文', hint: '现代白话翻译' },
];

/** 取某段在指定版本下的正文；未收录时回退校准原文并标记回退 */
function versionedText(s: CorpusSection, mode: TextMode): { body: string; fallback: boolean } {
  switch (mode) {
    case 'scan': return s.scanText != null ? { body: s.scanText, fallback: false } : { body: s.text, fallback: true };
    case 'calib': return { body: s.text, fallback: false };
    case 'notes': return s.notes != null ? { body: s.notes, fallback: false } : { body: s.text, fallback: true };
    case 'plain': return s.plain != null ? { body: s.plain, fallback: false } : { body: s.text, fallback: true };
  }
}

export function ReaderView({ corpus }: ReaderViewProps) {
  const books = useMemo(() => {
    const m = new Map<string, { chapters: Map<string, CorpusSection[]>; count: number }>();
    for (const c of corpus) {
      const book = c.book ?? '未名';
      const b = m.get(book) ?? { chapters: new Map(), count: 0 };
      b.count += 1;
      const ch = c.chapter ?? '全卷';
      const list = b.chapters.get(ch) ?? [];
      list.push(c);
      b.chapters.set(ch, list);
      m.set(book, b);
    }
    return [...m.entries()].map(([book, b]) => ({
      book,
      count: b.count,
      chapters: [...b.chapters.entries()].map(([chapter, segs]) => ({ chapter, segs })),
    }));
  }, [corpus]);

  const [bookName, setBookName] = useState<string>(books[0]?.book ?? '');
  const [chapterName, setChapterName] = useState<string>('');
  const [filter, setFilter] = useState('');
  const [showAllBooks, setShowAllBooks] = useState(false);
  const [mode, setMode] = useState<TextMode>('calib');

  const book = books.find((b) => b.book === bookName) ?? books[0];
  const chapter = showAllBooks
    ? null
    : (book?.chapters.find((c) => c.chapter === chapterName) ?? book?.chapters[0] ?? null);

  const segs = useMemo(() => {
    const pool = chapter ? chapter.segs : (book?.chapters.flatMap((c) => c.segs) ?? []);
    const q = filter.trim();
    if (!q) return pool;
    return pool.filter((s) => includesNormalizedText(s.text, q));
  }, [chapter, book, filter]);

  const modeCount = useMemo(() => {
    const pool = chapter ? chapter.segs : (book?.chapters.flatMap((c) => c.segs) ?? []);
    const n = pool.length;
    return {
      scan: pool.filter((s) => s.scanText != null).length,
      calib: n,
      notes: pool.filter((s) => s.notes != null).length,
      plain: pool.filter((s) => s.plain != null).length,
    };
  }, [chapter, book]);

  return (
    <section className="card">
      <h2>典籍阅读（内置 {books.length} 部 · {corpus.length} 段原文）</h2>
      <label className="check">
        <input type="checkbox" checked={showAllBooks} onChange={(e) => setShowAllBooks(e.target.checked)} />
        整书连读模式
      </label>

      <div className="chips">
        {books.slice(0, 18).map((b) => (
          <button
            key={b.book}
            className={`chip ${bookName === b.book ? 'active' : ''}`}
            onClick={() => { setBookName(b.book); setChapterName(''); setShowAllBooks(false); }}
          >{b.book}（{b.count}）</button>
        ))}
      </div>

      {book && !showAllBooks && (
        <div className="chips">
          {book.chapters.slice(0, 60).map((c) => (
            <button
              key={c.chapter}
              className={`chip ${chapterName === c.chapter ? 'active' : ''}`}
              onClick={() => setChapterName(c.chapter)}
            >{c.chapter}</button>
          ))}
        </div>
      )}

      <div className="chips" style={{ marginTop: 6 }}>
        {TEXT_MODES.map((m) => (
          <button
            key={m.id}
            className={`chip ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
            title={m.hint}
          >{m.label}</button>
        ))}
        <span className="meta" style={{ marginLeft: 8, alignSelf: 'center' }}>
          当前 {book?.book ?? ''}（{chapter?.chapter ?? '全书'}）：扫描文 {modeCount.scan} 段 · 注释文 {modeCount.notes} 段 · 白话文 {modeCount.plain} 段
        </span>
      </div>
      <p className="hints">{TEXT_MODES.map((m) => `${m.label}=${m.hint}`).join('；')}；未收录的版本自动回退「真实校准文字」并标注。</p>

      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="在本书/本章中检索关键字（如：月破、旬空、用神；按校准文字命中）" className="question" />

      <div className="reader-body">
        {segs.length === 0 && <p className="meta">无匹配段落（可在「联网研读」补充检索）。</p>}
        {segs.slice(0, 500).map((s) => {
          const { body, fallback } = versionedText(s, mode);
          return (
            <div key={s.segId} className="reader-seg">
              {fallback && <p className="meta">〔该段暂未收录「{TEXT_MODES.find((m) => m.id === mode)?.label}」，以下为真实校准文字〕</p>}
              <div className="reader-text">{body}</div>
              <div className="reader-meta">〔{s.book}{s.chapter ? `·${s.chapter}` : ''} · {s.segId} · {TEXT_MODES.find((m) => m.id === mode)?.label}〕</div>
            </div>
          );
        })}
        {segs.length > 500 && <p className="meta">…仅显示前 500 段，请缩小检索范围。</p>}
      </div>
    </section>
  );
}
