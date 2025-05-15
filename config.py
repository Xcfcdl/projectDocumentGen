import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'supersecretkey')
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    RESULTS_FOLDER = os.getenv('RESULTS_FOLDER', 'web_results')
    API_KEY = os.getenv('API_KEY')
    DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
    PORT = int(os.getenv('PORT', 5000))
    DEBUG = os.getenv('DEBUG', 'true').lower() == 'true' 