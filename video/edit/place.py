# Finds the quietest (most "whitespace") spot for the facecam in a set of background frames.
import numpy as np, subprocess, sys, json
F='../node_modules/ffmpeg-static/ffmpeg'
W,H=480,270; S=1920//W  # analysis scale
def frames_from_video(path,t0,t1,fps=2):
    cmd=[F,'-hide_banner','-loglevel','error','-ss',str(t0),'-t',str(t1-t0),'-i',path,'-vf',f'fps={fps},scale={W}:{H},format=gray','-f','rawvideo','-']
    raw=subprocess.run(cmd,capture_output=True).stdout
    n=W*H; return [np.frombuffer(raw[i:i+n],dtype=np.uint8).reshape(H,W).astype(np.float32) for i in range(0,len(raw)-n+1,n)]
def frame_from_image(path):
    cmd=[F,'-hide_banner','-loglevel','error','-i',path,'-vf',f'scale={W}:{H},format=gray','-f','rawvideo','-']
    raw=subprocess.run(cmd,capture_output=True).stdout
    return [np.frombuffer(raw,dtype=np.uint8).reshape(H,W).astype(np.float32)]
def best_spot(frames,pip=320,margin=40,step=4):
    act=np.zeros((H,W),dtype=np.float32)
    for g in frames:
        gx=np.abs(np.diff(g,axis=1,prepend=g[:,:1])); gy=np.abs(np.diff(g,axis=0,prepend=g[:1,:]))
        act=np.maximum(act,((gx+gy)>14).astype(np.float32))
    # content is also "not the dominant background colour": mark pixels far from the frame's median luminance
    for g in frames:
        act=np.maximum(act,(np.abs(g-np.median(g))>40).astype(np.float32)*0.6)
    p=pip//S+2; m=margin//S
    ii=np.pad(act,((1,0),(1,0))).cumsum(0).cumsum(1)
    best=None
    for y in range(m,H-p-m+1,2):
        for x in range(m,W-p-m+1,2):
            s=(ii[y+p,x+p]-ii[y,x+p]-ii[y+p,x]+ii[y,x])/(p*p)
            # prefer corners slightly
            d=min(x,W-p-x)+min(y,H-p-y)
            sc=s+0.0006*d
            if best is None or sc<best[0]: best=(sc,x,y,s)
    sc,x,y,s=best
    return {'x':x*S,'y':y*S,'busy':round(float(s),4)}
if __name__=='__main__':
    kind=sys.argv[1]
    if kind=='video': print(json.dumps(best_spot(frames_from_video(sys.argv[2],float(sys.argv[3]),float(sys.argv[4])))))
    else: print(json.dumps(best_spot(frame_from_image(sys.argv[2]))))

def edge_color(path,t):
    cmd=[F,'-hide_banner','-loglevel','error','-ss',str(t+0.3),'-i',path,'-frames:v','1','-vf','scale=64:36,format=rgb24','-f','rawvideo','-']
    a=np.frombuffer(subprocess.run(cmd,capture_output=True).stdout,dtype=np.uint8).reshape(36,64,3)
    border=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]])
    r,g,b=[int(np.median(border[:,i])) for i in range(3)]
    return '0x%02x%02x%02x'%(r,g,b)
