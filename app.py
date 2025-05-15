import os
import uuid
import threading
import time
from flask import Flask, request, render_template, send_file, redirect, url_for, flash, jsonify, Response, make_response
from werkzeug.utils import secure_filename
import json
from pdf_processor import ImageProcessor, DataRefiner
import fitz  # PyMuPDF for PDF page extraction
import queue
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv  # 新增
from openpyxl import Workbook
from config import Config
from utils.table_utils import extract_table_rows
from routes.table import bp_table
from routes.main import bp_main
from loguru import logger
from services.processing_service import ProcessingService

# 加载 .env 文件
load_dotenv()

UPLOAD_FOLDER = Config.UPLOAD_FOLDER
RESULTS_FOLDER = Config.RESULTS_FOLDER
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png'}

app = Flask(__name__)
app.secret_key = Config.SECRET_KEY
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['RESULTS_FOLDER'] = RESULTS_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

# 配置API密钥（从环境变量读取）
API_KEY = Config.API_KEY
DEEPSEEK_API_KEY = Config.DEEPSEEK_API_KEY

app.register_blueprint(bp_table)
app.register_blueprint(bp_main)

# 日志配置
logger.add("project.log", rotation="10 MB", retention="10 days", level="INFO")

# 全局异常处理
@app.errorhandler(404)
def not_found(e):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(e):
    logger.exception(e)
    return render_template('500.html'), 500

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/', methods=['GET'])
def index():
    return render_template('upload.html')

@app.route('/upload', methods=['POST'])
def upload():
    if 'files' not in request.files:
        flash('未选择文件')
        return redirect(request.url)
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        flash('未选择文件')
        return redirect(request.url)
    
    task_id = str(uuid.uuid4())
    task_upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], task_id)
    os.makedirs(task_upload_dir, exist_ok=True)
    
    uploaded_files = []
    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            save_path = os.path.join(task_upload_dir, filename)
            file.save(save_path)
            
            file_info = {
                'name': filename,
                'path': save_path,
                'type': 'pdf' if filename.lower().endswith('.pdf') else 'image'
            }
            
            if file_info['type'] == 'pdf':
                # Extract PDF previews
                doc = fitz.open(save_path)
                file_info['pages'] = []
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
                    img_data = pix.tobytes("jpeg")
                    import base64
                    preview = base64.b64encode(img_data).decode()
                    file_info['pages'].append({
                        'number': page_num + 1,
                        'preview': preview
                    })
                doc.close()
            else:
                # For images, create a preview
                from PIL import Image
                import io
                import base64
                img = Image.open(save_path)
                img.thumbnail((800, 800))
                buffer = io.BytesIO()
                img.save(buffer, format="JPEG")
                preview = base64.b64encode(buffer.getvalue()).decode()
                file_info['preview'] = preview
            
            uploaded_files.append(file_info)
    
    if not uploaded_files:
        flash('文件类型不支持')
        return redirect(request.url)
    
    return render_template('selection.html', task_id=task_id, files=uploaded_files)

@app.route('/process-selection', methods=['POST'])
def process_selection():
    task_id = request.form.get('task_id')
    selected_files = request.form.getlist('selected_files')
    selected_pages = request.form.getlist('selected_pages')
    if not selected_files and not selected_pages:
        flash('请至少选择一个文件或页面')
        return redirect(url_for('index'))
    task_upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], task_id)
    # Start processing in background
    threading.Thread(target=ProcessingService.process_task, args=(
        task_id, selected_files, selected_pages, task_upload_dir,
        app.config['RESULTS_FOLDER'], API_KEY, DEEPSEEK_API_KEY
    ), daemon=True).start()
    return render_template('processing.html', task_id=task_id)

@app.route('/status/<task_id>')
def check_status(task_id):
    status_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_status.json')
    results_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_results.json')
    errors_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_errors.json')
    
    if not os.path.exists(status_path):
        return jsonify({'status': 'processing', 'total': 0})
    
    with open(status_path, 'r', encoding='utf-8') as f:
        status_data = json.load(f)
    
    # Add results and errors to response
    if os.path.exists(results_path):
        with open(results_path, 'r', encoding='utf-8') as f:
            status_data['results'] = json.load(f)
    
    if os.path.exists(errors_path):
        with open(errors_path, 'r', encoding='utf-8') as f:
            status_data['errors'] = json.load(f)
    
    return jsonify(status_data)

@app.route('/result/<task_id>')
def show_result(task_id):
    result_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_result.json')
    if not os.path.exists(result_path):
        flash('结果文件不存在')
        return redirect(url_for('index'))
    with open(result_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    return render_template(
        'result.html',
        json_data=json.dumps(json_data, ensure_ascii=False, indent=2),
        download_url=url_for('download_result', task_id=task_id)
    )

@app.route('/download/<task_id>')
def download_result(task_id):
    result_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_result.json')
    if not os.path.exists(result_path):
        flash('结果文件不存在')
        return redirect(url_for('index'))
    return send_file(result_path, as_attachment=True, download_name=f'{task_id}_result.json')

@app.route('/preview/<filename>')
def get_preview(filename):
    task_id = request.args.get('task_id')
    if not task_id:
        return "Task ID required", 400
        
    # 检查是否是PDF页面图片
    if filename.startswith('page_'):
        # 检查是否是压缩后的图片
        if '_compressed' in filename:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], task_id, 'compressed', filename)
        else:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], task_id, 'pdf_images', filename)
    else:
        # 检查是否是压缩后的图片
        if '_compressed' in filename:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], task_id, 'compressed', filename)
        else:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], task_id, filename)
        
    if not os.path.exists(file_path):
        # 如果找不到压缩后的图片，尝试使用原始图片
        original_filename = filename.replace('_compressed', '')
        if filename.startswith('page_'):
            original_path = os.path.join(app.config['UPLOAD_FOLDER'], task_id, 'pdf_images', original_filename)
        else:
            original_path = os.path.join(app.config['UPLOAD_FOLDER'], task_id, original_filename)
            
        if os.path.exists(original_path):
            file_path = original_path
        else:
            return "File not found", 404
        
    # 根据文件扩展名设置正确的MIME类型
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    mime_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif'
    }
    mimetype = mime_types.get(ext, 'image/jpeg')
    
    return send_file(file_path, mimetype=mimetype)

@app.route('/generate-table/<task_id>')
def generate_table(task_id):
    """调用 deepseek 整理 json 数据为概算表结构，返回表格数据"""
    result_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_result.json')
    if not os.path.exists(result_path):
        return jsonify({'status': 'error', 'message': '结果文件不存在'}), 404
    with open(result_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    # 读取概算表结构模板
    template_path = os.path.join('templates', 'datatemplates', '概算.json')
    with open(template_path, 'r', encoding='utf-8') as f:
        template_json = json.load(f)
    # 构造 prompt，要求 deepseek 严格参考模板结构
    refiner = DataRefiner(DEEPSEEK_API_KEY)
    prompt = (
        "你是一个工程造价数据整理专家。请根据下方的结构模板，结合用户给定的工程资料，整理出完整的工程项目概算表数据。"
        "\n\n【结构模板】如下（请严格按照此结构输出，字段缺失请用null或空数组）：\n"
        f"{json.dumps(template_json, ensure_ascii=False, indent=2)}"
        "\n\n【用户资料】如下："
    )
    user_content = json.dumps(json_data, ensure_ascii=False)
    response = refiner.client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_content}
        ],
        stream=False
    )
    content = response.choices[0].message.content.strip()
    content = content.replace("```json", "").replace("```", "").strip()
    try:
        table_data = json.loads(content)
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'AI返回内容无法解析为表格: {str(e)}', 'raw': content}), 500
    # 自动提取 subprojects[].items 合并为表格数组
    table_rows = extract_table_rows(table_data)
    # 缓存表格数据
    table_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_table.json')
    with open(table_path, 'w', encoding='utf-8') as f:
        json.dump(table_rows, f, ensure_ascii=False, indent=2)
    return jsonify({'status': 'ok', 'table': table_rows, 'raw': table_data})

@app.route('/download-table/<task_id>')
def download_table(task_id):
    """将概算表数据导出为 xlsx 文件并下载"""
    table_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_table.json')
    if not os.path.exists(table_path):
        return jsonify({'status': 'error', 'message': '请先生成概算表'}), 404
    with open(table_path, 'r', encoding='utf-8') as f:
        table_data = json.load(f)
    # 生成 xlsx
    wb = Workbook()
    ws = wb.active
    if table_data and isinstance(table_data, list):
        headers = list(table_data[0].keys())
        ws.append(headers)
        for row in table_data:
            ws.append([row.get(h, '') for h in headers])
    else:
        ws.append(["无数据"])
    from io import BytesIO
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    response = make_response(output.read())
    response.headers["Content-Disposition"] = f"attachment; filename={task_id}_table.xlsx"
    response.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return response

if __name__ == '__main__':
    app.run(debug=Config.DEBUG, port=Config.PORT) 