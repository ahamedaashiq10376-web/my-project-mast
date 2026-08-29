import os
import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Configure logger
logger = logging.getLogger("mastiguard.database")

# Environment variable for MongoDB URI (default to local mastiguard instance)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/mastiguard")
DB_NAME = "mastiguard"

_client = None

def get_mongo_client():
    global _client
    if _client is None:
        try:
            # 2 second timeout for server selection to prevent API hanging if DB is down
            _client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
            # Test ping
            _client.admin.command('ping')
            logger.info(f"Successfully connected to MongoDB at {MONGODB_URI}")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.warning(f"Could not connect to MongoDB at {MONGODB_URI}: {e}")
            _client = None
    return _client

def check_mongodb_connection() -> bool:
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=1500)
        client.admin.command('ping')
        return True
    except Exception as e:
        logger.warning(f"MongoDB ping failed: {e}")
        return False

def get_database():
    client = get_mongo_client()
    if client:
        return client[DB_NAME]
    return None

def get_predictions_collection():
    db = get_database()
    if db is not None:
        return db["predictions"]
    return None
