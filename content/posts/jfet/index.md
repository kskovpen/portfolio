+++
title = "JFET notes"
date = "2025-01-04T12:00:00+01:00"
draft = false
tags = ["electronics"]
+++

Draft post text.

<!--more-->

https://electronics.stackexchange.com/questions/148964/switching-resistances-in-op-amp-amplifier

gate capacitance is 5 pF and is important

2N/PN4117, 2N/PN4338, VCR2N, VCR4N, VCR7N

In a typical MOSFET, the source contact is connected to the bulk
substrate. Therefore, there is a diode junction between drain and
source/bulk - the typical MOSFET reverse diode. This diode's junction
capacitance is the MOSFET's drain-source off-state capacitance. The
drain and source potentials are "facing" each other via this
reverse-biased junction, forming a plate capacitor.

In a JFET, however, there is no such reverse diode. A JFET is a true
three-terminal device; the source and drain contacts are connected
directly to the substrate, which is the (normally-on) channel. When
the JFET turns off, the conducting path between drain and source gets
pinched off by the expanding depletion region from the gate. There is
no point in the JFET anymore where the drain and source potentials
face each other - the gate potential "pushed" itself between them via
a depletion region. As a result, there's a drain-gate and a
gate-source capacitance, but no significant drain-source capacitance
anymore since the gate potential is in the way. Additionally,
depending on gate voltage, the width of the depletion region varies,
which means that the drain-source capacitance is both negligibly small
and poorly defined.

The drain-gate and gate-source capacitances also vary greatly
depending on the voltage between gate and drain / source since they
are caused by reverse-biased diode junctions as well.
