import json,re,statistics
RNG={'huey':{'d1':(0.6,14.5),'t1':(15.0,23.5),'d2a':(24.0,36.6),'d2b':(37.2,46.6),'d2c':(51.5,56.2),'dash':(57.3,69.0),'c1':(70.3,80.5)},
     'nat':{'d1':(0.0,14.9),'t1':(15.5,21.7),'d2a':(25.8,35.2),'d2b':(38.3,46.3),'d2c':(52.7,57.0),'dash':(61.0,69.6),'c1':(73.0,80.8)}}
W={n:[x for s in json.load(open(n+'.json')) for x in s['words']] for n in RNG}
norm=lambda t: re.sub(r"[^a-z0-9']","",t.lower())
rows={}; cuts={'huey':{},'nat':{}}
for sec in RNG['huey']:
    for n in RNG:
        a,b=RNG[n][sec]; ws=[w for w in W[n] if a<=w['s']<=b]
        # repeats / false starts: A A, or A B A -> drop the earlier A (and B)
        rep=[]; i=0
        while i<len(ws)-2:
            if norm(ws[i]['w'])==norm(ws[i+1]['w']): rep.append((ws[i]['s'],ws[i+1]['s'],ws[i]['w'])); i+=1
            elif norm(ws[i]['w'])==norm(ws[i+2]['w']) and len(norm(ws[i]['w']))>1: rep.append((ws[i]['s'],ws[i+2]['s'],ws[i]['w']+' '+ws[i+1]['w'])); i+=2
            else: i+=1
        hes=0
        for i in range(len(ws)-1):
            gap=ws[i+1]['s']-ws[i]['e']
            if gap>0.30 and not re.search(r"[.,?!]$",ws[i]['w']): hes+=1
        low=[w for w in ws if w['p']<0.5 and not (29.7<=w['s']<=30.3)]
        # a repeat's low-confidence words are already counted as the repeat
        low=[w for w in low if not any(s-0.05<=w['s']<e+0.05 for s,e,_ in rep)]
        gaps=[max(0,ws[i+1]['s']-ws[i]['e']) for i in range(len(ws)-1)]
        smooth=statistics.pstdev([g for g in gaps if g<0.6]) if len(gaps)>2 else 0
        speech=ws[-1]['e']-ws[0]['s']; nw=len(ws)-len(rep)
        wpm_art=60*nw/max(0.1,speech-0.3*len(rep))
        score=3*len(rep)+2*hes+1.5*len(low)
        rows[(sec,n)]=dict(rep=rep,hes=hes,low=[(w['w'],round(w['p'],2)) for w in low],smooth=smooth,wpm=wpm_art,score=score,words=nw)
        cuts[n][sec]=[(round(s,3),round(e,3)) for s,e,_ in rep]
picks={}
print(f"{'sec':5}{'who':6}{'stumbles':>9}{'hesit':>6}{'unclear':>8}{'smooth':>8}{'wpm(speech)':>12}  details")
for sec in RNG['huey']:
    for n in RNG:
        r=rows[(sec,n)]
        det=[]
        if r['rep']: det.append('repeats: '+', '.join(f'"{x[2]}"' for x in r['rep']))
        if r['low']: det.append('unclear: '+', '.join(f'{w}({p})' for w,p in r['low']))
        print(f"{sec:5}{n:6}{len(r['rep']):9}{r['hes']:6}{len(r['low']):8}{r['smooth']:8.2f}{r['wpm']:12.0f}  {'; '.join(det)}")
    h,nt=rows[(sec,'huey')],rows[(sec,'nat')]
    d=h['score']-nt['score']
    if abs(d)>=1: picks[sec]='nat' if d>0 else 'huey'
    else:
        picks[sec]='huey' if h['wpm']<nt['wpm'] else 'nat'   # tie on stumbles -> the slower, more measured take
        if abs(h['wpm']-nt['wpm'])<8: picks[sec]='huey' if h['smooth']<nt['smooth'] else 'nat'
print('\nPICKS (stumbles first, then pace, then smoothness):',picks)
json.dump(picks,open('picks_flow.json','w')); json.dump(cuts,open('cuts_flow.json','w'))
tot_words=sum(rows[(s,picks[s])]['words'] for s in picks)
print('words in picked demo narration:',tot_words)
