import { useState } from 'react'
import './App.css'

function romanToInt(roman) {
  if (!roman) return 0;
  const map = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
  };
  const trimmed = String(roman).trim().toUpperCase();
  if (map[trimmed] != null) return map[trimmed];
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMonthYear(item) {
  const month = item?.ExamMonth ? String(item.ExamMonth).trim() : '';
  const year = item?.ExamYear ? String(item.ExamYear).trim() : '';
  return [month, year].filter(Boolean).join(' ');
}

function SummaryCard({ student }) {
  if (!student) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-2 text-slate-700 dark:text-slate-200">
        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{student.StudentName}</div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div><span className="font-medium">Scholar No:</span> {student.ScholarNo}</div>
          <div><span className="font-medium">Enrollment No:</span> {student.EnrollmentNo}</div>
          <div><span className="font-medium">Degree:</span> {student.Degree}</div>
          {student.Specialization && (
            <div><span className="font-medium">Specialization:</span> {student.Specialization}</div>
          )}
          {student.Department && (
            <div><span className="font-medium">Department:</span> {student.Department}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SemesterCard({ item }) {
  const header = `Semester ${item.Semester || ''}`.trim();
  const when = formatMonthYear(item);
  const totalLine = item.ObtainGrandTotal && item.MaxGrandTotal
    ? `${item.ObtainGrandTotal}/${item.MaxGrandTotal}`
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{header}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{when}</div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">{item.Result}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-300">SGPA</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.SGPA ?? '-'}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-300">CGPA</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.CGPA ?? '-'}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-300">Total</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{totalLine ?? '-'}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-300">Percentage</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.Percentage ?? '-'}</div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [scholarNo, setScholarNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);

  const student = results?.[0] ?? null;

  const sortedResults = [...results].sort((a, b) => {
    const aSem = romanToInt(a.Semester);
    const bSem = romanToInt(b.Semester);
    if (aSem !== bSem) return aSem - bSem;
    const ay = Number(a.ExamYear) || 0;
    const by = Number(b.ExamYear) || 0;
    return ay - by;
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResults([]);
    if (!scholarNo.trim()) {
      setError('Please enter a scholar number');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/getResult?scholarNo=${encodeURIComponent(scholarNo.trim())}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || `Request failed with ${resp.status}`);
      }
      const data = await resp.json();
      if (!Array.isArray(data) || data.length === 0) {
        setError('No results found');
      } else {
        setResults(data);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const hasContent = Boolean(error) || sortedResults.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:py-8">
        <div className={`${hasContent ? '' : 'min-h-[50vh] grid place-items-center'}`}>
          <div className="w-full max-w-2xl mx-auto">
            <h1 className="mb-3 sm:mb-4 text-center text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">Student Result Lookup</h1>
            <form onSubmit={handleSubmit} className="w-full mb-4">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter Scholar Number"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 shadow-sm outline-none ring-sky-500 focus:border-sky-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400"
                  value={scholarNo}
                  onChange={(e) => setScholarNo(e.target.value)}
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-3 font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? 'Searching…' : 'Search'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {error && (
          <div className="mt-3 mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </div>
        )}

        {student && (
          <div className="mt-4">
            <SummaryCard student={student} />
          </div>
        )}

        {sortedResults.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedResults.map((item, idx) => (
              <SemesterCard key={`${item.Id}-${idx}`} item={item} />
            ))}
          </div>
        )}
        
      </div>
    </div>
  )
}

export default App
