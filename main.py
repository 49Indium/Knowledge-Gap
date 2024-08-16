import chromadb
chroma_client = chromadb.Client()

collection = chroma_client.create_collection(name="flashcards")

collection.add(
    documents=[
        "This is a document about pineapple",
        "This is a document about oranges"
    ],
    ids=["id1", "id2"]
)

print("hi")
results = collection.query(
    query_texts=["This is a query document about hawaii"], # Chroma will embed this for you
    n_results=2 # how many results to return
)
print(f"Results {results}")
