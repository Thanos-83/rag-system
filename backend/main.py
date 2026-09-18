import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from sentence_transformers import SentenceTransformer
import chromadb
from ollama import Client
from dotenv import load_dotenv

# 1. Load the secret keys from the .env file into memory
load_dotenv()

# 2. Initialize the FastAPI application
app = FastAPI(
    title='Backend of the RAG System',
    desciption='Description of the project',
    version='1.0.0'
)

# 2. Add CORS Middleware to explicitly trust the frontend
app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:3000"], 
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# 3. Load the local Embedding Model (This may take some time on startup)
embedding_model = SentenceTransformer("BAAI/bge-base-en-v1.5")

# --- DIAGNOSTIC BLOCK ---
tenant = os.getenv("CHROMA_TENANT_ID")
database = os.getenv("CHROMA_DATABASE")
api_key = os.getenv("CHROMA_API_KEY")

print("========== CHROMA DIAGNOSTICS ==========")
print(f"TENANT: {tenant}")
print(f"DATABASE: {database}")
print(f"API_KEY DETECTED: {bool(api_key)}")
if api_key:
    print(f"API_KEY LENGTH: {len(api_key)}")
    print(f"API_KEY STARTS WITH: {api_key[:5]}...")
print("========================================")
# ------------------------

# 4. Connect to Chroma Cloud Database...
chroma_client = chromadb.CloudClient(
    tenant=tenant,
    database=database,
    api_key=api_key
)
collection = chroma_client.get_collection(name="arxiv_abstracts")

# 5. Connect to Ollama Cloud
ollama_client = Client(
    host="https://ollama.com",
    headers={'Authorization': f"Bearer {os.getenv('OLLAMA_API_KEY')}"}
)

# 6. Define the exact JSON shape and data types Next.js must send to API endpoint
class SearchQuery(BaseModel):
    query: str
    category: Optional[str] = "All"


# 7. Define the API Endpoint that the Frontend will request.
@app.post("/api/chat")
async def chat_endpoint(request: SearchQuery):
    user_query = request.query
    
    try:
        # Step A: Convert the user's text/query into a 768-dimensional vector and generate the Embedding
        full_query = "Represent this sentence for searching relevant passages: " + user_query
        query_vector = embedding_model.encode([full_query]).tolist()

        # Add the where-clause filter for ChromaDB
        where_clause = {"category": request.category} if request.category and request.category != "All" else None

        # Step B. Query ChromaDB for the top 3 most relevant papers using the category filter
        results = collection.query(
            query_embeddings=query_vector,
            n_results=3,
            where=where_clause
        )
        

        # Step C: Combine the retrieved abstracts into a single context string
        retrieved_abstracts = results['documents'][0]
        retrieved_titles = [meta['title'] for meta in results['metadatas'][0]]
        
        context_blocks = []
        for title, text in zip(retrieved_titles, retrieved_abstracts):
            context_blocks.append(f"Source: {title}\n{text}")
        
        full_context = "\n\n---\n\n".join(context_blocks)
        
        # Step D: Prompt Engineering
        # (D1). Build a strict prompt to prevent the LLM from hallucinating
        # system_prompt = f"""You are an expert academic research assistant. 
        #                     Answer the user's question using ONLY the information provided in the Context below. 
        # If the answer cannot be found in the Context, state exactly: "I do not have enough information to answer this."

        # CONTEXT:    
        # {full_context}"""

        # (D2). Build a hybrid promt to allow longer answers and expansions
        # Step D: Build a hybrid prompt with STRICT formatting rules
        system_prompt = f"""You are an expert academic research assistant in Machine Learning.

                        INSTRUCTIONS:
                        1. Primary Source: Base your answer on the provided CONTEXT. 
                        2. Mathematical Freedom: If the user asks for standard mathematical formulas, derivations, or foundational theory that is missing from the CONTEXT, you MAY provide them from your general knowledge.
                        3. Depth & Length: Provide comprehensive explanations step-by-step.

                        STRICT FORMATTING RULES (CRITICAL):
                        - You MUST use double blank lines (two Enters) before and after ALL headings (###), horizontal rules (---), tables, and lists. Never squash them together.
                        - For inline math, use a single $ sign (e.g., $x = 2$).
                        - For block math, you MUST put the equation on its own new line, wrapped in $$ (e.g., $$\n y = mx + c \n$$).
                        - NEVER use \[ , \] , \( , \) or \boxed{{}}.
                        - If using aligned math, you MUST write exactly \\begin{{aligned}} and \\end{{aligned}} and wrap the whole block in $$.
                        - Do NOT squash words together when using bold text. Ensure there is a space outside the asterisks.

                        CONTEXT:
                        {full_context}"""

        # Step E: Send the prompt to a massive 120-billion parameter model on Ollama Cloud
        response = ollama_client.chat(
            model="gpt-oss:120b-cloud",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ],
            options={
                "temperature": 0,
            }
        )


        # Step F. Format the sources to include the required metadata for the frontend
        retrieved_metadatas = results["metadatas"][0]
        retrieved_distances = results["distances"][0]
        retrieved_documents = results["documents"][0]
        
        sources = []
        for metadata, document, distance in zip(retrieved_metadatas, retrieved_documents, retrieved_distances):
            sources.append({
                "title": metadata.get("title", "Unknown Title"),
                "category": metadata.get("category", "Unknown Category"),
                "document": document,
                "distance": round(distance, 4)
            })

       # Step G. Return the new payload (safe access for ollama.chat)
        if isinstance(response, dict):
            answer_text = response.get('message', {}).get('content', '') or response.get('response', '')
        else:
            # If using newer Ollama SDK object models
            answer_text = getattr(getattr(response, 'message', None), 'content', '') or getattr(response, 'response', '')

        return {
            "answer": answer_text,
            "citations": sources
        }
        
        
    except Exception as e:
        # If anything fails, safely send the error back to the frontend
        raise HTTPException(status_code=500, detail=str(e))