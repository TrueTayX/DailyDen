const names = new Set(['puzzle_started', 'puzzle_finished', 'tip_shown', 'share_clicked', 'puzzle_abandoned'])
const tiles = new Set(['wheat','carrot','sunflower','beehive','well','scarecrow','barn','cabbage',
  'lavender','chicken-coop','pear-tree','corn','pond','windmill','market-stall'])
const bounded = (value, maximum) => Number.isInteger(value) && value >= 0 && value <= maximum

export function eventBatch(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 12) return []
  return raw.flatMap(event => {
    if (!event || !names.has(event.name) || !['beta','production'].includes(event.env) ||
        typeof event.puzzle !== 'string' || !/^cw-\d{4,}$/.test(event.puzzle) ||
        typeof event.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !bounded(event.weekday,6)) return []
    const {name,env,puzzle,date,weekday}=event
    const limited={name,env,puzzle,date,weekday}
    if (name==='tip_shown') {
      if (!tiles.has(event.tile)) return []
      limited.tile=event.tile
    } else if (name==='puzzle_finished') {
      const {coins,stars,percent,time,undos,pickups,preview,beatBest}=event
      if (!bounded(coins,2000)||!bounded(stars,3)||!bounded(percent,5000)||!bounded(time,86400000)||
          !bounded(undos,10000)||!bounded(pickups,10000)||typeof preview!=='boolean'||typeof beatBest!=='boolean') return []
      Object.assign(limited,{coins,stars,percent,time,undos,pickups,preview,beatBest})
    }
    return [limited]
  })
}

async function readBatch(request) {
  if (Number(request.headers.get('Content-Length'))>8192 || !request.body) return []
  const input=request.body.getReader()
  const data=new Uint8Array(8192)
  let length=0
  try {
    for (;;) {
      const {done,value}=await input.read()
      if (done) break
      if (length+value.length>data.length) {
        await input.cancel()
        return []
      }
      data.set(value,length)
      length+=value.length
    }
    return eventBatch(JSON.parse(new TextDecoder().decode(data.subarray(0,length))))
  } finally {
    input.releaseLock()
  }
}

export async function onRequestPost({request,env}) {
  const result=()=>new Response(null,{status:204,headers:{'Cache-Control':'no-store'}})
  if (!env.CROPWEAVE_ANALYTICS || request.headers.get('Sec-GPC')==='1' || request.headers.get('DNT')==='1' ||
      request.headers.get('Origin')!==new URL(request.url).origin ||
      !request.headers.get('Content-Type')?.startsWith('application/json')) return result()
  try {
    const events=await readBatch(request)
    if (!events.length) return result()
    const window=Math.floor(Date.now()/3600000)
    // One bounded insert per batch. No visitor identifiers or tile coordinates.
    await env.CROPWEAVE_ANALYTICS.prepare(`
      INSERT INTO cropweave_batches (hour, events)
      SELECT ?, ? WHERE (SELECT COUNT(*) FROM cropweave_batches WHERE hour=?) < 300
    `).bind(window,JSON.stringify(events),window).run()
  } catch { /* Analytics must never block gameplay. */ }
  return result()
}
