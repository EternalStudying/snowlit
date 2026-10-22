"""Album edit smoke: task-owned MySQL/Redis/MinIO and backend, always removed on exit.
Run from the repository root after `cd backend && mvn -q -DskipTests package`.
Only Python standard library and the existing Docker/Java installations are used.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PREFIX = 'snowlit-album-edit-' + uuid.uuid4().hex[:8]
MYSQL, REDIS, MINIO = [PREFIX + '-' + name for name in ('mysql', 'redis', 'minio')]
NETWORK = PREFIX + '-net'
checks = []
responses = []
created = []
app = None
network_created = False
password = secrets.token_urlsafe(24)
minio_key = 'album-smoke'
minio_password = secrets.token_urlsafe(24)


def command(args, **kwargs):
    result = subprocess.run(args, capture_output=True, **kwargs)
    if result.returncode:
        raise RuntimeError(result.stderr.decode().strip())
    return result.stdout.decode().strip()


def docker(*args, **kwargs):
    return command(['docker', *args], **kwargs)


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})
    print(('PASS ' if condition else 'FAIL ') + name, flush=True)
    assert condition, name


def sql(query):
    return docker('exec', '-e', 'MYSQL_PWD=' + password, MYSQL, 'mysql', '-uroot', '-N', '-e', query, 'album_smoke')


def call(method, path, token=None, body=None, upload=False):
    headers = {'Authorization': 'Bearer ' + token} if token else {}
    data = None
    if upload:
        boundary = uuid.uuid4().hex
        # Valid synthetic 1x1 PNG, no EXIF or personal data.
        import base64
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
        metadata = json.dumps({'width': 1, 'height': 1, 'caption': 'Fixture'})
        data = (f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n{metadata}\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n').encode() + png + f'\r\n--{boundary}--\r\n'.encode()
        headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary
    elif body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        response = urllib.request.urlopen(request, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read()
        responses.append(raw)
        return response.status, json.loads(raw) if raw else None


def mc(args):
    env = {'MC_HOST_smoke': f'http://{minio_key}:{minio_password}@{MINIO}:9000'}
    return command(['docker', 'run', '--rm', '--network', NETWORK, '-e', 'MC_HOST_smoke', 'minio/mc:latest', *args], env={**os.environ, **env})


try:
    docker('network', 'create', NETWORK)
    network_created = True
    db_port, redis_port, minio_port, app_port = [port() for _ in range(4)]
    BASE = f'http://127.0.0.1:{app_port}'
    for name, image, arguments, env, mapping in [
        (MYSQL, 'mysql:8.4', [], {'MYSQL_ROOT_PASSWORD': password, 'MYSQL_DATABASE': 'album_smoke'}, f'{db_port}:3306'),
        (REDIS, 'redis:7.4', [], {}, f'{redis_port}:6379'),
        (MINIO, 'minio/minio:RELEASE.2025-07-23T15-54-02Z', ['server', '/data'], {'MINIO_ROOT_USER': minio_key, 'MINIO_ROOT_PASSWORD': minio_password}, f'{minio_port}:9000')]:
        args = ['run', '-d', '--name', name, '--network', NETWORK, '-p', '127.0.0.1:' + mapping]
        for key, value in env.items():
            args += ['-e', key + '=' + value]
        docker(*args, image, *arguments)
        created.append(name)
    deadline = time.monotonic() + 90
    while True:
        try:
            sql('select 1')
            break
        except RuntimeError:
            if time.monotonic() >= deadline:
                raise
            time.sleep(1)
    mc(['mb', 'smoke/album-smoke'])
    # Explicit prod properties bypass dev's optional retained local.properties import.
    env = {**os.environ, 'DB_URL': f'jdbc:mysql://127.0.0.1:{db_port}/album_smoke?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC',
           'DB_USERNAME': 'root', 'DB_PASSWORD': password, 'REDIS_HOST': '127.0.0.1', 'REDIS_PORT': str(redis_port), 'REDIS_PASSWORD': '',
           'MINIO_ENDPOINT': f'http://127.0.0.1:{minio_port}', 'MINIO_SECRET_KEY': minio_password,
           'MINIO_BUCKET': 'album-smoke', 'MINIO_PUBLIC_BASE_URL': f'http://127.0.0.1:{minio_port}/album-smoke',
           'SQL_INIT_MODE': 'always', 'GEOAPIFY_KEY': '', 'WECHAT_MINIPROGRAM_APP_ID': '', 'WECHAT_MINIPROGRAM_APP_SECRET': ''}
    log = (HERE / 'smoke-backend.log').open('w')
    app = subprocess.Popen(['java', '-jar', str(ROOT / 'backend/target/snowlit-0.0.1-SNAPSHOT.jar'), '--spring.profiles.active=prod',
                            '--server.port=' + str(app_port), '--minio.access-key=' + minio_key], env=env, stdout=log, stderr=subprocess.STDOUT)
    deadline = time.monotonic() + 90
    while True:
        try:
            if call('GET', '/api/story/moments')[0] == 200:
                break
        except (OSError, urllib.error.URLError):
            pass
        if app.poll() is not None or time.monotonic() > deadline:
            raise RuntimeError('Throwaway backend did not start; inspect smoke-backend.log')
        time.sleep(1)
    tokens = []
    for name in ('demo_a', 'demo_b'):
        status, response = call('POST', '/api/auth/login', body={'username': name, 'password': '123456'})
        assert status == 200
        tokens.append(response['token'])
    a, b = tokens
    fields = {'title': 'Synthetic album', 'description': 'Smoke fixture', 'eventDate': '2026-05-20', 'location': '', 'visibility': 'public', 'pinned': False}
    assert call('PUT', '/api/drafts/album', a, {'fields': fields})[0] == 200
    images = [call('POST', '/api/drafts/album/images', a, upload=True)[1] for _ in range(3)]
    status, draft = call('PUT', '/api/drafts/album/images/order', a, {'ids': [images[1]['id'], 'unknown']})
    check('creation reorder retains unlisted photos', status == 200 and [i['id'] for i in draft['images']] == [images[1]['id'],images[0]['id'],images[2]['id']])
    status, detail = call('POST', '/api/drafts/album/publish', a, {'fields': fields, 'imageOrder': [images[2]['id']]})
    album_id = detail['album']['id']
    path = f'/api/albums/{album_id}'
    check('publication imageOrder decides cover', status == 200 and detail['album']['coverPhotoUrl'] == images[2]['url'])
    status, opened = call('POST', path + '/edit', b)
    check('another manager starts edit', status == 200)
    status, added = call('POST', path + '/edit/photos', b, upload=True)
    check('edit upload succeeds', status == 200)
    order = [{'photoId': opened['photos'][1]['id']}, {'draftImageId': added['id']}, {'photoId': opened['photos'][0]['id']}]
    status, saved = call('PUT', path, b, {**fields, 'title': 'Edited fixture', 'pinned': True, 'photos': order})
    check('edit save succeeds', status == 200 and saved['canManage'])
    rows = sql(f'select sort_order, preview_url from photos where album_id={album_id} order by sort_order').splitlines()
    check('database order is contiguous and matches submitted photos', rows == [f'{i+1}\t{url}' for i,url in enumerate([opened['photos'][1]['previewUrl'],added['url'],opened['photos'][0]['previewUrl']])])
    check('database cover equals first preview', sql(f'select cover_photo_url from albums where id={album_id}') == saved['photos'][0]['previewUrl'])
    check('pinned uses sort order 10', sql(f'select pinned,sort_order from albums where id={album_id}') == '1\t10')
    order = [{'photoId': p['id']} for p in saved['photos']]
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        outputs = list(pool.map(lambda pair: call('PUT',path,pair[0],{**fields,'title':pair[1],'photos':list(reversed(order)) if pair[1]=='Manager B' else order}), [(a,'Manager A'),(b,'Manager B')]))
    check('both concurrent managers save successfully', all(status == 200 for status,_ in outputs))
    status, final = call('GET',path,a)
    expected = order if final['album']['title']=='Manager A' else list(reversed(order))
    check('concurrent saves leave one consistent album', status==200 and [p['id'] for p in final['photos']]==[p['photoId'] for p in expected] and final['album']['coverPhotoUrl']==final['photos'][0]['previewUrl'] and [p['sortOrder'] for p in final['photos']]==[1,2,3])
    assert call('POST',path+'/like',a)[0]==200
    assert call('POST',path+'/view',a)[0]==200
    sql(f"insert into album_locks(album_id,user_id,failure_count,last_failed_at,updated_at) values ({album_id},1,1,now(),now())")
    names = sql(f'select original_object_name from photos where album_id={album_id} union select preview_object_name from photos where album_id={album_id}').splitlines()
    check('MinIO contains published objects', all(mc(['stat','smoke/album-smoke/'+name]) for name in names))
    status,_=call('DELETE',path,b)
    check('delete returns 204',status==204)
    check('delete cascades photos activity locks',all(sql(f'select count(*) from {table} where album_id={album_id}')=='0' for table in ('photos','album_activity','album_locks')))
    listing=mc(['ls','--recursive','--json','smoke/album-smoke'])
    check('delete removes every MinIO object including earlier removed photos',not listing.strip())
    check('second delete returns 404',call('DELETE',path,b)[0]==404)
    check('object names never appear in API responses',all(b'objectName' not in raw and b'ObjectName' not in raw for raw in responses))
finally:
    if app is not None:
        app.terminate()
        try:
            app.wait(timeout=20)
        except subprocess.TimeoutExpired:
            app.kill(); app.wait()
    for name in reversed(created):
        docker('rm','-fv',name)
    if network_created:
        docker('network','rm',NETWORK)
    (HERE/'smoke-results.json').write_text(json.dumps(checks,indent=2)+'\n')
    print(f'{sum(c["passed"] for c in checks)}/{len(checks)} checks passed; owned containers/network removed',flush=True)
