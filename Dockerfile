# Use a lightweight Python image
FROM python:3.11-slim

# Set the working directory inside the Hugging Face server
WORKDIR /app

# Copy the backend folder from your Git repo into the server
COPY backend/ /app/

# Install your FastAPI and LLM dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Start the FastAPI server on port 7860 (Hugging Face's mandatory port)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]