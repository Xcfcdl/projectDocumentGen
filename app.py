import os
import uuid
import threading
import time
from flask import Flask, request, render_template_string, send_file, redirect, url_for, flash, jsonify, Response
from werkzeug.utils import secure_filename
import json
from pdf_processor import ImageProcessor, DataRefiner
import fitz  # PyMuPDF for PDF page extraction
import queue
from concurrent.futures import ThreadPoolExecutor, as_completed

UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'web_results'
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png'}

app = Flask(__name__)
app.secret_key = 'supersecretkey'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['RESULTS_FOLDER'] = RESULTS_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

# 配置API密钥
API_KEY = "7c40f3f01a0dd4b736592fdfeb8483f4.sHFwn85aWlXPx3kv"
DEEPSEEK_API_KEY = "sk-d73a8621c4d749749daf1ec2208bcb90"

UPLOAD_PAGE = '''
<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <title>工程图纸结构化提取</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-8 col-lg-6">
      <div class="card shadow-sm">
        <div class="card-body">
          <h2 class="mb-4">上传PDF或图片（可多选）</h2>
          <form method=post enctype=multipart/form-data action="/upload" id="uploadForm">
            <div class="mb-3">
              <input class="form-control" type=file name=files multiple required accept=".pdf,.jpg,.jpeg,.png">
            </div>
            <button class="btn btn-primary w-100" type=submit id="submitBtn">上传并提取</button>
          </form>
          {% with messages = get_flashed_messages() %}
            {% if messages %}
              <div class="alert alert-danger mt-3">
              {% for message in messages %}
                <div>{{ message }}</div>
              {% endfor %}
              </div>
            {% endif %}
          {% endwith %}
        </div>
      </div>
    </div>
  </div>
</div>
<script>
  document.getElementById('uploadForm').onsubmit = function() {
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitBtn').innerText = '处理中...';
  };
</script>
</body>
</html>
'''

PROCESSING_PAGE = '''
<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <title>处理中...</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
      padding: 1rem;
    }
    .image-card {
      position: relative;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .image-container {
      position: relative;
      width: 100%;
      padding-top: 75%; /* 4:3 Aspect Ratio */
      background: #f8f9fa;
    }
    .image-container img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .processing-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: white;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .image-card.processing .processing-overlay {
      opacity: 1;
    }
    .result-textarea {
      width: 100%;
      height: 200px;
      margin-top: 0.5rem;
      font-size: 0.9em;
      resize: vertical;
    }
    .progress {
      height: 0.5rem;
      margin: 1rem 0;
    }
    .spinner-border {
      width: 2rem;
      height: 2rem;
      margin-bottom: 0.5rem;
    }
    .error-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      background: #dc3545;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8em;
    }
  </style>
</head>
<body class="bg-light">
<div class="container-fluid py-4">
  <div class="row justify-content-center">
    <div class="col-12">
      <div class="card shadow-sm">
        <div class="card-body">
          <h2 class="mb-4">正在提取结构化数据</h2>
          <div class="progress">
            <div class="progress-bar progress-bar-striped progress-bar-animated" 
                 role="progressbar" style="width: 0%" id="progressBar"></div>
          </div>
          <div class="image-grid" id="imageGrid"></div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
let totalItems = 0;
let processedItems = 0;
let lastProcessedCount = 0;
let pollInterval = 2000;
let maxPollInterval = 10000;
let pollTimeout = null;
let imageCards = new Map();

function updateProgress() {
  const progress = (processedItems / totalItems) * 100;
  document.getElementById('progressBar').style.width = progress + '%';
}

function createImageCard(filename, imageUrl) {
  const card = document.createElement('div');
  card.className = 'image-card processing';
  card.id = `card-${filename}`;
  
  card.innerHTML = `
    <div class="image-container">
      <img src="${imageUrl}?task_id={{ task_id }}" alt="${filename}">
      <div class="processing-overlay">
        <div class="spinner-border text-light" role="status"></div>
        <div>正在处理...</div>
      </div>
    </div>
    <div class="p-2">
      <div class="text-truncate mb-2">${filename}</div>
      <textarea class="form-control result-textarea" readonly></textarea>
    </div>
  `;
  
  return card;
}

function updateImageCard(filename, result) {
  const card = imageCards.get(filename);
  if (!card) return;
  
  card.classList.remove('processing');
  const textarea = card.querySelector('textarea');
  textarea.value = JSON.stringify(result, null, 2);
}

function showError(filename, error) {
  const card = imageCards.get(filename);
  if (!card) return;
  
  card.classList.remove('processing');
  const errorBadge = document.createElement('div');
  errorBadge.className = 'error-badge';
  errorBadge.textContent = '处理失败';
  card.querySelector('.image-container').appendChild(errorBadge);
  
  const textarea = card.querySelector('textarea');
  textarea.value = `错误: ${error}`;
  textarea.classList.add('text-danger');
}

function showCompleteButtons() {
  const container = document.createElement('div');
  container.className = 'text-center mt-4';
  container.innerHTML = `
    <a href="{{ url_for('show_result', task_id=task_id) }}" class="btn btn-success">查看完整结果</a>
    <a href="/" class="btn btn-link">返回首页</a>
  `;
  document.querySelector('.card-body').appendChild(container);
}

function pollStatus() {
  fetch("{{ url_for('check_status', task_id=task_id) }}")
    .then(response => response.json())
    .then(data => {
      if (data.status === 'error') {
        showError('处理过程', data.message);
        return;
      }

      if (data.status === 'done') {
        showCompleteButtons();
        return;
      }

      // Update progress
      if (data.total) {
        totalItems = data.total;
      }

      // Add new results
      if (data.results && data.results.length > 0) {
        data.results.forEach(result => {
          if (!imageCards.has(result.filename)) {
            // 创建新的图片卡片
            const card = createImageCard(result.filename, `/preview/${result.filename}`);
            document.getElementById('imageGrid').appendChild(card);
            imageCards.set(result.filename, card);
          }
          updateImageCard(result.filename, result.data);
        });
      }

      // Add new errors
      if (data.errors && data.errors.length > 0) {
        data.errors.forEach(error => {
          if (!imageCards.has(error.filename)) {
            const card = createImageCard(error.filename, `/preview/${error.filename}`);
            document.getElementById('imageGrid').appendChild(card);
            imageCards.set(error.filename, card);
          }
          showError(error.filename, error.message);
        });
      }

      // Adjust polling interval based on activity
      if (processedItems > lastProcessedCount) {
        pollInterval = 2000;
      } else {
        pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
      }
      lastProcessedCount = processedItems;

      // Schedule next poll
      pollTimeout = setTimeout(pollStatus, pollInterval);
    })
    .catch(error => {
      console.error('Polling error:', error);
      pollTimeout = setTimeout(pollStatus, pollInterval);
    });
}

// Start polling
pollStatus();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (pollTimeout) {
    clearTimeout(pollTimeout);
  }
});
</script>
</body>
</html>
'''

RESULT_PAGE = '''
<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <title>提取结果</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-10 col-lg-8">
      <div class="card shadow-sm">
        <div class="card-body">
          <h2 class="mb-4">结构化数据提取结果</h2>
          <pre style="background:#f8f8f8;padding:1em;max-height:400px;overflow:auto;">{{ json_data }}</pre>
          <a class="btn btn-success" href="{{ download_url }}">下载JSON文件</a>
          <a class="btn btn-link" href="/">返回首页</a>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>
'''

SELECTION_PAGE = '''
<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <title>选择要处理的页面</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .page-preview {
      max-width: 200px;
      margin: 10px;
      border: 1px solid #ddd;
      padding: 5px;
    }
    .page-preview.selected {
      border: 2px solid #0d6efd;
    }
    .page-preview img {
      width: 100%;
      height: auto;
    }
  </style>
</head>
<body class="bg-light">
<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-10">
      <div class="card shadow-sm">
        <div class="card-body">
          <h2 class="mb-4">选择要处理的页面</h2>
          <div class="mb-3">
            <button class="btn btn-outline-primary me-2" onclick="selectAll()">全选</button>
            <button class="btn btn-outline-primary" onclick="invertSelection()">反选</button>
          </div>
          <form method="post" action="/process-selection" id="selectionForm">
            <input type="hidden" name="task_id" value="{{ task_id }}">
            <div class="row" id="previewContainer">
              {% for file in files %}
                <div class="col-md-4 mb-3">
                  <div class="card">
                    <div class="card-header">
                      <div class="form-check">
                        <input class="form-check-input file-checkbox" type="checkbox" 
                               name="selected_files" value="{{ file.path }}" 
                               id="file_{{ loop.index }}" checked>
                        <label class="form-check-label" for="file_{{ loop.index }}">
                          {{ file.name }}
                        </label>
                      </div>
                    </div>
                    <div class="card-body">
                      {% if file.type == 'pdf' %}
                        {% for page in file.pages %}
                          <div class="page-preview">
                            <div class="form-check">
                              <input class="form-check-input page-checkbox" type="checkbox" 
                                     name="selected_pages" value="{{ file.path }}:{{ page.number }}" 
                                     id="page_{{ file.path }}_{{ page.number }}" checked>
                              <label class="form-check-label" for="page_{{ file.path }}_{{ page.number }}">
                                第 {{ page.number }} 页
                              </label>
                            </div>
                            <img src="data:image/jpeg;base64,{{ page.preview }}" alt="Page {{ page.number }}">
                          </div>
                        {% endfor %}
                      {% else %}
                        <div class="page-preview">
                          <img src="data:image/jpeg;base64,{{ file.preview }}" alt="{{ file.name }}">
                        </div>
                      {% endif %}
                    </div>
                  </div>
                </div>
              {% endfor %}
            </div>
            <div class="mt-3">
              <button type="submit" class="btn btn-primary">开始处理</button>
              <a href="/" class="btn btn-link">返回</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
function selectAll() {
  document.querySelectorAll('.page-checkbox, .file-checkbox').forEach(checkbox => {
    checkbox.checked = true;
  });
}

function invertSelection() {
  document.querySelectorAll('.page-checkbox, .file-checkbox').forEach(checkbox => {
    checkbox.checked = !checkbox.checked;
  });
}

document.querySelectorAll('.file-checkbox').forEach(checkbox => {
  checkbox.addEventListener('change', function() {
    const fileCard = this.closest('.card');
    fileCard.querySelectorAll('.page-checkbox').forEach(pageCheckbox => {
      pageCheckbox.checked = this.checked;
    });
  });
});
</script>
</body>
</html>
'''

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_single_image(processor, img_path):
    try:
        # 如果已经是压缩图，直接提取，否则先压缩
        if img_path.endswith('_compressed.jpg'):
            compressed_path = img_path
        else:
            compressed_path = processor.compress_image(img_path)
        # 只对压缩图做结构化提取
        result = processor.extract_engineering_data(compressed_path)
        if isinstance(result, str):
            try:
                result = json.loads(result)
            except json.JSONDecodeError:
                result = {"error": "Invalid JSON response"}
        # 只返回原图名和结果
        return os.path.basename(img_path), result
    except Exception as e:
        raise e

def process_task(task_id, selected_files, selected_pages, task_upload_dir):
    status_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_status.json')
    result_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_result.json')
    results_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_results.json')
    errors_path = os.path.join(app.config['RESULTS_FOLDER'], f'{task_id}_errors.json')
    
    try:
        # Initialize status and results files
        with open(status_path, 'w', encoding='utf-8') as f:
            json.dump({'status': 'processing', 'total': 0}, f)
        with open(results_path, 'w', encoding='utf-8') as f:
            json.dump([], f)
        with open(errors_path, 'w', encoding='utf-8') as f:
            json.dump([], f)
        
        processor = ImageProcessor(API_KEY)
        all_image_paths = []
        
        # Process selected files
        for file_path in selected_files:
            if file_path.lower().endswith('.pdf'):
                img_dir = os.path.join(task_upload_dir, 'pdf_images')
                os.makedirs(img_dir, exist_ok=True)
                all_image_paths.extend(processor.convert_pdf_to_images(file_path, img_dir))
            else:
                all_image_paths.append(file_path)
        
        # Process selected pages
        for page_spec in selected_pages:
            file_path, page_num = page_spec.split(':')
            page_num = int(page_num)
            if file_path.lower().endswith('.pdf'):
                img_dir = os.path.join(task_upload_dir, 'pdf_images')
                os.makedirs(img_dir, exist_ok=True)
                doc = fitz.open(file_path)
                page = doc[page_num - 1]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                page_image_path = os.path.join(img_dir, f'page_{page_num}.png')
                pix.save(page_image_path)
                doc.close()
                all_image_paths.append(page_image_path)
            else:
                all_image_paths.append(file_path)
        
        # Update total count
        with open(status_path, 'w', encoding='utf-8') as f:
            json.dump({'status': 'processing', 'total': len(all_image_paths)}, f)
        
        # Process images in parallel with max 5 workers
        all_results = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_path = {
                executor.submit(process_single_image, processor, img_path): img_path 
                for img_path in all_image_paths
            }
            for future in as_completed(future_to_path):
                img_path = future_to_path[future]
                try:
                    filename, result = future.result()
                    if result:
                        all_results.append(result)
                        with open(results_path, 'r+', encoding='utf-8') as f:
                            results = json.load(f)
                            results.append({
                                'filename': filename,
                                'data': result
                            })
                            f.seek(0)
                            json.dump(results, f, ensure_ascii=False)
                            f.truncate()
                except Exception as e:
                    with open(errors_path, 'r+', encoding='utf-8') as f:
                        errors = json.load(f)
                        errors.append({
                            'filename': os.path.basename(img_path),
                            'message': str(e)
                        })
                        f.seek(0)
                        json.dump(errors, f, ensure_ascii=False)
                        f.truncate()
        
        refiner = DataRefiner(DEEPSEEK_API_KEY)
        refined_data = refiner.refine_data([r for _, r in all_results])
        
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(refined_data, f, ensure_ascii=False, indent=2)
        
        with open(status_path, 'w', encoding='utf-8') as f:
            json.dump({'status': 'done'}, f)
            
    except Exception as e:
        with open(status_path, 'w', encoding='utf-8') as f:
            json.dump({'status': 'error', 'message': str(e)}, f)

@app.route('/', methods=['GET'])
def index():
    return render_template_string(UPLOAD_PAGE)

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
    
    return render_template_string(SELECTION_PAGE, task_id=task_id, files=uploaded_files)

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
    threading.Thread(target=process_task, args=(task_id, selected_files, selected_pages, task_upload_dir), daemon=True).start()
    return render_template_string(PROCESSING_PAGE, task_id=task_id)

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
    return render_template_string(
        RESULT_PAGE,
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

if __name__ == '__main__':
    app.run(debug=True, port=5000) 