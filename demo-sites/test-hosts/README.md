# Test host sites

Fictional charity websites for trying Chartitable's script-tag layer. They are not real organizations. Nothing here takes payment or sends mail.

## Ports

| Folder | Name | Charity id | Port |
|---|---|---|---|
| `warm-pantry` | Cinderwell Pantry | `demo-pantry-a` | 5501 |
| `regional-bank` | Brindlecote Food Bank | `demo-pantry-b` | 5502 |
| `volunteer-run` | Quillon Street Pantry | `demo-pantry-a` | 5503 |
| `church-community` | Wrenfield Lane Pantry | `demo-pantry-b` | 5504 |

## Serve

From the repo root, one terminal per site:

```bash
python3 -m http.server 5501 --directory demo-sites/test-hosts/warm-pantry
python3 -m http.server 5502 --directory demo-sites/test-hosts/regional-bank
python3 -m http.server 5503 --directory demo-sites/test-hosts/volunteer-run
python3 -m http.server 5504 --directory demo-sites/test-hosts/church-community
```

## Preview

The production layer is `http://localhost:5174/layer.js`. Until that file is being served, layouts can still be checked with the dev harness in `_preview/`. It is not the production layer. It runs only when asked:

- Empty slots (first-time visitor): `http://localhost:5501/`
- Filled slots: `http://localhost:5501/?preview=1`
- Unrecognized sample, slots stay empty: `http://localhost:5501/?preview=empty`

Same query works on ports 5502–5504. Each site folder links `preview.js`, `donor-view.sample.json`, `donor-view.empty.json`, and `preview-crate.svg` to `_preview/`.

Sample people and numbers are fictional. Estimates in the filled view include the word "about".

The page script tag points at `http://localhost:5174/layer.js`. Until `npm run dev:layer` is running, the browser will log a failed load for that file. The slots stay empty, which is the first-time visitor state. The `?preview=1` harness does not replace that script.
