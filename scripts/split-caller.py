"""Split verified, ordered male Russian score recordings at inter-score silences."""
from pathlib import Path
import subprocess,re
out=Path('public/audio');out.mkdir(parents=True,exist_ok=True)
for base in [0,40]:
 src=f'audio-sources/{base}-{base+39}.wav'
 probe=subprocess.run(['ffmpeg','-hide_banner','-i',src,'-af','silencedetect=noise=-38dB:d=0.45','-f','null','-'],capture_output=True,text=True)
 starts=[float(v) for v in re.findall('silence_start: ([0-9.]+)',probe.stderr)]
 ends=[float(v) for v in re.findall('silence_end: ([0-9.]+)',probe.stderr)]
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',src]))
 assert len(starts)==len(ends)==39
 for i,(a,b) in enumerate(zip([0]+[max(0,v-0.07) for v in ends],[v+0.1 for v in starts]+[duration])):
  assert 0.2<b-a<3.5
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(a),'-t',str(b-a),'-i',src,'-af','loudnorm=I=-20:TP=-2:LRA=8','-codec:a','libmp3lame','-q:a','4',str(out/f'{base+i}.mp3')],check=True)
 print(f'Saved {base}–{base+39}: 40 normalized callouts')
