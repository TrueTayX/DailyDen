const endpoint = '/api/home-analytics/events?action=cropweave'
const controls = new Set([
  'help-button', 'settings-button', 'pickup', 'scores-button', 'undo', 'finish', 'results', 'return',
  'tour-again', 'contrast', 'motion', 'preview-enabled', 'reset-tips', 'stats-button', 'tour-back',
  'tour-next', 'share', 'practice', 'reveal', 'show-solution', 'feedback', 'achievements-button'
])

export function cropAnalytics(review) {
  const noop = () => {}
  if (review !== null || location.origin !== 'https://dailyden.games' || navigator.globalPrivacyControl ||
      [navigator.doNotTrack, window.doNotTrack].includes('1')) return noop

  let visitor
  try {
    const key = 'dailyden.cropweave-analytics.v1'
    visitor = localStorage.getItem(key)
    if (!visitor) {
      visitor = crypto.randomUUID()
      localStorage.setItem(key, visitor)
    }
  } catch {
    return noop
  }

  const queue = []
  let timer
  function flush() {
    clearTimeout(timer)
    if (!queue.length) return
    const body = JSON.stringify({ visitor, events: queue.splice(0) })
    fetch(endpoint, { method: 'POST', credentials: 'omit', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body }).catch(() => {})
  }
  function record(kind, data = {}) {
    queue.push({ kind, id: crypto.randomUUID(), ...data })
    if (kind !== 'button' || queue.length >= 16) flush()
    else if (queue.length === 1) timer = setTimeout(flush, 1500)
  }

  document.addEventListener('click', event => {
    if (!event.isTrusted) return
    const control = event.target.closest('button, a, input[type="checkbox"]')
    if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return
    let detail = controls.has(control.id) ? control.id : control.dataset.analyticsButton
    if (control.matches('form[method="dialog"] button')) detail = 'close-' + control.closest('dialog').id
    if (control.matches('.home,.result-links a[href="/"]')) detail = 'home'
    if (control.matches('.site-footer a')) {
      detail = control.getAttribute('href')?.startsWith('mailto:sponsor@') ? 'sponsor' :
        control.getAttribute('href')?.startsWith('mailto:feedback@') ? 'contact' : 'privacy'
    }
    if (detail) record('button', { detail })
  }, true)
  window.addEventListener('pagehide', flush)
  return record
}
