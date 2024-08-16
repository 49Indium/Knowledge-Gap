from pyvis.network import Network
import networkx as nx
import chromadb
import csv

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

nx_graph = nx.cycle_graph(10)
nx_graph.nodes[1]['title'] = 'Number 1'
nx_graph.nodes[1]['group'] = 1
nx_graph.nodes[3]['title'] = 'I belong to a different group!'
nx_graph.nodes[3]['group'] = 10
nx_graph.add_node(20, size=20, title='couple', group=2)
nx_graph.add_node(21, size=15, title='couple', group=2)
nx_graph.add_edge(20, 21, weight=5)
nx_graph.add_node(25, size=25, label='lonely', title='lonely node', group=3)
nt = Network('500px', '500px')
# populates the nodes and edges data structures
nt.from_nx(nx_graph)
nt.save_graph("demo.html")
