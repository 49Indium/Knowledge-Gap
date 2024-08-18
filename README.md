# Knowledge Gap
Classify your notes automatically, find new connections between existing ideas and see a mind-map of everything you've learnt. A project for the 2024 UQCS Hackathon.

## Why Care?
Writing notes is a key part of the uni experience. However, if you're anything like me, they end up an unorganised mess of tid-bits and dot points where you can't find the thing you're looking for. You want to be writing notes, not organising them and taking up precious learning (or partying) time!

Knowledge Gap automatically classifies your notes, finding similarities and letting you see the bigger picture. After processing your notes locally on your machine, it produces an interactive mind-map, showing connections between ideas and large groups of connected topics, all without you having to lift a finger. You can search through your notes by topic, and see all your related notes to help you understand and review content.

The connections made are smart and computed locally using an embedding model (think the first half of an LLM). This incorporates the context of your notes, so when you take notes about "points" from your design theory class, they won't be connected to your unrelated notes about "points" in topology. This also means that notes that use different terms for the same thing will also be connected (say if one note uses the term "graph" and another uses the term "network").

## How Does It Work?
Knowledge Gap is split into a back end, which locally processes notes, automatically finds connections and groups them; and a front end, which provides an interactive force-driven display of the constructed graph, and allows to adjust edges. The back end uses Python with a [Chroma](https://www.trychroma.com/) database and the [GTE (General Text Embedding) base model](https://huggingface.co/thenlper/gte-base). The front end uses JavaScript, using the [D3.js](https://d3js.org/) library.

### The Back 
Knowledge Gap starts with notes in pure text. For the demo, notes exported from [Anki](https://apps.ankiweb.net/) in pure text (and with any existing tags removed; no cheating here). An initial pass through interprets this file, and splits it into individual documents. This is then fed into the Chroma database via the GTE embedding.

An embedding can be thought of as how models (such as LLMs) can take in data (test, images, etc) and interpret them as thoughts and concepts. They are a function taking in tokens (split up sections of the input) and returning a vector. The vector space of outputs is called the *latent space*, but I like to think of it as the concept space. If you were building an LLM, you'd also want a decoder to produce the following text, but for us, the embedding is enough.

By turning our documents into *"concept"* vectors, we can then see what is similar by finding vectors that point in similar directions. Visualising the vectors directly is quite difficult for humans (please message me if you can effectively envision a 512-dimensional vector space; [setting n to 512 does not count](https://mathoverflow.net/questions/25983/intuitive-crutches-for-higher-dimensional-thinking)). We've tackled this problem by creating a graph (also known as a network), where each node is a definition (of some term in your notes) and edges link up terms that similar. There is a bit of fiddling to get the graph looking nice (it can very easily end up looking like a tangled mess), which involves filtering connections on nodes with lots of edges and trying to favor connections to nodes without any.

Once the graph is created, we try to cluster related nodes using the [Louvain method](https://en.wikipedia.org/wiki/Louvain_method). This attempts to maximise a modularity function which attempts to measure how good clusters $\{c_1,\ldots,c_n\}$ split up the graph, by looking at the edge weights $w(e_{ij})$: $$Q=\frac{1}{2\sum_{ij}w(e_{ij})}\sum_{ij}\left(w(e_{ij})-\frac{\left(\sum_kw(e_{ik})\right)\left(\sum_kw(e_{jk})\right)}{2\sum_{ij}w(e_{ij})}\right)[c_i=c_j]$$

To name the clusters, we try to find a word that matches the average embedding of each node in the cluster. We try every word within the database and find the word that matches up best.

All of this information is bundled together in a json file and passed to the front end.

### The Front
The visualisation of the graph is based on a many-body simulation. We spread out the nodes and apply forces to try to coerce the graph into a nice shape. The main force grouping the graph to how we might expect is the lining force of the edges. Embeddings of notes that we're closer (i.e. considered more similar) have shorter edges that pull together with more strength. This automatically clusters the data.

There are also some forces pushing all nodes apart from each other, ensuring that each point is visible. To ensure that the graph doesn't go flying off screen, we also add some forces pushing the nodes gently towards the center of the screen. For visual flair, we also push the nodes in a spiral. Because the force simulation is computed in real time, you can drag around nodes and untangle any groups that are stuck together.


## Set-up Guide
All the depenencies are listed in `pyproject.toml`. Place anki flashcards exported as a text file into a `data` file. Run `main.py` to load in the notes and store in the database (note that the first time this script is run, the GTE_base model will be downloaded; this make take some time). A json file will generated in the `data` folder along with a chromadb database instance. Opening `viewer.html` will then show the mind map.
