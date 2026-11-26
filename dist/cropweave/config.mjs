export const GAME_ID = 'cropweave'
export const GAME_NAME = 'CropWeave'
export const GAME_URL = 'https://dailyden.games/cropweave'
export const RULES_VERSION = '1.0'
export const GENERATOR_VERSION = '1.0.0'
export const BETA = true

const tile = (id, name, group, relation, limit, unlock, base, tip) =>
  ({ id, name, group, relation, limit, unlock, base, tip })

function flowerTip(values, id) {
  const bonus = id==='lavender' ? ` This Lavender also earns +${values.lavenderHive} per neighboring Beehive.` : ''
  return `${values[id]} base. Each neighboring Beehive earns +${values.hive}.${bonus}`
}

const tiles = [
  tile('wheat','Wheat','crop','adjacent',5,1,1,v=>`${v.wheat} base + ${v.wheatNeighbor} per neighboring Wheat.`),
  tile('carrot','Carrot','crop',null,4,1,2,v=>`${v.carrot} base coins.`),
  tile('sunflower','Sunflower','flower','adjacent',3,1,1,v=>flowerTip(v,'sunflower')),
  tile('beehive','Beehive','animal','adjacent',2,1,0,v=>`${v.hive} per adjacent flower, and adjacent crops gain ${v.pollination}.`),
  tile('well','Well','helper','adjacent',3,1,0,v=>`Adjacent crops gain ${v.water} through irrigation.`),
  tile('scarecrow','Scarecrow','helper','area',3,1,0,v=>`Crops in the surrounding eight squares gain ${v.protection}.`),
  tile('barn','Barn','helper','line',2,1,0,v=>`${v.barn} per crop in its row and column, at any distance.`),
  tile('cabbage','Cabbage','crop','variety',3,1,1,v=>`${v.cabbage} base + ${v.cabbageVariety} per different neighboring crop type.`),
  tile('lavender','Lavender','flower','adjacent',3,1,1,v=>flowerTip(v,'lavender')),
  tile('chicken-coop','Chicken Coop','animal','variety',2,11,1,v=>`${v.coopVariety} coins beside two different crop types, otherwise ${v['chicken-coop']}.`),
  tile('pear-tree','Pear Tree','crop',null,4,21,3,v=>`${v['pear-tree']} base coins.`),
  tile('corn','Corn','crop','line',4,31,1,v=>`${v.corn} per Corn in its row, including itself.`),
  tile('pond','Pond','helper','area',2,41,0,v=>`Place on the plot edge to irrigate surrounding crops for +${v.water} each.`),
  tile('windmill','Windmill','helper','diagonal',2,51,0,v=>`${v.windmill} per crop on its four diagonal neighbors.`),
  tile('market-stall','Market Stall','helper','variety',2,61,0,v=>`${v['market-stall']} per different tile type in the surrounding eight squares.`)
]
const values = {
  ...Object.fromEntries(tiles.map(({id,base})=>[id,base])),
  wheatNeighbor:1, cabbageVariety:1, lavenderHive:1, hive:2, pollination:1, water:1,
  protection:1, barn:1, coopVariety:3, windmill:2, 'market-stall':1, corners:0, crow:false
}
const cards = {
  standard:{name:'Standard', text:'Use the usual scoring rules.', changes:{}},
  'dry-season':{name:'Dry Season', text:'Wells, Ponds and rivers irrigate for +2.', changes:{water:2}},
  'bee-festival':{name:'Bee Festival', text:'Beehives earn 3 per adjacent flower.', changes:{hive:3}, needs:'beehive'},
  'crow-day':{name:'Crow Day', text:'Only protected crops earn base coins.', changes:{crow:true}},
  'bumper-wheat':{name:'Bumper Wheat', text:'Wheat earns 2 base coins.', changes:{wheat:2}, needs:'wheat'},
  'cozy-corners':{name:'Cozy Corners', text:'Pieces in plot corners earn +2.', changes:{corners:2}},
  'market-day':{name:'Market Day', text:'Barns earn 2 per crop in their row or column.', changes:{barn:2}, needs:'barn'},
  'orchard-season':{name:'Orchard Season', text:'Pear Trees earn +2.', changes:{'pear-tree':5}, needs:'pear-tree'},
  'free-range':{name:'Free Range', text:'Chicken Coops earn 5 next to two different crop types.', changes:{coopVariety:5}, needs:'chicken-coop'},
  'windy-day':{name:'Windy Day', text:'Windmills earn double.', changes:{windmill:4}, needs:'windmill'}
}
export const versions = { '1.0': {tiles,values,cards} }
export const categories = [
  {name:'Base',icon:'●'}, {name:'Crop patterns',icon:'▦'}, {name:'Flowers & animals',icon:'✿'},
  {name:'Pollination',icon:'🐝'}, {name:'Irrigation',icon:'💧'}, {name:'Protection',icon:'🛡'},
  {name:'Buildings',icon:'⌂'}, {name:'Corners',icon:'◇'}
]
export const sprite = Object.fromEntries(tiles.map(({id})=>[id,`./art/${id}.png`]))
