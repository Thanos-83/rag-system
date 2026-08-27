import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

# 3. Load the local Embedding Model (This may take some time on startup)
embedding_model = SentenceTransformer("BAAI/bge-base-en-v1.5")

# 4. Connect to Chroma Cloud Database and get the Chroma Collection
chroma_client = chromadb.CloudClient(
    tenant=os.getenv("CHROMA_TENANT_ID"),
    database=os.getenv("CHROMA_DATABASE"),
    api_key=os.getenv("CHROMA_API_KEY")
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


# 7. Define the API Endpoint that the Frontend will request.
@app.post("/api/chat")
async def chat_endpoint(request: SearchQuery):
    user_query = request.query
    
    try:
        # Step A: Convert the user's text/query into a 768-dimensional vector and generate the Embedding
        full_query = "Represent this sentence for searching relevant passages: " + user_query
        query_vector = embedding_model.encode([full_query]).tolist()
        
        # Step B: Search Chroma Cloud for the top 3 most relevant papers
        results = collection.query(
            query_embeddings=query_vector,
            n_results=3,
            # where={"category": "Machine Learning (Statistics)"} 
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
        system_prompt = f"""You are an expert academic research assistant in Machine Learning.

            INSTRUCTIONS:
            1. Primary Source: Base your answer on the provided CONTEXT. 
            2. Mathematical Freedom: If the user asks for standard mathematical formulas, derivations, or foundational theory that is missing from the CONTEXT, you MAY provide them from your general knowledge. Clearly separate the general mathematics from the paper summaries.
            3. Depth & Length: Provide comprehensive, multi-paragraph explanations. Break down complex concepts step-by-step.
            4. Formatting: Use Markdown heavily. Use bullet points for lists, bold text for key terms, and LaTeX formatting (using $ and $$) for all math equations.

            CONTEXT:
            {full_context}"""

        # Step E: Send the prompt to a massive 120-billion parameter model on Ollama Cloud
        response = ollama_client.chat(
            model="gpt-oss:120b-cloud",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ]
        )
        
        # Step F: Return the final text and the paper titles back to Next.js
        return {
            "answer": response['message']['content'],
            "sources": retrieved_titles,
            "ChromaDB result distances": results["distances"],
            "ChromaDB result metadatas": results["metadatas"],
        }
        
    except Exception as e:
        # If anything fails, safely send the error back to the frontend
        raise HTTPException(status_code=500, detail=str(e))