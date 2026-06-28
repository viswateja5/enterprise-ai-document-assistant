from typing import List, Optional
from langchain_core.documents import Document

def create_hybrid_retriever(
    db,
    top_k: int = 10,
    session_id: Optional[str] = None,
    global_search: bool = False,
    page: Optional[int] = None,
    document_name: Optional[str] = None
):
    """
    Creates an EnsembleRetriever combining BM25 (sparse keyword search) 
    and FAISS (dense semantic search), scoped to the active session and metadata filters.
    
    Weights: semantic (FAISS) = 0.7, keyword (BM25) = 0.3
    """
    from langchain_community.vectorstores import FAISS
    from langchain_community.retrievers import BM25Retriever
    from langchain_classic.retrievers import EnsembleRetriever
    all_documents = list(db.docstore._dict.values())
    
    # Apply filtering constraints to the lexical document list (BM25)
    if not global_search and session_id:
        all_documents = [
            doc for doc in all_documents 
            if doc.metadata.get("session_id") == session_id
        ]
        
    if page is not None:
        all_documents = [
            doc for doc in all_documents
            if doc.metadata.get("page") == page
        ]
        
    if document_name is not None:
        all_documents = [
            doc for doc in all_documents
            if doc.metadata.get("document_name") == document_name
        ]
        
    if not all_documents:
        raise ValueError(f"No active session documents found to retrieve for session: {session_id}")
    
    # 1. Setup Dense Retriever (FAISS)
    search_kwargs = {"k": top_k}
    
    # Build FAISS metadata filter dictionary
    filter_dict = {}
    if not global_search and session_id:
        filter_dict["session_id"] = session_id
    if page is not None:
        filter_dict["page"] = page
    if document_name is not None:
        filter_dict["document_name"] = document_name
        
    if filter_dict:
        search_kwargs["filter"] = filter_dict
        
    dense_retriever = db.as_retriever(search_kwargs=search_kwargs)
    
    # 2. Setup Sparse Retriever (BM25)
    sparse_retriever = BM25Retriever.from_documents(all_documents)
    sparse_retriever.k = top_k
    
    # 3. Fuse using EnsembleRetriever with Reciprocal Rank Fusion (RRF)
    # Applying weights: semantic (FAISS) = 0.7, keyword (BM25) = 0.3
    ensemble_retriever = EnsembleRetriever(
        retrievers=[sparse_retriever, dense_retriever],
        weights=[0.3, 0.7]
    )
    
    return ensemble_retriever
