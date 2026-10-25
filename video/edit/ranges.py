# Recomputes each section's cut range from where the speech really starts and ends (energy-based), so no word is clipped.
import json,re,subprocess
F='../node_modules/ffmpeg-static/ffmpeg'; D='/Users/hueylee/Documents/Demo'
SRC={'huey':f'{D}/Huey record.mp4','nat':f'{D}/Natanael record.mp4'}
OLD={'huey':{'d1':(0.6,14.5),'t1':(15.0,23.5),'d2a':(24.0,36.6),'d2b':(37.2,46.6),'d2c':(51.5,56.2),'dash':(57.3,69.0),'c1':(70.3,80.5)},
     'nat':{'d1':(0.0,14.9),'t1':(15.5,21.7),'d2a':(25.8,35.2),'d2b':(38.3,46.3),'d2c':(52.7,57.0),'dash':(61.0,69.6),'c1':(73.0,80.8)}}
order=list(OLD['huey'])
def sil(p):
    r=subprocess.run([F,'-hide_banner','-i',p,'-af','silencedetect=noise=-38dB:d=0.12','-vn','-f','null','-'],capture_output=True,text=True).stderr
    st=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',r)]; en=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',r)]
    return st,en
new={}; 
for who in OLD:
    words=[x for s in json.load(open(who+'.json')) for x in s['words']]
    st,en=sil(SRC[who]); new[who]={}
    for i,sec in enumerate(order):
        a0,b0=OLD[who][sec]; ws=[w for w in words if a0<=w['s']<=b0]
        fw,lw=ws[0],ws[-1]
        # end: the first silence that begins after the last word's start+0.15 (words can end later than reported)
        ends=[s for s in st if s>=lw['s']+0.15]
        b=(ends[0] if ends else lw['e'])+0.10
        nxt=[w for w in words if w['s']>b0]
        if nxt: b=min(b,nxt[0]['s']-0.03)
        # start: just before the first word, but not earlier than the end of the previous speech
        a=fw['s']-0.12
        new[who][sec]=(round(max(0,a),2),round(b,2))
        print(f"{who:5} {sec:5} end {b0:6.2f} -> {b:6.2f}  ({'+' if b>b0 else ''}{b-b0:.2f})   start {a0:6.2f} -> {max(0,a):6.2f}")
json.dump(new,open('ranges_fixed.json','w'))
