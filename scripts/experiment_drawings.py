# Generates themes/basic/layouts/partials/experiment-drawing.html: simplified, original drawings
# of the four experiments, each showing a hint of the physics studied there (no part labels).
# Colours come from CSS classes so the drawings follow the light/dark theme.
#   python3 scripts/experiment_drawings.py
import math, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'themes/basic/layouts/partials/experiment-drawing.html')

def f(x): return f"{x:.1f}".rstrip('0').rstrip('.')
def pts(cx, cy, r, n, rot=0):
    return [(cx + r*math.cos(rot + 2*math.pi*k/n), cy + r*math.sin(rot + 2*math.pi*k/n)) for k in range(n)]
def poly(cx, cy, r, n, rot=0): return " ".join(f"{f(x)},{f(y)}" for x, y in pts(cx, cy, r, n, rot))
def ring_poly(cx, cy, r1, r2, n, rot, cls):
    a, b = pts(cx, cy, r2, n, rot), pts(cx, cy, r1, n, rot)
    d = "M" + " L".join(f"{f(x)},{f(y)}" for x, y in a) + " Z M" + " L".join(f"{f(x)},{f(y)}" for x, y in b) + " Z"
    return f'<path class="{cls}" fill-rule="evenodd" d="{d}"/>'
def ring(cx, cy, r1, r2, cls):
    return (f'<path class="{cls}" fill-rule="evenodd" d="M{f(cx-r2)},{cy} a{r2},{r2} 0 1,0 {2*r2},0 a{r2},{r2} 0 1,0 {-2*r2},0 Z '
            f'M{f(cx-r1)},{cy} a{r1},{r1} 0 1,0 {2*r1},0 a{r1},{r1} 0 1,0 {-2*r1},0 Z"/>')
def P(cx, cy, ang, r): a = math.radians(ang); return cx + r*math.cos(a), cy + r*math.sin(a)
def track(cx, cy, ang, length, curve, cls="d-track"):
    ex, ey = P(cx, cy, ang, length); a = math.radians(ang)
    mx, my = cx + length/2*math.cos(a) - curve*math.sin(a), cy + length/2*math.sin(a) + curve*math.cos(a)
    return f'<path class="{cls}" pathLength="1" d="M{f(cx)},{f(cy)} Q{f(mx)},{f(my)} {f(ex)},{f(ey)}"/>'
def jet(cx, cy, ang, length, width=11, n=4):
    a1, a2 = P(cx, cy, ang - width, length), P(cx, cy, ang + width, length)
    s = [f'<path class="d-jet" d="M{f(cx)},{f(cy)} L{f(a1[0])},{f(a1[1])} A{length},{length} 0 0,1 {f(a2[0])},{f(a2[1])} Z"/>']
    for k in range(n):
        da = -width*0.7 + k*(1.4*width/(n-1))
        s.append(track(cx, cy, ang + da, length*(0.85 + 0.1*(k % 2)), (k - n/2)*1.5, "d-jet-track"))
    return "".join(s)
def deposit(cx, cy, ang, r, size, cls):
    x, y = P(cx, cy, ang, r)
    return f'<rect class="{cls}" x="{f(x-size/2)}" y="{f(y-size/2)}" width="{size}" height="{size}" rx="1.5" transform="rotate({ang} {f(x)} {f(y)})"/>'
def formula(x, y, text, anchor="start"):
    return f'<text class="d-formula" x="{x}" y="{y}" text-anchor="{anchor}">{text}</text>'

def cms():
    cx, cy = 150, 150; s = []; rot = math.pi/12
    for r1, r2 in ((116, 140), (98, 110), (82, 92)): s.append(ring_poly(cx, cy, r1, r2, 12, rot, "d-iron"))
    for r in (95, 113, 128, 143): s.append(f'<polygon class="d-muon" points="{poly(cx, cy, r, 12, rot)}"/>')
    s.append(ring(cx, cy, 72, 78, "d-magnet")); s.append(ring(cx, cy, 50, 70, "d-hcal")); s.append(ring(cx, cy, 38, 48, "d-ecal"))
    for r in range(8, 36, 5): s.append(f'<circle class="d-tracker" cx="{cx}" cy="{cy}" r="{r}"/>')
    # four top quarks: sprays of particles (jets) with energy in the calorimeters, a muon and an electron
    for ang in (-150, -70, 20, 75, 140, 200):
        s.append(jet(cx, cy, ang, 66, 10, 4))
        s.append(deposit(cx, cy, ang, 60, 9, "d-dep-h")); s.append(deposit(cx, cy, ang, 43, 7, "d-dep-e"))
    s.append(track(cx, cy, -25, 150, 18, "d-lepton"))
    s.append(track(cx, cy, 105, 44, -6, "d-lepton")); s.append(deposit(cx, cy, 107, 43, 8, "d-dep-e"))
    s.append(f'<circle class="d-point" cx="{cx}" cy="{cy}" r="3"/>')
    s.append(formula(300, 140, "pp → t<tspan class=\"d-bar\">t</tspan>t<tspan class=\"d-bar\">t</tspan>"))
    s.append(formula(300, 168, "t → bW", ) .replace('d-formula', 'd-formula d-formula-small'))
    return '<svg class="drawing" viewBox="0 0 420 300" role="img" aria-label="CMS">' + "".join(s) + "</svg>"

def atlas():
    cx, cy = 150, 150; s = []
    for k in range(8):
        a = math.radians(22.5 + 45*k); x, y = cx + 108*math.cos(a), cy + 108*math.sin(a)
        s.append(f'<rect class="d-magnet" x="{f(x-21)}" y="{f(y-7)}" width="42" height="14" rx="7" transform="rotate({f(math.degrees(a))} {f(x)} {f(y)})"/>')
    for r in (84, 112, 140): s.append(f'<polygon class="d-muon" points="{poly(cx, cy, r, 8, 0)}"/>')
    s.append(ring(cx, cy, 50, 76, "d-hcal"))
    for k in range(32):
        x1, y1 = P(cx, cy, k*360/32, 50); x2, y2 = P(cx, cy, k*360/32, 76)
        s.append(f'<path class="d-cut" d="M{f(x1)},{f(y1)} L{f(x2)},{f(y2)}"/>')
    s.append(ring(cx, cy, 36, 48, "d-ecal")); s.append(ring(cx, cy, 32, 34, "d-magnet"))
    for r in range(8, 31, 5): s.append(f'<circle class="d-tracker" cx="{cx}" cy="{cy}" r="{r}"/>')
    # W_R -> l N -> l l j j : two muons crossing the whole detector and two jets
    s.append(track(cx, cy, -40, 150, 10, "d-lepton")); s.append(track(cx, cy, 150, 150, -12, "d-lepton"))
    for ang in (45, 95):
        s.append(jet(cx, cy, ang, 72, 11, 4)); s.append(deposit(cx, cy, ang, 64, 10, "d-dep-h"))
    s.append(f'<circle class="d-point" cx="{cx}" cy="{cy}" r="3"/>')
    s.append(formula(300, 140, "W<tspan class=\"d-sub\" dy=\"4\">R</tspan><tspan dy=\"-4\"> → ℓN</tspan>"))
    s.append(formula(300, 168, "N → ℓjj").replace('d-formula', 'd-formula d-formula-small'))
    return '<svg class="drawing" viewBox="0 0 420 300" role="img" aria-label="ATLAS">' + "".join(s) + "</svg>"

def snd():
    cx, cy = 150, 150; s = []
    s.append(ring(cx, cy, 108, 116, "d-muon-band")); s.append(ring(cx, cy, 92, 104, "d-iron"))
    for r1, r2 in ((30, 50), (52, 70), (72, 88)): s.append(ring(cx, cy, r1, r2, "d-ecal"))
    for k in range(40):
        x1, y1 = P(cx, cy, k*9, 30); x2, y2 = P(cx, cy, k*9, 88)
        s.append(f'<path class="d-cut" d="M{f(x1)},{f(y1)} L{f(x2)},{f(y2)}"/>')
    for r in (12, 18, 24): s.append(f'<circle class="d-tracker" cx="{cx}" cy="{cy}" r="{r}"/>')
    s.append(f'<path class="d-cover" d="M{cx-118},{cy-4} L{cx+118},{cy-4} L{cx+118},{cy+4} L{cx-118},{cy+4} Z"/>')
    s.append(f'<path class="d-beam" d="M12,{cy} L288,{cy}"/>')
    s.append(f'<text class="d-small" x="14" y="{cy-9}">e⁻</text><text class="d-small" x="286" y="{cy-9}" text-anchor="end">e⁺</text>')
    # e+e- -> n nbar: the neutron leaves almost no trace, the antineutron annihilates in the crystals (a star)
    nx, ny = P(cx, cy, 128, 96)
    s.append(f'<path class="d-neutral" d="M{cx},{cy} L{f(nx)},{f(ny)}"/>')
    ax, ay = P(cx, cy, -52, 62)
    s.append(f'<path class="d-neutral" d="M{cx},{cy} L{f(ax)},{f(ay)}"/>')
    for k, (da, ln) in enumerate(((-80, 30), (-20, 24), (30, 28), (95, 18), (160, 22), (215, 26), (265, 20))):
        x2, y2 = P(ax, ay, -52 + da, ln)
        s.append(f'<path class="d-star" pathLength="1" style="--d:{k}" d="M{f(ax)},{f(ay)} L{f(x2)},{f(y2)}"/>')
    s.append(f'<circle class="d-burst" cx="{f(ax)}" cy="{f(ay)}" r="5"/>')
    s.append(f'<text class="d-small d-tag" x="{f(nx-6)}" y="{f(ny+14)}" text-anchor="end">n</text>')
    s.append(f'<text class="d-small d-tag" x="{f(ax+12)}" y="{f(ay-12)}"><tspan class="d-bar">n</tspan></text>')
    s.append(f'<circle class="d-point" cx="{cx}" cy="{cy}" r="3"/>')
    s.append(formula(300, 150, "e⁺e⁻ → n<tspan class=\"d-bar\">n</tspan>"))
    return '<svg class="drawing" viewBox="0 0 420 300" role="img" aria-label="SND">' + "".join(s) + "</svg>"

def ship():
    s = []; y = 95
    s.append(f'<path class="d-beam" d="M6,{y} L48,{y}"/><path class="d-arrow" d="M42,{y-5} L50,{y} L42,{y+5}"/>')
    s.append(f'<text class="d-small" x="8" y="{y-10}">p</text>')
    s.append(f'<rect class="d-target" x="52" y="{y-12}" width="14" height="24" rx="2"/>')
    s.append(f'<rect class="d-iron" x="70" y="{y-26}" width="26" height="52" rx="2"/>')
    for i, h in enumerate((44, 52, 60, 66, 60, 52)):
        s.append(f'<rect class="d-magnet" x="{100+i*16}" y="{f(y-h/2)}" width="13" height="{h}" rx="2"/>')
    s.append(f'<rect class="d-snd" x="200" y="{y-22}" width="34" height="44" rx="2"/>')
    for i in range(6): s.append(f'<path class="d-cut" d="M{204+i*5},{y-22} L{204+i*5},{y+22}"/>')
    s.append(f'<path class="d-veto" d="M242,{y-30} L242,{y+30}"/>')
    s.append(f'<path class="d-vessel" d="M248,{y-26} L420,{y-44} L420,{y+44} L248,{y+26} Z"/>')
    for i in range(4): s.append(f'<path class="d-tracker-line" d="M{428+i*9},{y-46} L{428+i*9},{y+46}"/>')
    s.append(f'<rect class="d-magnet" x="442" y="{y-48}" width="10" height="96" rx="2"/>')
    s.append(f'<rect class="d-ecal" x="472" y="{y-48}" width="16" height="96" rx="2"/>')
    s.append(f'<rect class="d-muon-band" x="494" y="{y-48}" width="12" height="96" rx="2"/>')
    # neutrinos interacting in the neutrino detector
    s.append(f'<path class="d-neutral" d="M66,{y+6} L214,{y+8}"/>')
    s.append(f'<path class="d-lepton" pathLength="1" d="M214,{y+8} L236,{y+16}"/><path class="d-jet-track" pathLength="1" d="M214,{y+8} L234,{y+2}"/><path class="d-jet-track" pathLength="1" d="M214,{y+8} L233,{y+11}"/>')
    s.append(f'<text class="d-small d-tag" x="150" y="{y+24}">ν</text>')
    # a hidden particle flies through everything unseen and decays in the decay volume
    s.append(f'<path class="d-hidden" d="M66,{y-4} L330,{y-2}"/>')
    s.append(f'<path class="d-lepton" pathLength="1" d="M330,{y-2} Q 400,{y-14} 500,{y-36}"/><path class="d-track" pathLength="1" d="M330,{y-2} Q 400,{y+10} 480,{y+30}"/>')
    s.append(f'<circle class="d-burst" cx="330" cy="{y-2}" r="4"/>')
    s.append(f'<text class="d-small d-tag" x="290" y="{y-10}">?</text>')
    s.append(formula(260, 196, "HNL → μπ", "middle"))
    return '<svg class="drawing drawing-wide" viewBox="0 0 520 210" role="img" aria-label="SHiP">' + "".join(s) + "</svg>"

with open(OUT, "w") as fh:
    fh.write('{{- /* Simplified drawings of the experiments (original, not to scale), each with a hint of the\n'
             '       physics studied there; generated by scripts/experiment_drawings.py. Keys: cms, atlas, snd, ship. */ -}}\n')
    for i, (k, fn) in enumerate((("cms", cms), ("atlas", atlas), ("snd", snd), ("ship", ship))):
        fh.write(('{{- if' if i == 0 else '{{- else if') + f' eq . "{k}" }}}}\n' + fn() + "\n")
    fh.write("{{- end }}\n")
print("ok")
