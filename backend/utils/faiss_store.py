import os
from typing import List
from langchain_core.documents import Document

_cached_vector_store = None

def get_vector_store(store_path: str, embeddings, index_name: str = "index"):
    global _cached_vector_store
    if _cached_vector_store is not None:
        return _cached_vector_store
        
    from langchain_community.vectorstores import FAISS
    faiss_file = os.path.join(store_path, f"{index_name}.faiss")
    pkl_file = os.path.join(store_path, f"{index_name}.pkl")
    
    if os.path.exists(faiss_file) and os.path.exists(pkl_file):
        try:
            _cached_vector_store = FAISS.load_local(
                store_path, 
                embeddings, 
                index_name=index_name,
                allow_dangerous_deserialization=True
            )
        except Exception:
            pass
            
    return _cached_vector_store

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
    global _cached_vector_store
    os.makedirs(store_path, exist_ok=True)
    
    from langchain_community.vectorstores import FAISS
    db = get_vector_store(store_path, embeddings, index_name)
    if db is not None:
        db.add_documents(chunks)
    else:
        db = FAISS.from_documents(chunks, embeddings)
        _cached_vector_store = db
        
    db.save_local(store_path, index_name=index_name)
    return db

def load_vector_store(
    store_path: str,
    embeddings,
    index_name: str = "index"
):
    """
    Loads an existing FAISS vector store from the local filesystem or memory cache.
    """
    from langchain_community.vectorstores import FAISS
    db = get_vector_store(store_path, embeddings, index_name)
    if db is not None:
        return db
        
    faiss_file = os.path.join(store_path, f"{index_name}.faiss")
    pkl_file = os.path.join(store_path, f"{index_name}.pkl")
    
    if not (os.path.exists(faiss_file) and os.path.exists(pkl_file)):
        raise FileNotFoundError(
            f"FAISS index files not found in: {store_path}"
        )
        
    db = FAISS.load_local(
        store_path, 
        embeddings, 
        index_name=index_name,
        allow_dangerous_deserialization=True
    )
    global _cached_vector_store
    _cached_vector_store = db
    return db

def delete_document_from_vector_store(
    document_id: str,
    embeddings,
    store_path: str,
    index_name: str = "index"
) -> None:
    """
    Deletes all vectors and document chunks associated with a specific document_id
    from the local FAISS index.
    """
    db = get_vector_store(store_path, embeddings, index_name)
    if db is None:
        return
        
    try:
        # Find all docstore IDs matching the document_id
        keys_to_delete = []
        for key, doc in db.docstore._dict.items():
            if doc.metadata.get("document_id") == document_id:
                keys_to_delete.append(key)
                
        if keys_to_delete:
            db.delete(keys_to_delete)
            db.save_local(store_path, index_name=index_name)
    except Exception as e:
        import logging
        logger = logging.getLogger("rag-backend")
        logger.error(f"Failed to delete document {document_id} from FAISS: {e}")
