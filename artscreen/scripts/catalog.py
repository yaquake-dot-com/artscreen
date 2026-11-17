"""Fetch artwork metadata directly from Commons. Run from the application directory."""
import json, urllib.request, urllib.parse, re, time, html, sys
from pathlib import Path
TARGETS = [
 ('Босх','Hieronymus Bosch','Garden of Earthly Delights'),
 ('Босх','Hieronymus Bosch','Haywain Triptych'),
 ('Шишкин','Ivan Shishkin','Rye'),
 ('Шишкин','Ivan Shishkin','Morning in a Pine Forest'),
 ('Айвазовский','Ivan Aivazovsky','Ninth Wave'),
 ('Айвазовский','Ivan Aivazovsky','Black Sea'),
 ('Брейгель','Pieter Bruegel','Hunters in the Snow'),
 ('Брейгель','Pieter Bruegel','Tower of Babel'),
 ('Левитан','Isaac Levitan','Golden Autumn'),
 ('Левитан','Isaac Levitan','Above Eternal Peace'),
 ('Куинджи','Arkhip Kuindzhi','Night on the Dniepr'),
 ('Куинджи','Arkhip Kuindzhi','Birch Grove'),
 ('Моне','Claude Monet','Water Lilies'),
 ('Ван Гог','Vincent van Gogh','Starry Night'),
]
selected=sys.argv[1:]
rows=[row for row in json.loads(Path('src/art.json').read_text()) if selected and row['artist'] not in selected]
seen={int(row['id']) for row in rows}
for label,artist,title in TARGETS:
    if selected and label not in selected: continue
    params={'action':'query','format':'json','generator':'search','gsrsearch':f'{artist} {title} filetype:bitmap -intitle:detail -intitle:fragment','gsrnamespace':6,'gsrlimit':30,'prop':'imageinfo','iiprop':'url|size|mime|extmetadata','iiurlwidth':3840}
    req=urllib.request.Request('https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params),headers={'User-Agent':'ArtScreen/0.2 (public domain painting catalogue)'})
    try:
        with urllib.request.urlopen(req,timeout=45) as response: data=json.load(response)
        candidates=[]
        for page in data.get('query',{}).get('pages',{}).values():
            ii=page.get('imageinfo',[{}])[0]; meta=ii.get('extmetadata',{})
            get=lambda k: html.unescape(re.sub('<[^>]+>',' ',meta.get(k,{}).get('value',''))).strip()
            if ii.get('mime')!='image/jpeg' or ii.get('width',0)<3840 or ii.get('height',0)<2160: continue
            if get('LicenseShortName').lower() not in ['public domain','cc0']: continue
            if artist.split()[-1].lower() not in get('Artist').lower(): continue
            haystack=(page['title']+' '+get('ObjectName')).lower()
            if not all(word.lower() in haystack for word in title.split() if len(word)>3): continue
            if re.search(r'\b(detail|fragment|portrait|copy after)\b|[-_]x[0-9]+[-_]y[0-9]+',haystack): continue
            if page['pageid'] in seen: continue
            candidates.append((page,ii))
        if candidates:
            page,ii=max(candidates,key=lambda pair:pair[1]['width']*pair[1]['height'])
            seen.add(page['pageid'])
            rows.append({'id':str(page['pageid']),'title':title,'artist':label,'url':ii.get('thumburl',ii['url']),'source':ii['descriptionurl'],'license':re.sub('<[^>]+>','',ii['extmetadata']['LicenseShortName']['value']),'width':ii['width'],'height':ii['height']})
            print(label,title,'OK',flush=True)
        else: print(label,title,'not found at required resolution',flush=True)
    except Exception as error: print(label,title,str(error),flush=True)
    time.sleep(3)
missing={a for a,_,_ in TARGETS}-{row['artist'] for row in rows}
if missing: raise SystemExit('Catalogue not replaced; missing artists: '+', '.join(sorted(missing)))
Path('src/art.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
