import sys, os, re, glob, shutil
import xml.etree.ElementTree as ET
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
W,H=12192000,6858000
K=1920/W  # px per EMU at 1920 wide
root=sys.argv[1]; out=sys.argv[2]
os.makedirs(out,exist_ok=True)
shutil.copytree(os.path.join(root,'ppt/media'),os.path.join(out,'media'),dirs_exist_ok=True)
def px(v): return round(int(v)*K,2)
def color(el):
    if el is None: return None
    c=el.find('a:solidFill/a:srgbClr',ns)
    return '#'+c.get('val') if c is not None else None
files=sorted(glob.glob(os.path.join(root,'ppt/slides/slide*.xml')),key=lambda f:int(re.findall(r'\d+',os.path.basename(f))[0]))
for f in files:
    n=int(re.findall(r'\d+',os.path.basename(f))[0])
    rels=ET.parse(os.path.join(root,'ppt/slides/_rels',os.path.basename(f)+'.rels')).getroot()
    rid={r.get('Id'):r.get('Target') for r in rels}
    t=ET.parse(f).getroot()
    bg=color(t.find('p:cSld/p:bg/p:bgPr',ns)) or '#ffffff'
    items=[]
    for el in t.find('p:cSld/p:spTree',ns):
        tag=el.tag.split('}')[1]
        if tag not in('pic','sp','cxnSp'): continue
        xf=el.find('p:spPr/a:xfrm',ns)
        if xf is None: continue
        off=xf.find('a:off',ns); ext=xf.find('a:ext',ns)
        rot=int(xf.get('rot','0'))/60000
        st=f"left:{px(off.get('x'))}px;top:{px(off.get('y'))}px;width:{px(ext.get('cx'))}px;height:{px(ext.get('cy'))}px;"
        if rot: st+=f"transform:rotate({rot}deg);"
        if tag=='pic':
            target=rid[el.find('p:blipFill/a:blip',ns).get(R+'embed')].replace('../','')
            items.append(f'<img src="{target.replace("media/","media/")}" style="position:absolute;{st}">')
            continue
        sp=el.find('p:spPr',ns)
        fill=color(sp)
        ln=sp.find('a:ln',ns)
        border=''
        if ln is not None and ln.find('a:solidFill',ns) is not None:
            w=max(1,px(ln.get('w','12700')))
            dash=ln.find('a:prstDash',ns)
            style='dashed' if dash is not None else 'solid'
            border=f"border:{w}px {style} {color(ln)};"
        geom=sp.find('a:prstGeom',ns).get('prst')
        if geom=='line':
            lw=max(2,px(ln.get('w','12700'))) if ln is not None else 3
            col=color(ln) or '#000'
            fh=xf.get('flipH')=='1'; fv=xf.get('flipV')=='1'
            x1,x2=(100,0) if fh else (0,100); y1,y2=(100,0) if fv else (0,100)
            items.append(f'<svg style="position:absolute;{st}overflow:visible" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="{lw}" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>'); continue
        body=el.find('p:txBody',ns)
        inner=''; anchor='center'
        if body is not None:
            bp=body.find('a:bodyPr',ns); a=bp.get('anchor','t')
            anchor={'ctr':'center','t':'flex-start','b':'flex-end'}.get(a,'flex-start')
            ins=[px(bp.get(k,'91440')) if k in bp.attrib else 0 for k in('lIns','tIns','rIns','bIns')]
            paras=[]
            for p in body.findall('a:p',ns):
                al=(p.find('a:pPr',ns).get('algn') if p.find('a:pPr',ns) is not None else None) or 'l'
                al={'l':'left','ctr':'center','r':'right','just':'justify'}[al]
                runs=''
                for r in p.findall('a:r',ns):
                    rp=r.find('a:rPr',ns); tx=(r.find('a:t',ns).text or '')
                    fs=int(rp.get('sz','1800'))/100*12700*K
                    css=f"font-size:{fs:.1f}px;"
                    if rp.get('b')=='1': css+='font-weight:700;'
                    if rp.get('i')=='1': css+='font-style:italic;'
                    c=color(rp)
                    if c: css+=f'color:{c};'
                    lat=rp.find('a:latin',ns)
                    if lat is not None: css+=f"font-family:'{lat.get('typeface')}',cursive,sans-serif;"
                    rln=rp.find('a:ln',ns)
                    if rln is not None and rln.find('a:solidFill',ns) is not None:
                        css+=f"-webkit-text-stroke:{max(1,px(rln.get('w','12700'))):.1f}px {color(rln)};paint-order:stroke fill;"
                    runs+=f'<span style="{css}">{tx.replace("&","&amp;").replace("<","&lt;")}</span>'
                paras.append(f'<div style="text-align:{al};line-height:1.05;margin:0">{runs or "&nbsp;"}</div>')
            inner=f'<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:{anchor};padding:{ins[1]}px {ins[2]}px {ins[3]}px {ins[0]}px;box-sizing:border-box">{"".join(paras)}</div>'
        items.append(f'<div style="position:absolute;{st}{"background:"+fill+";" if fill else ""}{border}box-sizing:border-box">{inner}</div>')
    html=f'<!doctype html><meta charset="utf-8"><body style="margin:0;width:1920px;height:1080px;overflow:hidden;position:relative;background:{bg}">{"".join(items)}</body>'
    open(os.path.join(out,f'slide{n}.html'),'w').write(html)
print('ok',len(files))
