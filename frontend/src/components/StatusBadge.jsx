// Coloured label for a decision, a clause result or a report status
const LOOK = {
  ACCEPT: 'pass', PASS: 'pass', approved: 'pass',
  REJECT: 'fail', FAIL: 'fail', returned_for_reanalysis: 'fail',
  'NOT VERIFIABLE': 'check', 'CHECK MANUALLY': 'check', 'NOT REPORTED': 'check',
  pending_am: 'neutral', pending_dm: 'neutral',
}
const TEXT = {
  pending_am: 'Waiting for AM', pending_dm: 'Waiting for DM', approved: 'Approved',
  returned_for_reanalysis: 'Returned for re-analysis',
}
export default function StatusBadge({ value }) {
  return <span className={`badge ${LOOK[value] || 'neutral'}`}>{TEXT[value] || value}</span>
}
