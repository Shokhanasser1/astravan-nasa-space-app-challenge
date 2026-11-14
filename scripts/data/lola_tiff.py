"""Minimal GeoTIFF window reader over HTTP range requests (no GDAL needed).

Reads classic TIFF and BigTIFF, tiled or striped, uncompressed / LZW / Deflate, with or without the
horizontal predictor, float32 or int16 samples. Enough for the NASA PGDA LOLA DEMs (pgda.gsfc.nasa.gov).

    tif = RemoteTiff(url)            # fetches the header only
    print(tif.info())                # size, pixel size, origin, tiling, compression
    z = tif.window(col0, row0, w, h) # numpy array, only the tiles it needs are downloaded
"""

import struct
import sys
import urllib.request
import zlib

import numpy as np

TYPES = {1: ("B", 1), 2: ("s", 1), 3: ("H", 2), 4: ("I", 4), 5: ("II", 8), 6: ("b", 1), 7: ("B", 1),
         8: ("h", 2), 9: ("i", 4), 10: ("ii", 8), 11: ("f", 4), 12: ("d", 8), 16: ("Q", 8), 17: ("q", 8)}


def fetch(url, start, length):
    req = urllib.request.Request(url, headers={"Range": f"bytes={start}-{start + length - 1}",
                                               "User-Agent": "lola-tiff-reader"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def lzw_decode(data):
    """TIFF LZW (MSB-first codes, early change)."""
    out = bytearray()
    table = [bytes([i]) for i in range(256)] + [b"", b""]
    bits, pos, nbits, prev = 0, 0, 9, None
    buf = int.from_bytes(data, "big")
    total = len(data) * 8
    while pos + nbits <= total:
        code = (buf >> (total - pos - nbits)) & ((1 << nbits) - 1)
        pos += nbits
        if code == 256:
            table = table[:258]
            nbits, prev = 9, None
            continue
        if code == 257:
            break
        if prev is None:
            entry = table[code]
        elif code < len(table):
            entry = table[code]
            table.append(prev + entry[:1])
        else:
            entry = prev + prev[:1]
            table.append(entry)
        out += entry
        prev = entry
        if len(table) + 1 >= (1 << nbits) and nbits < 12:
            nbits += 1
    return bytes(out)


class RemoteTiff:
    def __init__(self, url, level=0, head=1 << 20):
        """level 0 = full resolution; 1, 2, ... = the COG's overviews (each half the size of the one before)."""
        self.url = url
        self.head = fetch(url, 0, head)
        h = self.head
        self.e = "<" if h[:2] == b"II" else ">"
        magic = struct.unpack(self.e + "H", h[2:4])[0]
        self.big = magic == 43
        off = struct.unpack(self.e + ("Q" if self.big else "I"), h[8:16] if self.big else h[4:8])[0]
        first, nxt = self._ifd(off)
        self.tags = first
        for _ in range(level):
            if not nxt:
                raise ValueError(f"no overview level {level}")
            self.tags, nxt = self._ifd(nxt)
        t = self.tags
        self.width, self.height = t[256][0], t[257][0]
        self.bps = t[258][0]
        self.fmt = t.get(339, [1])[0]
        self.comp = t.get(259, [1])[0]
        self.pred = t.get(317, [1])[0]
        self.tiled = 322 in t
        if self.tiled:
            self.tw, self.th = t[322][0], t[323][0]
            self.offsets, self.counts = t[324], t[325]
        else:
            self.tw, self.th = self.width, t.get(278, [self.height])[0]
            self.offsets, self.counts = t[273], t[279]
        # overviews carry no georeferencing: scale the full-resolution pixel size by the size ratio
        k = first[256][0] / self.width
        self.scale = [v * k for v in first.get(33550, [1, 1, 0])]
        self.tie = first.get(33922)
        self.nodata = first.get(42113)

    def _bytes(self, off, n):
        if off + n <= len(self.head):
            return self.head[off:off + n]
        return fetch(self.url, off, n)

    def _ifd(self, off):
        e = self.e
        if self.big:
            n = struct.unpack(e + "Q", self._bytes(off, 8))[0]
            raw, step, start = self._bytes(off + 8, n * 20 + 8), 20, 0
            nxt = struct.unpack(e + "Q", raw[n * 20:n * 20 + 8])[0]
        else:
            n = struct.unpack(e + "H", self._bytes(off, 2))[0]
            raw, step, start = self._bytes(off + 2, n * 12 + 4), 12, 0
            nxt = struct.unpack(e + "I", raw[n * 12:n * 12 + 4])[0]
        tags = {}
        for i in range(n):
            ent = raw[start + i * step:start + (i + 1) * step]
            if self.big:
                tag, typ, cnt = struct.unpack(e + "HHQ", ent[:12])
                val = ent[12:20]
                inline = 8
            else:
                tag, typ, cnt = struct.unpack(e + "HHI", ent[:8])
                val = ent[8:12]
                inline = 4
            fmt, size = TYPES.get(typ, ("B", 1))
            nbytes = size * cnt
            if nbytes > inline:
                ptr = struct.unpack(e + ("Q" if self.big else "I"), val)[0]
                data = self._bytes(ptr, nbytes)
            else:
                data = val[:nbytes]
            if typ == 2:
                tags[tag] = [data.rstrip(b"\0").decode("latin-1")]
            else:
                f = fmt[0]
                k = cnt * len(fmt)
                tags[tag] = list(struct.unpack(e + f * k, data[:k * struct.calcsize(f)]))
        return tags, nxt

    def info(self):
        return {
            "size": [self.width, self.height], "bits": self.bps, "format": self.fmt, "compression": self.comp,
            "predictor": self.pred, "tile": [self.tw, self.th], "tiled": self.tiled,
            "pixel_scale": self.scale, "tiepoint": self.tie, "nodata": self.nodata,
            "geo_ascii": self.tags.get(34737), "tiles": len(self.offsets),
        }

    def dtype(self):
        if self.fmt == 3:
            return np.dtype(self.e + ("f4" if self.bps == 32 else "f8"))
        if self.fmt == 2:
            return np.dtype(self.e + {8: "i1", 16: "i2", 32: "i4"}[self.bps])
        return np.dtype(self.e + {8: "u1", 16: "u2", 32: "u4"}[self.bps])

    def _block(self, i):
        raw = fetch(self.url, self.offsets[i], self.counts[i])
        if self.comp == 5:
            raw = lzw_decode(raw)
        elif self.comp in (8, 32946):
            raw = zlib.decompress(raw)
        elif self.comp != 1:
            raise ValueError(f"compression {self.comp} not supported")
        dt = self.dtype()
        rows = self.th
        if not self.tiled:
            rows = min(self.th, self.height - i * self.th)
        cols = self.tw
        if self.pred == 2:
            a = np.frombuffer(raw, dtype=dt).reshape(rows, cols).astype(dt.newbyteorder("=")).copy()
            return np.cumsum(a, axis=1, dtype=a.dtype)
        if self.pred == 3:
            b = np.frombuffer(raw, dtype=np.uint8).reshape(rows, cols * dt.itemsize)
            b = np.cumsum(b, axis=1, dtype=np.uint8)
            b = b.reshape(rows, dt.itemsize, cols).transpose(0, 2, 1)
            # floating-point predictor stores the bytes most-significant first
            b = b[:, :, ::-1] if dt.byteorder in ("<", "=") and sys.byteorder == "little" else b
            return np.ascontiguousarray(b).view(dt.newbyteorder("<")).reshape(rows, cols)
        return np.frombuffer(raw, dtype=dt).reshape(rows, cols).astype(dt.newbyteorder("="))

    def window(self, col0, row0, w, h):
        out = np.full((h, w), np.nan, dtype=np.float64)
        if self.tiled:
            across = (self.width + self.tw - 1) // self.tw
            for ty in range(row0 // self.th, (row0 + h - 1) // self.th + 1):
                for tx in range(col0 // self.tw, (col0 + w - 1) // self.tw + 1):
                    blk = self._block(ty * across + tx)
                    y0, x0 = ty * self.th, tx * self.tw
                    ys, ye = max(row0, y0), min(row0 + h, y0 + self.th, self.height)
                    xs, xe = max(col0, x0), min(col0 + w, x0 + self.tw, self.width)
                    if ye > ys and xe > xs:
                        out[ys - row0:ye - row0, xs - col0:xe - col0] = blk[ys - y0:ye - y0, xs - x0:xe - x0]
        elif self.comp == 1 and self.th == 1:
            # uncompressed one-row strips (PGDA 5 m/px site DEMs): one range request per row, columns only
            dt = self.dtype()
            row = self.width * dt.itemsize
            rows = range(row0, row0 + h)
            if all(self.offsets[r + 1] - self.offsets[r] == row for r in rows[:-1]):
                raw = fetch(self.url, self.offsets[row0], h * row)       # contiguous: one request
                out[:, :] = np.frombuffer(raw, dtype=dt).reshape(h, self.width)[:, col0:col0 + w]
            else:
                for r in rows:
                    raw = fetch(self.url, self.offsets[r] + col0 * dt.itemsize, w * dt.itemsize)
                    out[r - row0, :] = np.frombuffer(raw, dtype=dt)
        else:
            for s in range(row0 // self.th, (row0 + h - 1) // self.th + 1):
                blk = self._block(s)
                y0 = s * self.th
                ys, ye = max(row0, y0), min(row0 + h, y0 + blk.shape[0])
                if ye > ys:
                    out[ys - row0:ye - row0, :] = blk[ys - y0:ye - y0, col0:col0 + w]
        if self.nodata:
            try:
                out[out == float(self.nodata[0])] = np.nan
            except ValueError:
                pass
        return out


if __name__ == "__main__":
    for u in sys.argv[1:]:
        print(u)
        lv = 0
        while True:
            try:
                t = RemoteTiff(u, lv)
            except (ValueError, KeyError):
                break
            print(lv, t.info()["size"], t.scale[:2], t.info()["tile"])
            lv += 1
