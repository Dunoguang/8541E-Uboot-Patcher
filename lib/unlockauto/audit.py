"""Diff-containment audit: every changed byte must lie in an allowed zone."""


def diff_zones(a, b):
    """Merged [start,end) zones where a != b."""
    assert len(a) == len(b)
    zones = []
    CH = 1 << 20
    for off in range(0, len(a), CH):
        ca = a[off:off + CH]
        cb = b[off:off + CH]
        if ca == cb:
            continue
        for i in range(len(ca)):
            if ca[i] != cb[i]:
                p = off + i
                if zones and p <= zones[-1][1]:
                    zones[-1][1] = p + 1
                else:
                    zones.append([p, p + 1])
    return zones


def audit(base, prod, allowed):
    """allowed: list of [start, end). Returns (ok, zones, outside_bytes)."""
    zones = diff_zones(base, prod)
    outside = 0
    for s, e in zones:
        if not any(s >= a and e <= b for a, b in allowed):
            outside += e - s
    return (outside == 0), zones, outside


def count_bytes(zones):
    return sum(e - s for s, e in zones)
