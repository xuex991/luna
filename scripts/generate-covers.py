#!/usr/bin/env python3
"""Generate blog cover illustrations for LUNA posts via qwen-image-3.0."""
import json, os, time, re, urllib.request, urllib.error, sys

BASE = os.environ['DASHSCOPE_BASE_URL']
KEY = os.environ['DASHSCOPE_API_KEY']
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'covers')
os.makedirs(OUT, exist_ok=True)

STYLE = ("Minimal editorial flat illustration, warm off-white (#f5f1ea) background, "
         "charcoal (#1a1a1a) and muted orange (#d97757) palette only, clean geometric shapes, "
         "generous negative space, sophisticated and calm, flat design, no text, no letters, no numbers.")

PROMPTS = {
    'dsh-deepseek-harness-64-days-12k-commits': "an abstract ascending line chart made of small charcoal dots connected by thin muted-orange lines, subtle grid dots, a tiny clock motif and a small stack of layered squares.",
    'composio-growth-deep-dive': "a growth curve sweeping upward with a small funnel shape beside it, tiny star markers on the curve, minimal geometric composition.",
    'agent-harness-product-map-big-tech': "a large square divided into four empty quadrants, each quadrant holding one simple icon-like shape: a chat bubble, two angle brackets, a workflow node, a layered platform stack.",
    'channel-priority-table': "three horizontal rounded bars of different widths aligned left, like channel priority tiers, one small up arrow beside the widest bar.",
    'indie-dev-growth-and-conversion-capability-map': "a funnel with three stacked bands, a small arrow passing through the funnel, tiny user-dot above the funnel.",
    'leading-ai-products-market-yc-reddit-map': "a scattered constellation of small dots connected by thin lines with three slightly larger highlighted dots, like a market map.",
    'one-to-one-vs-one-to-many-capability-map': "left side one small circle connected by one line to another circle, right side one circle connected by many lines to a fan of small circles, minimal.",
    'prompt-driven-pixel-level-frontend-workflow': "a small grid of tiny squares where a few are filled, like a pixel grid being constructed, one small spark shape in the corner.",
    'why-ai-outsourcing-should-charge-for-growth-not-modules': "a balance scale with a small clock on one side and a stack of coin-like discs on the other, minimal geometric.",
}

def gen(slug, prompt):
    body = json.dumps({
        "model": "qwen-image-3.0",
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        "n": 1,
    }).encode()
    req = urllib.request.Request(BASE + '/chat/completions', data=body,
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                d = json.load(r)
            s = json.dumps(d['output']['choices'][0]['message']['content'])
            m = re.search(r'https://[^"\\\s\)]+', s)
            if not m:
                print(f'[{slug}] 无图片 URL', flush=True); return False
            img_url = m.group(0).rstrip('"')
            urllib.request.urlretrieve(img_url, os.path.join(OUT, slug + '.png'))
            print(f'[{slug}] OK -> {len(os.listdir(OUT))} files', flush=True)
            return True
        except Exception as e:
            print(f'[{slug}] 第{attempt+1}次失败: {e}', flush=True)
            time.sleep(5)
    return False

if __name__ == '__main__':
    ok = fail = 0
    for slug, motif in PROMPTS.items():
        path = os.path.join(OUT, slug + '.png')
        if os.path.exists(path) and os.path.getsize(path) > 10000:
            print(f'[{slug}] 已存在,跳过', flush=True); ok += 1; continue
        if gen(slug, STYLE + ' ' + motif):
            ok += 1
        else:
            fail += 1
    print(f'完成: {ok} 成功, {fail} 失败', flush=True)
