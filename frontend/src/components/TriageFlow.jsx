import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Mic } from 'lucide-react';
import { QUESTIONS, classify } from '../logic/triage';
import { saveTriageSession } from '../logic/offlineDB';

export default function TriageFlow() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [currentQ, setCurrentQ] = useState(0);
  const [responses, setResponses] = useState([]);
  const [selected, setSelected] = useState(null);

  const question = QUESTIONS[currentQ];
  const isLast = currentQ === QUESTIONS.length - 1;
  const progress = ((currentQ + 1) / QUESTIONS.length) * 100;

  function handleSelect(option) {
    setSelected(option.id);
  }

  async function handleNext() {
    if (!selected) return;

    const newResponses = [
      ...responses,
      { q_id: question.id, option_id: selected },
    ];

    if (isLast) {
      const result = classify(newResponses);
      const country = localStorage.getItem('safereach_country') || 'BD';
      await saveTriageSession({
        country_code: country,
        severity: result.severity,
        was_offline: !navigator.onLine,
      }).catch(() => {});
      sessionStorage.setItem('triage_result', JSON.stringify(result));
      navigate('/results');
    } else {
      setResponses(newResponses);
      setCurrentQ((q) => q + 1);
      setSelected(null);
    }
  }

  function handleBack() {
    if (currentQ === 0) { navigate('/'); return; }
    const prevResponse = responses[currentQ - 1];
    setSelected(prevResponse?.option_id || null);
    setResponses((r) => r.slice(0, -1));
    setCurrentQ((q) => q - 1);
  }

  return (
    <div className="screen">
      {/* ── Top bar ── */}
      <header className="topbar">
        <button
          onClick={handleBack}
          className="touch-target flex items-center gap-1"
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px' }}
          id="btn-triage-back"
        >
          <ChevronLeft size={22} />
          <span className="text-label">{t('back')}</span>
        </button>

        {/* Step dots */}
        <div className="step-dots">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={`step-dot ${i === currentQ ? 'active' : i < currentQ ? 'done' : 'inactive'}`}
              style={{ width: i === currentQ ? 20 : 6 }}
            />
          ))}
        </div>

        <span className="text-label" style={{ color: 'var(--text-tertiary)', minWidth: 40, textAlign: 'right' }}>
          {currentQ + 1}/{QUESTIONS.length}
        </span>
      </header>

      {/* ── Progress bar ── */}
      <div className="sr-progress-track" style={{ borderRadius: 0 }}>
        <div className="sr-progress-fill" style={{ width: `${progress}%`, borderRadius: 0 }} />
      </div>

      {/* ── Content ── */}
      <main className="flex-1 flex flex-col px-5 pt-7 pb-6 gap-6">

        {/* Triage label */}
        <div className="flex items-center gap-2">
          <span
            className="text-micro"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('triage_title')}
          </span>
        </div>

        {/* Question */}
        <div
          style={{
            padding: '20px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: '-0.015em',
              color: 'var(--text-primary)',
            }}
          >
            {question.text}
          </h2>
        </div>

        {/* Answer options */}
        <div className="flex flex-col gap-3 flex-1">
          {question.options.map((option) => {
            const isSelected = selected === option.id;
            return (
              <button
                key={option.id}
                id={`opt-${question.id}-${option.id}`}
                onClick={() => handleSelect(option)}
                className={`triage-option ${isSelected ? 'selected' : ''}`}
              >
                {/* Radio dot */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSelected && (
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#fff',
                    }} />
                  )}
                </div>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                    lineHeight: 1.5,
                  }}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Notes input with mic */}
        <div className="relative">
          <input
            className="sr-input"
            placeholder="Additional notes (optional)..."
            style={{ paddingRight: 44 }}
            id="triage-notes"
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
            aria-label="Voice input"
          >
            <Mic size={18} color="var(--text-tertiary)" />
          </button>
        </div>

        {/* Next button */}
        <button
          id="btn-triage-next"
          className="btn-primary"
          onClick={handleNext}
          disabled={!selected}
          style={{
            paddingTop: 18,
            paddingBottom: 18,
            opacity: selected ? 1 : 0.4,
            cursor: selected ? 'pointer' : 'not-allowed',
          }}
        >
          {isLast ? 'See Results →' : t('next')}
        </button>
      </main>
    </div>
  );
}
