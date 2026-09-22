import sys
from unittest.mock import MagicMock
sys.modules['langchain_community.chat_models.vertexai'] = MagicMock()
sys.modules['langchain_community.llms.vertexai'] = MagicMock()

import os
from dotenv import load_dotenv
from datasets import Dataset

from langchain_ollama import ChatOllama
from langchain_huggingface import HuggingFaceEmbeddings

# NEW: Import metrics from the modern 'collections' path to remove the warning
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy

load_dotenv()

print("1. Preparing Test Dataset...")
# NEW SCHEMA: question -> user_input, contexts -> retrieved_contexts, answer -> response
data_samples = {
    "user_input": [
        "What is F-adjoint in deep learning?"
    ],
    "retrieved_contexts": [
        [
            "The F-adjoint is a concept introduced to provide a clearer description of the backpropagation algorithm in artificial neural networks. It is defined through a deep neural network architecture together with the notion of F-propagation."
        ]
    ],
    "response": [
        "The F-adjoint is a mathematical notion introduced to give a clearer description of the backpropagation algorithm. It is defined in conjunction with F-propagation, which represents the forward process."
    ]
}
eval_dataset = Dataset.from_dict(data_samples)


print("2. Initializing the LLM Judge (Ollama 120B)...")
base_llm = ChatOllama(
    model="gpt-oss:120b-cloud",
    base_url="https://ollama.com", 
    client_kwargs={"headers": {"Authorization": f"Bearer {os.getenv('OLLAMA_API_KEY')}"}},
    temperature=0.0
)
evaluator_llm = LangchainLLMWrapper(base_llm)


print("3. Initializing the Embedding Model (BAAI/bge-base-en-v1.5)...")
base_embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-base-en-v1.5"
)
evaluator_embeddings = LangchainEmbeddingsWrapper(base_embeddings)


print("4. Running Ragas Evaluation... (The LLM is grading the answer)")
results = evaluate(
    dataset=eval_dataset,
    metrics=[
        faithfulness,      
        answer_relevancy   
    ],
    llm=evaluator_llm,
    embeddings=evaluator_embeddings
)

print("\n=== RAGAS FINAL SCORECARD ===")
df = results.to_pandas()
# NEW: Tell Pandas to print the new column names!
print(df[['user_input', 'faithfulness', 'answer_relevancy']])