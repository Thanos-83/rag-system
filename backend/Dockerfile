# Use an official lightweight Python image
FROM python:3.10-slim

# 1. Create a new user with ID 1000
RUN useradd -m -u 1000 user

# 2. Switch to the new user
USER user

# 3. Add the user's local bin to the PATH so Python can find installed packages
ENV PATH="/home/user/.local/bin:$PATH"

# 4. Set the working directory
WORKDIR /app

# 5. Copy the requirements file and change ownership to 'user'
COPY --chown=user ./requirements.txt requirements.txt

# 6. Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 7. Copy the rest of the backend files and change ownership
COPY --chown=user . /app

# 8. Command to run the FastAPI server (Hugging Face expects port 7860)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860", "--loop", "asyncio"]
