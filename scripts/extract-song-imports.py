"""Extract only selected chart/audio files outside the repository; reject mismatches."""
import hashlib, json, sys, zipfile
from pathlib import Path
manifest=json.loads(Path('scripts/song-imports.json').read_text(encoding='utf-8'))
downloads=Path(sys.argv[1]).resolve()
output=[]
for song in manifest:
    archive=downloads/song['archive']
    folder=downloads/'BeatSync-imports'/song['setId']
    folder.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        candidates={}
        for name in z.namelist():
            if not name.endswith('.osu'): continue
            raw=z.read(name)
            lines=raw.decode('utf-8-sig').splitlines()
            fields=dict(line.split(':',1) for line in lines if ':' in line)
            fields={k.strip():v.strip() for k,v in fields.items()}
            candidates.setdefault(fields.get('BeatmapID'),[]).append((name,raw,fields))
        for selection in song['charts']:
            matches=candidates.get(selection['beatmapId'],[])
            if len(matches)!=1: raise ValueError('Unmatched or ambiguous chart: '+selection['beatmapId'])
            name,raw,fields=matches[0]
            assert fields['Mode']=='3' and fields['CircleSize']=='4'
            assert fields['BeatmapSetID']==song['setId'] and fields['Version']==selection['version']
            audio=fields['AudioFilename']
            if Path(audio).name!=audio: raise ValueError('AudioFilename must be a simple file name')
            chart_path=folder/Path(name).name
            audio_path=folder/audio
            for target,data in [(chart_path,raw),(audio_path,z.read(audio))]:
                if not target.resolve().is_relative_to(folder.resolve()): raise ValueError('Unsafe archive path')
                if target.exists() and target.read_bytes()!=data: raise ValueError('Existing extracted file differs: '+str(target))
                if not target.exists(): target.write_bytes(data)
            output.append({'songId':song['id'],'beatmapId':selection['beatmapId'],'chartPath':str(chart_path),'audioPath':str(audio_path),'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest()})
print(json.dumps(output))
