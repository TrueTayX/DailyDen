import {cp,mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {getPuzzleDate} from '../../../packages/game/daily.mjs'

const start=process.argv[2]??getPuzzleDate()
if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw Error('Use YYYY-MM-DD')
const output=resolve('reports/cropweave')
const archive=JSON.parse(await readFile(new URL('../content/archive.json',import.meta.url)))
const days=archive.calendar.filter(p=>p.date>=start).slice(0,14)
if (!days.length) throw Error('No review puzzles on or after '+start)
await mkdir(resolve(output,'assets'),{recursive:true})
await cp(new URL('../public/',import.meta.url),resolve(output,'play'),{recursive:true})
await cp(new URL('../../../packages/game/daily.mjs',import.meta.url),resolve(output,'assets/game-daily.mjs'))
await writeFile(resolve(output,'play/review.json'),JSON.stringify({days:Object.fromEntries(days.map(p=>[p.date,p]))}))
const table=days.map(p=>`<tr><th><a href="./play/?review=${p.date}">${p.date}</a></th>
<td>${p.ruleCard}</td><td>${p.plot.size}×${p.plot.size}, ${p.plot.shape}</td><td>${p.deck}</td>
<td>${p.bestKnown.score} (${p.bestKnown.status})</td><td>${(p.metrics.randomAvg/p.bestKnown.score*100).toFixed(1)}%</td>
<td>${(p.metrics.greedy/p.bestKnown.score*100).toFixed(1)}%</td><td>${(p.metrics.density*100).toFixed(1)}%</td>
<td>${archive.reserves.some(r=>r.date===p.date)?'Yes':'—'}</td></tr>`).join('\n')
await writeFile(resolve(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>CropWeave calendar review</title>
<style>body{font:16px system-ui;margin:2rem;background:#f5efdc;color:#243a2a}td,th{padding:.5rem;text-align:left;border-bottom:1px solid #888}a{color:#234738}</style>
<h1>CropWeave calendar review</h1><p>Upcoming puzzle solutions are available from the play page after finishing.</p>
<table><thead><tr><th>Date</th><th>Rule</th><th>Plot</th><th>Deck</th><th>Score</th><th>Random</th><th>Greedy</th><th>Density</th><th>Reserve</th></tr></thead><tbody>${table}</tbody></table></html>`)
console.log('Serve reports/cropweave/ to review '+days.length+' puzzles.')
