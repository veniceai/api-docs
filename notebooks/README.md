# Notebooks

Colab notebooks that accompany the tutorial pages.

| Notebook | Tutorial |
|---|---|
| [`article-narration.ipynb`](article-narration.ipynb) | [Narrating Articles with Text-to-Speech](../guides/media/article-narration.mdx) |
| [`audio-research-notebook.ipynb`](audio-research-notebook.ipynb) | [Building an Audio Research Notebook](../learn/audio-research-notebook.mdx) |
| [`wallet-budget-agent.ipynb`](wallet-budget-agent.ipynb) | [Giving an Agent a Wallet and a Budget](../learn/wallet-budget-agent.mdx) |

## These are generated

Do not edit the `.ipynb` files by hand. The tutorial page is the source of truth
for its code, and the notebook is built from it:

```bash
python notebooks/build.py
```

Run this after changing the Python in a tutorial that has a notebook, and commit
the result. To find out whether anything is stale without writing files:

```bash
python notebooks/build.py --check
```

The build fails loudly rather than producing a stale notebook if a page is
rewritten in a way the spec no longer matches, such as a renamed section or a
removed code block. Fix `notebooks/build.py` to match the new page.

## Why the notebook is not just the page

A tutorial is ordered to be read, but a notebook has to run top to bottom, and
the two orders differ. The narration page inspects `chunks` before the text
being chunked exists, splits its code across two files that import each other,
and guards its entry point behind `__main__`. So `build.py` holds an explicit
running order and adds the cells that only make sense in Colab: reading the key
from Colab secrets, and playing the audio back inline.

Code that comes from a page is pulled in verbatim by section, so it cannot drift.
Prose is written for the notebook, since the page's surrounding narration does
not read well as cell markdown.

## Conventions

- Commit notebooks with outputs stripped. `build.py` emits empty outputs, so
  just do not paste an executed notebook over the generated one.
- Never commit an API key. The setup cell reads `VENICE_API_KEY` from Colab
  secrets, falling back to the environment and then to a `getpass` prompt.
- Notebooks consume real credit when run. Say so near the top of the notebook.
