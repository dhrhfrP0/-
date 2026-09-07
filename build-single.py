#!/usr/bin/env python3
"""index.html + style.css + app.js 를 파일 하나로 묶는다.

  python3 build-single.py dist/index.html              # 어디서나 열리는 단일 HTML
  python3 build-single.py --fragment out.html          # <head>/<body>를 감싸주는 곳에 올릴 때
"""
import io, re, sys, os

def build(fragment=False):
    here = os.path.dirname(os.path.abspath(__file__))
    read = lambda n: io.open(os.path.join(here, n), encoding='utf-8').read()
    html, css, js = read('index.html'), read('style.css'), read('app.js')

    html = html.replace('<link rel="stylesheet" href="style.css">',
                        '<style>\n' + css + '\n</style>')
    html = html.replace('<script src="app.js"></script>',
                        '<script>\n' + js + '\n</script>')
    if not fragment:
        return html

    # 바깥 껍데기를 벗기고 <title>·<style>·본문·<script>만 남긴다
    title = re.search(r'<title>.*?</title>', html, re.S).group(0)
    style = re.search(r'<style>.*?</style>', html, re.S).group(0)
    body  = re.search(r'<body>(.*)</body>', html, re.S).group(1)
    return title + '\n' + style + '\n' + body.strip() + '\n'

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--fragment']
    out = args[0] if args else 'dist/index.html'
    d = os.path.dirname(out)
    if d: os.makedirs(d, exist_ok=True)
    io.open(out, 'w', encoding='utf-8').write(build('--fragment' in sys.argv))
    print(out, os.path.getsize(out), 'bytes')
