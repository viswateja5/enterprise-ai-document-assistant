import os
from typing import List
from langchain_core.documents import Document

def save_or_update_vector_store(
    chunks: List[Document],
    embeddings,
    store_path: str,
    index_name: str = "index"
):
    """
    Saves document chunks into a local FAISS index.
    
    If the index already exists at `store_path`, it loads the index, appends 
    the new document chunks, and saves it. If the index does not exist, it 
    creates a new FAISS index from the chunks and saves it.
    """
    from langchain_community.vectorstores import FAISS
    os.makedirs(store_path, exist_ok=True)
    
    faiss_file = os.path.join(store_path, f"{index_name}.faiss")
    pkl_file = os.path.join(store_path, f"{index_name}.pkl")
    
    if os.path.exists(faiss_file) and os.path.exists(pkl_file):
        try:
            db = FAISS.load_local(
                store_path, 
                embeddings, 
                index_name=index_name,
                allow_dangerous_deserialization=True
            )
            db.add_documents(chunks)
        except Exception:
            db = FAISS.from_documents(chunks, embeddings)
    else:
        db = FAISS.from_documents(chunks, embeddings)
        
    db.save_local(store_path, index_name=index_name)
    return db

def load_vector_store(
    store_path: str,
    embeddings,
    index_name: str = "index"
):
    """
    Loads an existing FAISS vector store from the local filesystem.
    """
    from langchain_community.vectorstores import FAISS
    faiss_file = os.path.join(store_path, f"{index_name}.faiss")
    pkl_file = os.path.join(store_path, f"{index_name}.pkl")
    
    if not (os.path.exists(faiss_file) and os.path.exists(pkl_file)):
        raise FileNotFoundError(
            f"FAISS index files not found in: {store_path}"
        )
        
    return FAISS.load_local(
        store_path, 
        embeddings, 
        index_name=index_name,
        allow_dangerous_deserialization=True
    )
