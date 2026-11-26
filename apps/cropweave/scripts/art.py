"""Render original CropWeave Beta sprites and the social card with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

art = Path(__file__).resolve().parent.parent / 'public' / 'art'
art.mkdir(exist_ok=True)
ink = '#253829'
cream = '#fff5d9'
green = '#4e804a'
gold = '#f2bd56'
terra = '#be5a39'
plum = '#a3679f'
blue = '#58a5b3'
tile_images = {}

def pen(draw, points, color, width=2):
    draw.line(points, fill=color, width=width, joint='curve')

def plant(draw, color, center, petals):
    x,y = center
    pen(draw,[(x,y),(x,31)],green,4)
    for dx,dy in petals:
        draw.ellipse((x+dx-4,y+dy-4,x+dx+4,y+dy+4),color,ink)
    draw.ellipse((x-4,y-4,x+4,y+4),gold,ink)

def wheat(d):
    for x,y in [(10,12),(18,6),(26,12)]:
        pen(d,[(x,y+5),(x,31)],green)
        d.ellipse((x-3,y-4,x+3,y+7),gold,ink)
        for s in [-1,1]:
            d.ellipse((x+s*4-2,y+3,x+s*4+2,y+12),gold,ink)

def carrot(d):
    d.polygon([(9,12),(26,17),(13,33),(9,29)],terra,ink)
    pen(d,[(17,14),(13,5),(13,12),(22,4),(19,15),(28,8)],green,3)
    pen(d,[(13,21),(17,22),(15,26),(12,25)],cream)

def sunflower(d):
    plant(d,gold,(18,13),[(0,-7),(6,-4),(7,2),(4,7),(-4,7),(-7,2),(-6,-4)])

def hive(d):
    d.rounded_rectangle((5,7,31,30),radius=11,fill=gold,outline=ink,width=2)
    for y in [12,18,24]: pen(d,[(8,y),(28,y)],ink)
    d.rounded_rectangle((15,22,21,29),radius=2,fill=ink)
    pen(d,[(18,3),(18,7)],ink,2)

def well(d):
    d.rectangle((6,19,30,30),fill=blue,outline=ink,width=2)
    d.ellipse((6,15,30,23),blue,ink,2)
    pen(d,[(9,19),(9,9),(27,9),(27,19)],ink)
    d.polygon([(5,11),(18,3),(31,11)],terra,ink)

def scarecrow(d):
    pen(d,[(18,9),(18,32)],ink,3)
    d.polygon([(12,16),(25,16),(30,20),(25,24),(22,22),(22,29),(14,29),(14,22),(9,24),(6,20)],terra,ink)
    d.ellipse((13,7,23,17),cream,ink)
    d.polygon([(10,10),(25,10),(21,6),(15,6)],gold,ink)

def barn(d):
    d.polygon([(4,15),(9,7),(18,3),(27,7),(32,15),(32,32),(4,32)],terra,ink,2)
    d.rectangle((11,19,25,31),cream,ink)
    pen(d,[(11,20),(25,31),(25,20),(11,31)],terra)
    d.rectangle((15,10,21,15),cream,ink)

def cabbage(d):
    for x,y,s in [(11,20,9),(24,20,9),(18,13,9),(18,22,10)]:
        d.ellipse((x-s,y-s,x+s,y+s),green if x!=18 else '#9cb769',ink,2)
    pen(d,[(18,29),(18,12),(12,17),(18,23),(24,17)],ink)

def lavender(d):
    for x,y in [(9,16),(18,7),(27,16)]:
        pen(d,[(18,32),(x,y)],green,2)
        for k in [0,5,10]: d.ellipse((x-4,y+k-3,x+4,y+k+2),plum,ink)

def coop(d):
    d.ellipse((6,13,28,32),cream,ink,2)
    d.ellipse((19,7,31,22),cream,ink,2)
    d.polygon([(30,13),(35,16),(30,18)],gold,ink)
    d.polygon([(21,8),(23,3),(26,7),(28,5),(29,10)],terra,ink)
    d.ellipse((26,12,28,14),ink)
    pen(d,[(8,20),(4,13),(3,22),(8,27),(17,23)],ink)

def pear(d):
    d.rectangle((16,17,21,33),terra,ink)
    d.ellipse((4,3,32,25),green,ink,2)
    for x,y in [(10,13),(23,9),(21,20)]:
        d.ellipse((x,y-3,x+6,y+6),gold,ink)

def corn(d):
    d.rounded_rectangle((11,3,25,31),radius=6,fill=gold,outline=ink,width=2)
    for y in [9,14,19]: pen(d,[(12,y),(24,y)],ink,1)
    for x in [16,20]: pen(d,[(x,4),(x,22)],ink,1)
    d.polygon([(6,15),(17,25),(29,15),(26,26),(18,33),(10,28)],green,ink)

def pond(d):
    d.ellipse((3,9,33,29),blue,ink,2)
    d.arc((7,12,27,24),20,140,cream,2)
    d.ellipse((19,14,28,22),green,ink)
    pen(d,[(5,25),(5,15),(8,19)],ink)

def windmill(d):
    d.polygon([(13,30),(15,12),(21,12),(25,32),(11,32)],terra,ink)
    for poly in [[(17,14),(5,8),(6,3),(13,6)],[(19,14),(25,3),(31,5),(27,11)],
                 [(19,16),(31,22),(31,28),(25,25)],[(17,16),(10,29),(4,27),(7,20)]]:
        d.polygon(poly,cream,ink)
    d.ellipse((15,12,21,18),gold,ink)

def market(d):
    d.rectangle((6,13,30,31),cream,ink,2)
    d.rectangle((10,18,26,25),terra,ink)
    for x in range(4,31,6): d.rectangle((x,7,x+5,15),terra if x%12==4 else cream,ink)
    pen(d,[(5,31),(31,31)],ink,2)

for name,render in [('wheat',wheat),('carrot',carrot),('sunflower',sunflower),('beehive',hive),
                    ('well',well),('scarecrow',scarecrow),('barn',barn),('cabbage',cabbage),
                    ('lavender',lavender),('chicken-coop',coop),('pear-tree',pear),('corn',corn),
                    ('pond',pond),('windmill',windmill),('market-stall',market)]:
    image=Image.new('RGBA',(36,36))
    render(ImageDraw.Draw(image))
    tile_images[name]=image
    image.resize((72,72),Image.Resampling.NEAREST).save(art / f'{name}.png',optimize=True)

card=Image.new('RGB',(1200,630),'#e9e8cf')
draw=ImageDraw.Draw(card)
draw.rounded_rectangle((37,38,1163,592),radius=32,fill='#244738')
font=lambda size: ImageFont.truetype('DejaVuSans-Bold.ttf',size)
draw.text((105,131),'DAILY DEN',font=font(31),fill='#f4c667')
draw.text((100,220),'CropWeave',font=font(83),fill=cream)
draw.text((106,344),'The daily farm puzzle',font=font(32),fill=cream)
draw.rounded_rectangle((107,433,228,487),radius=13,fill='#f4c667')
draw.text((128,443),'BETA',font=font(29),fill=ink)
for n,name in enumerate(['wheat','beehive','sunflower','pond','barn','carrot','lavender','scarecrow','cabbage']):
    x,y=735+130*(n%3),126+130*(n//3)
    draw.rounded_rectangle((x,y,x+115,y+115),radius=14,fill=['#e8d79e','#d4dbaf','#e9c59b'][n%3])
    tile=tile_images[name].resize((96,96),Image.Resampling.NEAREST)
    card.paste(tile,(x+9,y+9),tile)
card.save(art/'share.png',optimize=True)
