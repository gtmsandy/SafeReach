/**
 * SafeReach Triage Decision Tree
 * Pure JavaScript — no API call, works 100% offline.
 * 
 * 5 questions, scored answers, produces severity + first_aid_id + flags.
 */

export const QUESTIONS = [
  {
    id: 'q1',
    key: 'consciousness',
    text: 'Is the person conscious?',
    options: [
      { id: 'unconscious', label: 'Unconscious / unresponsive', score: 3 },
      { id: 'confused', label: 'Confused or drowsy', score: 2 },
      { id: 'conscious', label: 'Fully conscious and alert', score: 0 },
    ],
  },
  {
    id: 'q2',
    key: 'bleeding',
    text: 'Is there heavy bleeding?',
    options: [
      { id: 'heavy', label: 'Heavy, uncontrolled bleeding', score: 3 },
      { id: 'minor', label: 'Minor bleeding', score: 1 },
      { id: 'none', label: 'No bleeding', score: 0 },
    ],
  },
  {
    id: 'q3',
    key: 'spinal',
    text: 'Is there suspected spinal or neck injury?',
    options: [
      { id: 'yes', label: 'Yes, or possibly', score: 2, flags: ['NO_MOVE'] },
      { id: 'no', label: 'No', score: 0 },
    ],
  },
  {
    id: 'q4',
    key: 'breathing',
    text: 'Is the person breathing normally?',
    options: [
      { id: 'not_breathing', label: 'Not breathing', score: 4, override: 'critical', override_aid: 'cpr_needed' },
      { id: 'laboured', label: 'Laboured or gasping', score: 3 },
      { id: 'normal', label: 'Breathing normally', score: 0 },
    ],
  },
  {
    id: 'q5',
    key: 'victims',
    text: 'How many victims are there?',
    options: [
      { id: 'many', label: '3 or more people', score: 2 },
      { id: 'few', label: '1 or 2 people', score: 0 },
    ],
  },
];

/**
 * Facility type recommendations by severity
 */
export const FACILITY_ROUTING = {
  critical: ['trauma_center', 'hospital', 'ambulance'],
  serious: ['hospital', 'trauma_center', 'ambulance'],
  stable: ['hospital', 'police', 'clinic'],
};

/**
 * Classify severity from collected responses
 * @param {Array<{q_id: string, option_id: string}>} responses
 * @returns {{ severity: 'critical'|'serious'|'stable', first_aid_id: string, flags: string[], score: number, recommended_types: string[] }}
 */
export function classify(responses) {
  let totalScore = 0;
  const flags = [];
  let severityOverride = null;
  let aidOverride = null;

  for (const response of responses) {
    const question = QUESTIONS.find((q) => q.id === response.q_id);
    if (!question) continue;

    const option = question.options.find((o) => o.id === response.option_id);
    if (!option) continue;

    totalScore += option.score || 0;

    if (option.flags) {
      flags.push(...option.flags);
    }

    if (option.override) {
      severityOverride = option.override;
      aidOverride = option.override_aid;
    }
  }

  // Severity override (not breathing → always critical CPR)
  if (severityOverride) {
    return {
      severity: severityOverride,
      first_aid_id: aidOverride,
      flags,
      score: totalScore,
      recommended_types: FACILITY_ROUTING[severityOverride],
    };
  }

  // Score-based classification
  let severity;
  let first_aid_id;

  if (totalScore >= 6) {
    severity = 'critical';
    first_aid_id = 'critical_trauma';
  } else if (totalScore >= 3) {
    severity = 'serious';
    first_aid_id = 'serious_trauma';
  } else {
    severity = 'stable';
    first_aid_id = 'minor_injury';
  }

  return {
    severity,
    first_aid_id,
    flags,
    score: totalScore,
    recommended_types: FACILITY_ROUTING[severity],
  };
}

export default { QUESTIONS, classify, FACILITY_ROUTING };
