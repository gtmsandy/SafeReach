import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Check } from 'lucide-react';
import { QUESTIONS, classify } from '../logic/triage';
import { saveIncident, saveTriageSession } from '../logic/offlineDB';

export default function TriageFlow() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [currentQ, setCurrentQ] = useState(0);
  const [responses, setResponses] = useState([]);
  const [selected, setSelected] = useState(null);
  const submittingRef = useRef(false);
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
      {
        q_id: question.id,
        option_id: selected,
      },
    ];

    if (isLast) {
      if (submittingRef.current) return;
      submittingRef.current = true;

      const result = classify(newResponses);
      const country = localStorage.getItem('safereach_country') || 'BD';

      let summary = `${result.severity.charAt(0).toUpperCase() + result.severity.slice(1)} Trauma Assessment`;
      if (result.flags && result.flags.length > 0) {
        summary += ` · ${result.flags.join(', ')}`;
      }

      await saveIncident({
        country_code: country,
        severity: result.severity,
        score: result.score,
        summary,
        first_aid_id: result.first_aid_id,
        flags: result.flags,
        responses: newResponses,
        was_offline: !navigator.onLine,
        location: null,
      }).catch((err) => {
        console.warn('[SafeReach] Failed to save incident to vault:', err);
      });

      sessionStorage.setItem('triage_result', JSON.stringify(result));
      navigate('/results');
      return;
    }

    setResponses(newResponses);
    setCurrentQ((q) => q + 1);
    setSelected(null);
  }

  function handleBack() {
    if (currentQ === 0) {
      navigate('/');
      return;
    }

    const previousResponse = responses[currentQ - 1];

    setSelected(previousResponse?.option_id || null);

    setResponses((currentResponses) =>
      currentResponses.slice(0, -1)
    );

    setCurrentQ((q) => q - 1);
  }

  return (
    <div
      className="screen"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      {/* ───────────────── Header ───────────────── */}

      <header
        style={{
          padding: '16px 20px 14px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          {/* Back Button */}

          <button
            id="btn-triage-back"
            onClick={handleBack}
            aria-label={t('back')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px 4px',
              minWidth: 70,
            }}
          >
            <ChevronLeft size={22} />

            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t('back')}
            </span>
          </button>

          {/* Title */}

          <div
            style={{
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--text-primary)',
              }}
            >
              Emergency Assessment
            </div>
          </div>

          {/* Step */}

          <div
            style={{
              minWidth: 70,
              textAlign: 'right',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-secondary)',
            }}
          >
            {currentQ + 1} / {QUESTIONS.length}
          </div>
        </div>

        {/* Progress */}

        <div
          style={{
            width: '100%',
            height: 8,
            background: 'var(--border)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background:
                'linear-gradient(90deg, #DC2626, #F97316)',
              borderRadius: 999,
              transition: 'width 0.35s ease',
            }}
          />
        </div>

        {/* Progress Label */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 7,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
            }}
          >
            Emergency triage
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--accent)',
            }}
          >
            {Math.round(progress)}% complete
          </span>
        </div>
      </header>

      {/* ───────────────── Main Content ───────────────── */}

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 680,
          margin: '0 auto',
          padding: '28px 20px 130px',
        }}
      >
        {/* Question Label */}

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 11px',
            borderRadius: 999,
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent-border)',
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
            }}
          >
            Question {currentQ + 1}
          </span>
        </div>

        {/* Question Card */}

        <section
          style={{
            padding: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            boxShadow: 'var(--shadow-sm)',
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 23,
              fontWeight: 800,
              lineHeight: 1.35,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            {question.text}
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}
          >
            Select the option that best describes the situation.
          </p>
        </section>

        {/* Answer Options */}

        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {question.options.map((option) => {
            const isSelected = selected === option.id;

            return (
              <button
                key={option.id}
                id={`opt-${question.id}-${option.id}`}
                onClick={() => handleSelect(option)}
                aria-pressed={isSelected}
                style={{
                  width: '100%',
                  minHeight: 72,

                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,

                  padding: '18px 18px',

                  textAlign: 'left',

                  background: isSelected
                    ? 'var(--accent-bg)'
                    : 'var(--bg-card)',

                  border: isSelected
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border)',

                  borderRadius: 16,

                  cursor: 'pointer',

                  boxShadow: isSelected
                    ? '0 6px 20px rgba(220, 38, 38, 0.12)'
                    : 'var(--shadow-sm)',

                  transform: isSelected
                    ? 'translateY(-1px)'
                    : 'translateY(0)',

                  transition:
                    'all 0.18s ease',

                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Selection Indicator */}

                <div
                  style={{
                    width: 26,
                    height: 26,

                    borderRadius: '50%',

                    flexShrink: 0,

                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',

                    border: isSelected
                      ? '2px solid var(--accent)'
                      : '2px solid var(--border-strong)',

                    background: isSelected
                      ? 'var(--accent)'
                      : 'transparent',

                    transition: 'all 0.18s ease',
                  }}
                >
                  {isSelected && (
                    <Check
                      size={16}
                      color="#FFFFFF"
                      strokeWidth={3}
                    />
                  )}
                </div>

                {/* Option Text */}

                <span
                  style={{
                    fontSize: 16,
                    fontWeight: isSelected ? 700 : 500,
                    lineHeight: 1.45,

                    color: isSelected
                      ? 'var(--text-primary)'
                      : 'var(--text-primary)',
                  }}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </section>
      </main>

      {/* ───────────────── Sticky Bottom Action ───────────────── */}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,

          zIndex: 30,

          padding:
            '14px 20px calc(14px + var(--safe-bottom, 0px))',

          background: 'var(--bg-card)',

          borderTop: '1px solid var(--border)',

          boxShadow:
            '0 -8px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            maxWidth: 680,
            margin: '0 auto',
          }}
        >
          <button
            id="btn-triage-next"
            onClick={handleNext}
            disabled={!selected}
            style={{
              width: '100%',
              minHeight: 56,

              border: 'none',
              borderRadius: 14,

              fontSize: 16,
              fontWeight: 800,

              color: '#FFFFFF',

              background: selected
                ? 'linear-gradient(135deg, #DC2626, #B91C1C)'
                : 'var(--border)',

              boxShadow: selected
                ? '0 6px 18px rgba(220,38,38,0.28)'
                : 'none',

              cursor: selected
                ? 'pointer'
                : 'not-allowed',

              transition:
                'all 0.2s ease',

              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {isLast
              ? 'View Emergency Assessment'
              : 'Continue'}
          </button>

          {!selected && (
            <p
              style={{
                margin: '8px 0 0',
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--text-tertiary)',
              }}
            >
              Select an answer to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}