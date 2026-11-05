// Coloured label for a decision, a clause result or a report status
const LOOK = {
  ACCEPT: 'pass', PASS: 'pass', approved: 'pass', APPROVED: 'pass',
  REJECT: 'fail', FAIL: 'fail', returned_for_reanalysis: 'fail', REJECTED: 'fail',
  'NOT VERIFIABLE': 'check', 'CHECK MANUALLY': 'check', 'NOT REPORTED': 'check',
  draft: 'check', pending_am: 'check', pending_dm: 'check', 'PENDING ANALYSIS': 'neutral',
}
const TEXT = {
  draft: 'Draft, not sent yet', pending_am: 'Waiting for AM', pending_dm: 'Waiting for DM', approved: 'Approved',
  returned_for_reanalysis: 'Returned for re-analysis', 'PENDING ANALYSIS': 'Not analysed',
}
export default function StatusBadge({ value, big = false }) {
  return <span className={`badge ${LOOK[value] || 'neutral'}${big ? ' big' : ''}`}>{TEXT[value] || value}</span>
}
