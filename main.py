from pyvis.network import Network
import networkx as nx
import chromadb
import chromadb.types
from chromadb.utils import embedding_functions
import csv
import json
import itertools
import operator
from math import dist
from typing import Literal, Optional
from random import sample

LONGEST_EDGE_SPRING_LENGTH = 20
MAX_EDGE_WEIGHT = 10

EMBEDDING_FUNCTION = embedding_functions.SentenceTransformerEmbeddingFunction(model_name='embaas/sentence-transformers-gte-base')

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

def distance_metric(v1, v2):
    return l2_distance(v1, v2)

def l2_distance(v1, v2):
    return dist(v1, v2)

def create_edges(ids: list[str], embeddings: list[chromadb.types.Vector], mode: Literal["Linear Cutoff", "Nearest Neighbours"], db: Optional[chromadb.Collection] = None):
    edges = []
    if mode == "Linear Cutoff":
        weights = [distance_metric(e1, e2) for (e1, e2) in itertools.combinations(embeddings, 2)]
        max_weight = max(weights)
        min_weight = min(weights)
        for (id1, embedding1), (id2, embedding2) in itertools.combinations(zip(ids, embeddings), 2):
            weight = (max_weight - distance_metric(embedding1, embedding2)) / (max_weight - min_weight)
            if weight > 0.4:
                edges.append((id1, id2, {
                             "weight": MAX_EDGE_WEIGHT*weight,
                             "length": LONGEST_EDGE_SPRING_LENGTH*(1-weight)
                         }))
                
    elif mode == "Nearest Neighbours":
        assert db
        id_set = set(ids)
        edge_set = set()

        # distance_sample = [distance_metric(*sample(embeddings, 2)) for _ in range(1000)]
        distance_sample = [distance_metric(e1, e2) for (e1, e2) in itertools.combinations(embeddings, 2)]
        max_distance = max(distance_sample)
        min_distance = min(distance_sample)
        weight_cut_off = 0.42
        weight_calc = lambda d: max(0, (max_distance - d) / (max_distance - min_distance))
               
        for id, embedding in zip(ids, embeddings):
            potential_neighbours = db.query(
                query_embeddings=embedding,
                n_results=30,
                include=["embeddings"]
            )
            assert potential_neighbours["embeddings"] and potential_neighbours["embeddings"][0]

            neighbour_zip = zip(potential_neighbours["ids"][0], potential_neighbours["embeddings"][0])
            sorted_potential_neighbours = sorted(neighbour_zip, key = lambda neighbour: distance_metric(embedding, neighbour[1]))
            
            potential_edges: list[tuple[float, str, chromadb.types.Vector]] = []
            for neighbour_id, neighbour_embedding in sorted_potential_neighbours:
                if neighbour_id not in id_set or neighbour_id == id:
                    continue
                distance = distance_metric(embedding, neighbour_embedding)
                if not potential_edges:
                    # always have one edge.
                    potential_edges.append((distance, neighbour_id, neighbour_embedding))
                    continue
                if weight_calc(distance) < weight_cut_off:
                    continue
                potential_edges.append((distance, neighbour_id, neighbour_embedding))

            potential_edges.sort(key=operator.itemgetter(2), reverse=True)
            capacity = 1.5
            for i, (distance, neighbour_id, neighbour_embedding) in enumerate(potential_edges[0:9]):
                if capacity < 0:
                    break
                capacity -= (i*0.5 + 1)*(1 - weight_calc(distance))
                if (id, neighbour_id) in edge_set:
                    continue
                edges.append((id, neighbour_id, {
                                 "weight": MAX_EDGE_WEIGHT * weight_calc(distance),
                                 "length": LONGEST_EDGE_SPRING_LENGTH*(1-weight_calc(distance)+0.4)/(1-0.4),
                                 "label": f"{round(weight_calc(distance),2)}"
                             }))
                edge_set.add((id, neighbour_id))
            
    else:
        print("Unknown edge creation method")
        assert False
    return edges
            
def reduce_edges(network: nx.Graph):
    for node in sorted(list(network.nodes()), key=network.degree, reverse=True):
        if network.degree(node) < 7:
            continue# TODO change to break
        sorted_edges = sorted(list(network.edges(node, True)), key=lambda e: e[2]["weight"] if (e and e[2]) else 0, reverse=True)
        sorted_edges = [(u,v) for u,v,_ in sorted_edges if network.degree(u) > 1 and network.degree(v) > 1]
        network.remove_edges_from(sorted_edges[min(10,len(sorted_edges)):])

def get_all_terms(group: list[tuple[str, dict]]):
    terms = []
    for id in group:
        document = flashcards_db.get(id)["documents"][0]
        terms += get_all_words(document)
    return terms

def get_all_words(s):
    removed_spaces = [''.join(c for c in a if c.isalnum()) for a in s.split()]
    return [a for a in removed_spaces if len(a) > 3]

def get_closest_term(terms, vector):
    current_min_distance = 10000
    current_min_term = ""
    for term in [t.lower() for t in terms]:
        distance = distance_metric(EMBEDDING_FUNCTION([term])[0], vector)
        if distance < current_min_distance:
            current_min_distance = distance
            current_min_term = term
    return current_min_term
            
def average_vector(ids):
    sum = []
    for id in ids:
        embedding = flashcards_db.get(id, include=["embeddings"])["embeddings"][0]
        if sum:
            sum = [s + e for s, e in zip(sum, embedding)]
        else:
            sum = embedding
    return sum

chroma_client = chromadb.PersistentClient(path="data/chromadb")

flashcards_db = chroma_client.get_or_create_collection(name="flashcards", embedding_function=EMBEDDING_FUNCTION)
# chroma_client.delete_collection(name="flashcards")

dictionary_db = chroma_client.get_or_create_collection(name="dictionary", embedding_function=EMBEDDING_FUNCTION)

# notes = read_mathematical_definition_notes()
# add_mathematical_definition_notes_to_db(flashcards_db, notes)

# print(flashcards_db.peek(1))

# results = flashcards_db.query(
#     query_texts=["clopen"],
#     n_results=5
# )
# print(f"Results {results}")

mindmap = nx.Graph()

flashcard_sample = flashcards_db.get(include=["embeddings","metadatas"], limit=500)
assert flashcard_sample["metadatas"]
assert flashcard_sample["embeddings"]
for id, note in zip(flashcard_sample["ids"], flashcard_sample["metadatas"]):
    mindmap.add_node(id, title=note["term"], label=" ")
mindmap.add_edges_from(create_edges(flashcard_sample["ids"], flashcard_sample["embeddings"], "Nearest Neighbours", db=flashcards_db))
reduce_edges(mindmap)

partition = nx.community.louvain_communities(mindmap)
partition_names = [get_closest_term(get_all_terms(list(p)), average_vector(list(p))) if len(p) >= 4 else "" for p in partition]
new_partition = []
new_names = []
for unique_name in set(partition_names):
    indicies = [i for i, _ in enumerate(partition) if partition_names[i] == unique_name]
    new_partition.append(set().union(*[partition[i] for i in indicies]))
    new_names.append(unique_name)
print(new_names)
print(new_partition)

export_dict = {
    "nodes": [{"id": id, "title": node_data["title"], "group": [i for i, g in enumerate(new_partition) if id in g][0]} for id, node_data in mindmap.nodes(True)],
    "edges": [{"source": u, "target": v, "label": edge_data["label"], "weight": edge_data["weight"]} for u, v, edge_data in mindmap.edges(None, True)],
    "groups": [{"title": name.title(), "index": i} for i, name in enumerate(new_names)]
}
with open("data/mindmap.json", "w") as json_file:
    json.dump(export_dict, json_file, indent="\t", sort_keys=True)

# nt = Network('700px', '100%')
# nt.from_nx(mindmap,show_edge_weights=True)
# nt.barnes_hut(
#     central_gravity=5.0,
#     spring_strength=0.06,
#     damping=0.25
# )

# nt.show_buttons(filter_=['physics'])
# nt.save_graph("demo.html")
