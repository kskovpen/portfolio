# Generates themes/basic/layouts/partials/experiment-drawing.html: simplified, original drawings
# of the four experiments. Colours come from CSS classes (themeable); labels from i18n keys.
import math, os
OUT = os.path.expanduser('~/Sites/portfolio/themes/basic/layouts/partials/experiment-drawing.html')

def f(x): return f"{x:.1f}".rstrip('0').rstrip('.')
def poly(cx, cy, r, n, rot=0):
    return " ".join(f"{f(cx + r*math.cos(rot + 2*math.pi*k/n))},{f(cy + r*math.sin(rot + 2*math.pi*k/n))}" for k in range(n))
def ring_poly(cx, cy, r1, r2, n, rot, cls):
    # a polygonal ring as one path with even-odd fill
    def pts(r): return [(cx + r*math.cos(rot + 2*math.pi*k/n), cy + r*math.sin(rot + 2*math.pi*k/n)) for k in range(n)]
    a, b = pts(r2), pts(r1)
    d = "M" + " L".join(f"{f(x)},{f(y)}" for x, y in a) + " Z M" + " L".join(f"{f(x)},{f(y)}" for x, y in b) + " Z"
    return f'<path class="{cls}" fill-rule="evenodd" d="{d}"/>'
def ring(cx, cy, r1, r2, cls):
    return f'<path class="{cls}" fill-rule="evenodd" d="M{f(cx-r2)},{cy} a{r2},{r2} 0 1,0 {2*r2},0 a{r2},{r2} 0 1,0 {-2*r2},0 Z M{f(cx-r1)},{cy} a{r1},{r1} 0 1,0 {2*r1},0 a{r1},{r1} 0 1,0 {-2*r1},0 Z"/>'
def track(cx, cy, ang, length, curve):
    a = math.radians(ang); ex, ey = cx + length*math.cos(a), cy + length*math.sin(a)
    mx, my = cx + length/2*math.cos(a) - curve*math.sin(a), cy + length/2*math.sin(a) + curve*math.cos(a)
    return f'<path class="d-track" pathLength="1" d="M{cx},{cy} Q{f(mx)},{f(my)} {f(ex)},{f(ey)}"/>'
def label(x1, y1, x2, y2, key, anchor="start"):
    tx = x2 + (6 if anchor == "start" else -6)
    return (f'<path class="d-lead" d="M{f(x1)},{f(y1)} L{f(x2)},{f(y2)}"/>'
            f'<text class="d-label" x="{f(tx)}" y="{f(y2+4)}" text-anchor="{anchor}">{{{{ T "{key}" }}}}</text>')

def cms():
    cx, cy = 150, 150; s = []
    rot = math.pi/12
    s.append(ring_poly(cx, cy, 116, 140, 12, rot, "d-iron"))
    s.append(ring_poly(cx, cy, 98, 110, 12, rot, "d-iron"))
    s.append(ring_poly(cx, cy, 82, 92, 12, rot, "d-iron"))
    for r in (95, 113, 128, 143):
        s.append(f'<polygon class="d-muon" points="{poly(cx, cy, r, 12, rot)}"/>')
    s.append(ring(cx, cy, 72, 78, "d-magnet"))
    s.append(ring(cx, cy, 50, 70, "d-hcal"))
    s.append(ring(cx, cy, 38, 48, "d-ecal"))
    for r in range(8, 36, 5): s.append(f'<circle class="d-tracker" cx="{cx}" cy="{cy}" r="{r}"/>')
    for ang, ln, cv in ((-30, 120, 14), (40, 62, -10), (150, 66, 12), (205, 48, -8), (95, 64, 8), (-110, 140, -6)):
        s.append(track(cx, cy, ang, ln, cv))
    s.append(f'<circle class="d-point" cx="{cx}" cy="{cy}" r="3"/>')
    L = [(cx+22, cy-14, 330, 40, "det_tracker"), (cx+42, cy-12, 330, 72, "det_ecal"), (cx+60, cy-8, 330, 104, "det_hcal"),
         (cx+75, cy+8, 330, 136, "det_magnet"), (cx+88, cy+40, 330, 168, "det_iron"), (cx+102, cy+64, 330, 200, "det_muon"),
         (cx, cy, 330, 262, "det_collision")]
    s += [label(*l) for l in L]
    return '<svg class="drawing" viewBox="0 0 520 300" role="img" aria-label="CMS">' + "".join(s) + "</svg>"

def atlas():
    cx, cy = 150, 150; s = []
    for k in range(8):
        a = math.radians(22.5 + 45*k)
        x, y = cx + 108*math.cos(a), cy + 108*math.sin(a)
        s.append(f'<rect class="d-magnet" x="{f(x-21)}" y="{f(y-7)}" width="42" height="14" rx="7" transform="rotate({f(math.degrees(a))} {f(x)} {f(y)})"/>')
    for r in (84, 112, 140):
        s.append(f'<polygon class="d-muon" points="{poly(cx, cy, r, 8, 0)}"/>')
    s.append(ring(cx, cy, 50, 76, "d-hcal"))
    for k in range(32):
        a = 2*math.pi*k/32
        s.append(f'<path class="d-cut" d="M{f(cx+50*math.cos(a))},{f(cy+50*math.sin(a))} L{f(cx+76*math.cos(a))},{f(cy+76*math.sin(a))}"/>')
    s.append(ring(cx, cy, 36, 48, "d-ecal"))
    s.append(ring(cx, cy, 32, 34, "d-magnet"))
    for r in range(8, 31, 5): s.append(f'<circle class="d-tracker" cx="{cx}" cy="{cy}" r="{r}"/>')
    for ang, ln, cv in ((-35, 135, 6), (30, 60, -8), (160, 70, 10), (100, 140, -5), (230, 58, 8)):
        s.append(track(cx, cy, ang, ln, cv))
    s.append(f'<circle class="d-point" cx="{cx}" cy="{cy}" r="3"/>')
    L = [(cx+20, cy-14, 330, 40, "det_inner"), (cx+33, cy-6, 330, 72, "det_solenoid"), (cx+42, cy-10, 330, 104, "det_lar"),
         (cx+64, cy-12, 330, 136, "det_tile"), (cx+100, cy+42, 330, 182, "det_toroid"), (cx+112, cy+70, 330, 218, "det_muon"),
         (cx, cy, 330, 262, "det_collision")]
    s += [label(*l) for l in L]
    return '<svg class="drawing" viewBox="0 0 520 300" role="img" aria-label="ATLAS">' + "".join(s) + "</svg>"

def snd():
    cx, cy = 150, 150; s = []
    s.append(f'<path class="d-beam" d="M10,{cy} L290,{cy}"/>')
    s.append(ring(cx, cy, 108, 116, "d-muon-band"))
    s.append(ring(cx, cy, 92, 104, "d-iron"))
    for r1, r2 in ((30, 50), (52, 70), (72, 88)):
        s.append(ring(cx, cy, r1, r2, "d-ecal"))
    for k in range(40):
        a = 2*math.pi*k/40
        s.append(f'<path class="d-cut" d="M{f(cx+30*math.cos(a))},{f(cy+30*math.sin(a))} L{f(cx+88*math.cos(a))},{f(cy+88*math.sin(a))}"/>')
    for r in (12, 18, 24): s.append(f'<circle class="d-tracker" cx="{cx}" cy="{cy}" r="{r}"/>')
    s.append(f'<path class="d-cover" d="M{cx-118},{cy-4} L{cx+118},{cy-4} L{cx+118},{cy+4} L{cx-118},{cy+4} Z"/>')
    s.append(f'<path class="d-beam" d="M10,{cy} L290,{cy}"/>')
    s.append(f'<text class="d-small" x="16" y="{cy-8}">e⁻ →</text><text class="d-small" x="284" y="{cy-8}" text-anchor="end">← e⁺</text>')
    for ang, ln in ((-60, 80), (-150, 82), (70, 84), (115, 78)):
        a = math.radians(ang)
        s.append(f'<path class="d-photon" pathLength="1" d="M{cx},{cy} L{f(cx+ln*math.cos(a))},{f(cy+ln*math.sin(a))}"/>')
    s.append(f'<circle class="d-point" cx="{cx}" cy="{cy}" r="3"/>')
    L = [(cx+14, cy-16, 330, 40, "det_drift"), (cx+50, cy-40, 330, 88, "det_nai"),
         (cx+70, cy-66, 330, 120, "det_absorber"), (cx+80, cy-80, 330, 152, "det_muon"), (cx, cy, 330, 262, "det_collision")]
    s += [label(*l) for l in L]
    return '<svg class="drawing" viewBox="0 0 520 300" role="img" aria-label="SND">' + "".join(s) + "</svg>"

def ship():
    s = []; y = 95
    s.append(f'<path class="d-beam" d="M6,{y} L48,{y}"/><path class="d-arrow" d="M42,{y-5} L50,{y} L42,{y+5}"/>')
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
    s.append(f'<path class="d-track" pathLength="1" d="M330,{y+4} Q 400,{y-6} 470,{y-30}"/><path class="d-track" pathLength="1" d="M330,{y+4} Q 400,{y+14} 470,{y+34}"/>')
    s.append(f'<circle class="d-point" cx="330" cy="{y+4}" r="3"/>')
    def lab(x, key, row):
        ly = 168 + row*20
        return f'<path class="d-lead" d="M{x},{y+50 if x>420 else y+32} L{x},{ly-10}"/><text class="d-label" x="{x}" y="{ly}" text-anchor="middle">{{{{ T "{key}" }}}}</text>'
    s.append(lab(28, "det_protons", 1)); s.append(lab(59, "det_target", 0)); s.append(lab(140, "det_shield", 1))
    s.append(lab(217, "det_snd_ship", 0)); s.append(lab(334, "det_decay", 1)); s.append(lab(440, "det_spectrometer", 0))
    s.append(lab(496, "det_pid", 1))
    s.append(f'<text class="d-small" x="330" y="{y-50}" text-anchor="middle">{{{{ T "det_hidden" }}}}</text>')
    return '<svg class="drawing drawing-wide" viewBox="0 0 520 220" role="img" aria-label="SHiP">' + "".join(s) + "</svg>"

with open(OUT, "w") as fh:
    fh.write('{{- /* Simplified drawings of the experiments (original, not to scale), generated by\n'
             '       scripts/experiment_drawings.py. Call with the experiment key: cms, atlas, snd, ship. */ -}}\n')
    for i, (k, fn) in enumerate((("cms", cms), ("atlas", atlas), ("snd", snd), ("ship", ship))):
        fh.write(('{{- if' if i == 0 else '{{- else if') + f' eq . "{k}" }}}}\n' + fn() + "\n")
    fh.write("{{- end }}\n")
print("ok")
