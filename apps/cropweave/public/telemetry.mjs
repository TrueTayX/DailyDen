import { BETA } from './config.mjs'

export function telemetry(store,puzzle,endpoint) {
  const buffer=[]
  const tips=new Set()
  let timer
  const isPrivate = navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'
  function flush() {
    clearTimeout(timer)
    if (!buffer.length) return
    const batch=buffer.splice(0,buffer.length)
    if (endpoint) {
      fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
        keepalive:true,body:JSON.stringify(batch)}).catch(()=>{})
    } else {
      const history=store.read('events',[])
      store.write('events',[...(Array.isArray(history)?history:[]),...batch].slice(-150))
    }
  }
  return {
    event(name,data={}) {
      if (isPrivate) return
      if (name==='tip_shown') {
        if (tips.has(data.tile)) return
        tips.add(data.tile)
      }
      buffer.push({name,env:BETA?'beta':'production',puzzle:puzzle.id,date:puzzle.date,
        weekday:new Date(puzzle.date+'T00:00:00Z').getUTCDay(),...data})
      if (buffer.length>=12) flush()
      else if (buffer.length===1) timer=setTimeout(flush,12000)
    },
    flush
  }
}
