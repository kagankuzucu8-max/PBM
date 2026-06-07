import { verdictLabel, verdictTone } from "@/lib/format";

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const firstLevel = (levels) => {
  const values = Array.isArray(levels) ? levels.map(numberOrNull).filter((value) => value != null) : [];
  return values.length ? values[0] : null;
};

export function buildAnalysisChange(previous, current) {
  if (!previous || !current) return null;

  const previousPayload = previous.payload || previous;
  const currentPayload = current.payload || current;
  const previousScore = numberOrNull(previous.combined_score ?? previousPayload.combined_score);
  const currentScore = numberOrNull(current.combined_score ?? currentPayload.combined_score);
  const scoreDelta = previousScore != null && currentScore != null ? currentScore - previousScore : null;
  const previousVerdict = previous.verdict || previousPayload.verdict || "neutral";
  const currentVerdict = current.verdict || currentPayload.verdict || "neutral";
  const previousTrend = previousPayload.trend || "sideways";
  const currentTrend = currentPayload.trend || "sideways";
  const previousSupport = firstLevel(previousPayload.key_levels?.support);
  const currentSupport = firstLevel(currentPayload.key_levels?.support);
  const previousResistance = firstLevel(previousPayload.key_levels?.resistance);
  const currentResistance = firstLevel(currentPayload.key_levels?.resistance);
  const changedVerdict = previousVerdict !== currentVerdict;
  const changedTrend = previousTrend !== currentTrend;

  let direction = "stable";
  if (scoreDelta != null && scoreDelta >= 8) direction = "improving";
  if (scoreDelta != null && scoreDelta <= -8) direction = "weakening";

  const notes = [];
  if (changedVerdict) notes.push(`Bias changed from ${verdictLabel(previousVerdict)} to ${verdictLabel(currentVerdict)}.`);
  if (changedTrend) notes.push(`Trend changed from ${previousTrend} to ${currentTrend}.`);
  if (!changedVerdict && scoreDelta != null) {
    notes.push(`Combined score ${scoreDelta >= 0 ? "increased" : "decreased"} by ${Math.abs(scoreDelta).toFixed(0)} points.`);
  }
  if (previousSupport != null && currentSupport != null && previousSupport !== currentSupport) {
    notes.push(`Nearest support moved ${currentSupport > previousSupport ? "higher" : "lower"}.`);
  }
  if (previousResistance != null && currentResistance != null && previousResistance !== currentResistance) {
    notes.push(`Nearest resistance moved ${currentResistance > previousResistance ? "higher" : "lower"}.`);
  }
  if (!notes.length) notes.push("The core setup remains materially unchanged.");

  return {
    direction,
    score_delta: scoreDelta == null ? null : Number(scoreDelta.toFixed(2)),
    previous_score: previousScore,
    current_score: currentScore,
    previous_verdict: previousVerdict,
    current_verdict: currentVerdict,
    previous_tone: verdictTone(previousVerdict),
    current_tone: verdictTone(currentVerdict),
    previous_created_at: previous.created_at || null,
    notes: notes.slice(0, 3),
  };
}
