#!/usr/bin/env python3
# Builds the edited demo section: per-section speaker pick, gaps between words removed, demo sped up to match,
# facecam placed over the quietest part of the picture. Usage: edit.py [picks.json]
import subprocess, json, re, sys, os
import numpy as np
F='../node_modules/ffmpeg-static/ffmpeg'
D='/Users/hueylee/Documents/Demo'
SECDIR=os.environ.get('SECDIR','sec'); OUTNAME=os.environ.get('OUTNAME','demo-section-edited')
OUT=f'{D}/edited'; os.makedirs(OUT,exist_ok=True); os.makedirs(SECDIR,exist_ok=True)
CUTS=json.load(open(os.environ['CUTS'])) if os.environ.get('CUTS') else {}
SRC={'huey':f'{D}/Huey record.mp4','nat':f'{D}/Natanael record.mp4'}
DEMO=f'{D}/demo.mp4'
GAIN={'huey':2.0,'nat':0.0}  # dB, brings both voices to a similar level
SCENE={'d1':(0.0,15.38),'t1':(15.38,25.36),'d2a':(25.36,38.24),'d2b':(38.24,52.55),'d2c':(52.55,57.16),'dash':(57.16,72.61),'c1':(72.61,83.92)}
RNG={'huey':{'d1':(0.6,14.5),'t1':(15.0,23.5),'d2a':(24.0,36.6),'d2b':(37.2,46.6),'d2c':(51.5,56.2),'dash':(57.3,69.0),'c1':(70.3,80.5)},
     'nat':{'d1':(0.0,14.9),'t1':(15.5,21.7),'d2a':(25.8,35.2),'d2b':(38.3,46.3),'d2c':(52.7,57.0),'dash':(61.0,69.6),'c1':(73.0,80.8)}}
PICKS={'d1':'huey','t1':'nat','d2a':'nat','d2b':'nat','d2c':'nat','dash':'nat','c1':'huey'}
if len(sys.argv)>1: PICKS.update(json.load(open(sys.argv[1])))
GAP=0.30; KEEP=0.10; TAIL=0.25; MAXSPEED=2.4; PIP=320
def run(*a): subprocess.run([F,'-hide_banner','-loglevel','error','-y',*a],check=True)
def silences(path):
    r=subprocess.run([F,'-hide_banner','-i',path,'-af','silencedetect=noise=-35dB:d=0.25','-vn','-f','null','-'],capture_output=True,text=True).stderr
    st=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',r)]; en=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',r)]
    return list(zip(st,en))
SIL={k:silences(v) for k,v in SRC.items()}
def keeps(who,a,b):
    pieces=[]; cur=a
    for s,e in SIL[who]:
        if e<=a or s>=b: continue
        s=max(s,a); e=min(e,b)
        if e-s>GAP:
            pieces.append((cur,s+KEEP)); cur=e-KEEP
    pieces.append((cur,b))
    for cs,ce in CUTS.get(who,{}).get(SECNOW,[]):
        nxt=[]
        for x,y in pieces:
            if ce<=x or cs>=y: nxt.append((x,y)); continue
            if cs-x>0.03: nxt.append((x,cs))
            if y-ce>0.03: nxt.append((ce,y))
        pieces=nxt
    return [(x,y) for x,y in pieces if y-x>0.05]
sys.path.insert(0,'.')
import place
report=[]; names=[]
for sec,(v0,v1) in SCENE.items():
    SECNOW=sec; who=PICKS[sec]; a,b=RNG[who][sec]; ks=keeps(who,a,b); Dn=sum(y-x for x,y in ks)
    frames=place.frames_from_video(DEMO,v0,v1)
    spot=None
    for size in (320,260,210):
        cand=place.best_spot(frames,pip=size)
        if cand['busy']<=0.03: spot=dict(cand,size=size,mode='pip'); break
    if spot is None:
        spot={'mode':'side','size':360,'x':1500,'y':650,'busy':place.best_spot(frames,pip=210)['busy'],'canvas':place.edge_color(DEMO,v0)}
    vis=v1-v0; T=Dn+TAIL; f=max(1.0,min(MAXSPEED,vis/T))
    # if the picture would still be longer than the speech at max speed, drop its tail; if shorter, hold the last frame
    vis_used=min(vis,T*f); hold=max(0.0,T-vis_used/f)
    fc=[]; n=len(ks)
    for i,(x,y) in enumerate(ks):
        fc.append(f"[0:v]trim=start={x:.3f}:end={y:.3f},setpts=PTS-STARTPTS,crop=720:720:280:0,scale=480:480,fps=30[fv{i}]")
        fc.append(f"[0:a]atrim=start={x:.3f}:end={y:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st={max(0,y-x-0.006):.3f}:d=0.006[fa{i}]")
    fc.append(''.join(f"[fv{i}][fa{i}]" for i in range(n))+f"concat=n={n}:v=1:a=1[fvc][fac]")
    fc.append(f"[fvc]format=rgba,tpad=stop_mode=clone:stop_duration={TAIL+0.5:.2f}[fvr]")
    SZ=spot['size']
    fc.append(f"[2:v]scale={SZ}:{SZ}[mk];[3:v]scale={SZ}:{SZ}[rg]")
    fc.append(f"[fvr]scale={SZ}:{SZ}[fvs];[fvs][mk]alphamerge[fm];[fm][rg]overlay=0:0:format=auto[face]")
    if spot['mode']=='pip':
        fc.append(f"[1:v]trim=start={v0:.3f}:end={v0+vis_used:.3f},setpts=(PTS-STARTPTS)/{f:.4f},fps=30,scale=1920:1080,tpad=stop_mode=clone:stop_duration={hold+0.2:.2f}[bg]")
    else:
        fc.append(f"[1:v]trim=start={v0:.3f}:end={v0+vis_used:.3f},setpts=(PTS-STARTPTS)/{f:.4f},fps=30,scale=1440:810,tpad=stop_mode=clone:stop_duration={hold+0.2:.2f}[bgs]")
        fc.append(f"color=c={spot['canvas']}:s=1920x1080:r=30,format=yuv420p[cv];[cv][bgs]overlay=0:0:shortest=1[bg]")
    fc.append(f"[bg][face]overlay={spot['x']}:{spot['y']}:shortest=0:eof_action=pass[v]")
    fc.append(f"[fac]volume={GAIN[who]}dB,alimiter=limit=0.89,apad=whole_dur={T:.3f},aformat=channel_layouts=stereo,aresample=48000[a]")
    out=f'{SECDIR}/{sec}.mp4'
    run('-i',SRC[who],'-i',DEMO,'-loop','1','-framerate','30','-i','mask.png','-loop','1','-framerate','30','-i','ring.png','-filter_complex',';'.join(fc),'-map','[v]','-map','[a]','-t',f'{T:.3f}','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k',out)
    names.append(out); report.append((sec,who,round(Dn,1),round(vis,1),round(f,2),round(hold,2),spot,len(ks)))
    print(f"{sec:5} {who:5} speech {Dn:5.1f}s  scene {vis:5.1f}s  speed {f:4.2f}x  {spot['mode']} {spot['size']}px @({spot['x']},{spot['y']}) busy {spot['busy']}  cuts {len(ks)-1}")
open('list.txt','w').write('\n'.join(f"file '{os.path.abspath(n)}'" for n in names))
run('-f','concat','-safe','0','-i','list.txt','-c','copy','-movflags','+faststart',f'{OUT}/{OUTNAME}.mp4')
print('total',sum(r[2]+TAIL for r in report))
