import json, struct, sys
def glb_json(p):
    b = open(p, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    return json.loads(b[20:20 + n])
if __name__ == '__main__':
    j = glb_json(sys.argv[1])
    for m in j.get('materials', []):
        print('MAT', json.dumps(m)[:400])
    print('ext', j.get('extensionsUsed'), j.get('extensionsRequired'))
    print('images', [(i.get('name'), i.get('mimeType')) for i in j.get('images', [])])
    print('nodes', [(n.get('name'), n.get('extras')) for n in j.get('nodes', [])])
