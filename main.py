from pyvis.network import Network
import networkx as nx
import chromadb
import csv
import itertools
from math import dist

def read_mathematical_definition_notes(filepath="data/MathsDefinitionNotes.txt"):
    with open(filepath, newline="") as notefile:
        note_reader = csv.reader(notefile, delimiter="\t")
        # Skip over headings
        for _ in range(6):
            next(note_reader)
            
        notes:list[dict[str, str]] = []
            
        for row in note_reader:
            id, note_type, deck, term, symbol, definition, extra_notes, tags = row
            assert (note_type == "08 Mathematical Definition")

            # Remove custom LaTeX tags
            def replace_latex(s):
                return s.replace("[$]","$").replace("[/$]","$").replace("[$$]","$$").replace("[/$$]","$$")
            
            term = replace_latex(term)
            symbol = replace_latex(symbol) if symbol else None
            definition = replace_latex(definition)

            notes.append({
                             "id": id,
                             "note_type": note_type,
                             "deck": deck,
                             "term": term,
                             "definition": definition,
                             "extra_notes": extra_notes,
                             "tags": tags,
                         } | ({"symbol": symbol} if symbol else {}))

        return notes

def add_mathematical_definition_notes_to_db(db, notes):
    db.add(
        documents = [f"{note['term']} := {note['definition']}" for note in notes],
        metadatas = notes,
        ids = [note["id"] for note in notes]
    )

def l2_distance(v1, v2):
    return dist(v1, v2)
            
chroma_client = chromadb.PersistentClient(path="/data/chromadb")

flashcards_db = chroma_client.get_or_create_collection(name="flashcards")
# chroma_client.delete_collection(name="flashcards")

# notes = read_mathematical_definition_notes()
# add_mathematical_definition_notes_to_db(flashcards_db, notes)

# print(flashcards_db.peek(1))

results = flashcards_db.query(
    query_texts=["clopen"],
    n_results=5
)
print(f"Results {results}")

mindmap = nx.Graph()

flashcard_sample = flashcards_db.get(include=["embeddings","metadatas"], limit=50)
assert flashcard_sample["metadatas"]
assert flashcard_sample["embeddings"]
for id, note in zip(flashcard_sample["ids"], flashcard_sample["metadatas"]):
    mindmap.add_node(id, title=note["term"], label=" ")
weights = [l2_distance(e1, e2) for (e1, e2) in itertools.combinations(flashcard_sample["embeddings"], 2)]
for (id1, embedding1), (id2, embedding2) in itertools.combinations(zip(flashcard_sample["ids"], flashcard_sample["embeddings"]), 2):
    weight = 5*(max(weights) - l2_distance(embedding1, embedding2)) / (max(weights) - min(weights))
    if weight > 2:
        mindmap.add_edge(id1, id2, weight=weight, length=200 - 40*weight + 5) #, label=f"{round(100 - 20*weight + 5, 1)}")

nt = Network('500px', '500px')
nt.from_nx(mindmap)

nt.show_buttons(filter_=['physics'])
nt.save_graph("demo.html")
