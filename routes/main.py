from flask import Blueprint, render_template, request, redirect, url_for, flash, send_file, jsonify, session
import os
import uuid
import threading
import json
from werkzeug.utils import secure_filename
import fitz
from config import Config
from pdf_processor import ImageProcessor, DataRefiner
from services.processing_service import ProcessingService

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pdf', 'jpg', 'jpeg', 'png'}

bp_main = Blueprint('main', __name__)

@bp_main.route('/', methods=['GET'])
def index():
    return render_template('upload.html')

@bp_main.route('/upload', methods=['POST'])
def upload():
    if 'files' not in request.files:
        flash('未选择文件')
        return redirect(request.url)
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        flash('未选择文件')
        return redirect(request.url)
    task_id = str(uuid.uuid4())
    task_upload_dir = os.path.join(Config.UPLOAD_FOLDER, task_id)
    os.makedirs(task_upload_dir, exist_ok=True)
    meta_files = []
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
                doc = fitz.open(save_path)
                file_info['pages'] = []
                img_dir = os.path.join(task_upload_dir, 'pdf_images')
                os.makedirs(img_dir, exist_ok=True)
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
                    page_img_path = os.path.join(img_dir, f'page_{page_num+1}.png')
                    pix.save(page_img_path)
                    file_info['pages'].append({'number': page_num + 1})
                doc.close()
            meta_files.append(file_info)
    session['uploaded_files_' + task_id] = meta_files
    if not meta_files:
        flash('文件类型不支持')
        return redirect(request.url)
    return render_template('selection.html', task_id=task_id, files=meta_files)

@bp_main.route('/process-selection', methods=['POST'])
def process_selection():
    task_id = request.form.get('task_id')
    selected_files = request.form.getlist('selected_files')
    selected_pages = request.form.getlist('selected_pages')
    if not selected_files and not selected_pages:
        flash('请至少选择一个文件或页面')
        return redirect(url_for('main.index'))
    task_upload_dir = os.path.join(Config.UPLOAD_FOLDER, task_id)
    session['selected_files_' + task_id] = selected_files
    session['selected_pages_' + task_id] = selected_pages
    uploaded_files = session.get('uploaded_files_' + task_id, [])
    selected_info = []
    for file in uploaded_files:
        if file['type'] == 'pdf':
            selected_pages_for_file = [p for p in selected_pages if p.startswith(file['path'] + ':')]
            if selected_pages_for_file:
                pages = []
                for page_spec in selected_pages_for_file:
                    _, page_num = page_spec.split(':')
                    page_num = int(page_num)
                    pages.append({'number': page_num, 'path': file['path']})
                if pages:
                    selected_info.append({'name': file['name'], 'type': 'pdf', 'path': file['path'], 'pages': pages})
        elif file['type'] == 'image' and file['path'] in selected_files:
            selected_info.append({'name': file['name'], 'type': 'image', 'path': file['path']})
    threading.Thread(target=ProcessingService.process_task, args=(
        task_id, selected_files, selected_pages, task_upload_dir,
        Config.RESULTS_FOLDER, Config.API_KEY, Config.DEEPSEEK_API_KEY
    ), daemon=True).start()
    return render_template('processing.html', task_id=task_id, selected_info=selected_info)

@bp_main.route('/status/<task_id>')
def check_status(task_id):
    try:
        status_path = os.path.join(Config.RESULTS_FOLDER, f'{task_id}_status.json')
        results_path = os.path.join(Config.RESULTS_FOLDER, f'{task_id}_results.json')
        errors_path = os.path.join(Config.RESULTS_FOLDER, f'{task_id}_errors.json')
        if not os.path.exists(status_path):
            return jsonify({'status': 'processing', 'total': 0})
        with open(status_path, 'r', encoding='utf-8') as f:
            status_data = json.load(f)
        if os.path.exists(results_path):
            with open(results_path, 'r', encoding='utf-8') as f:
                status_data['results'] = json.load(f)
        if os.path.exists(errors_path):
            with open(errors_path, 'r', encoding='utf-8') as f:
                status_data['errors'] = json.load(f)
        return jsonify(status_data)
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({'status': 'error', 'message': str(e)}), 200

@bp_main.route('/result/<task_id>')
def show_result(task_id):
    result_path = os.path.join(Config.RESULTS_FOLDER, f'{task_id}_result.json')
    if not os.path.exists(result_path):
        flash('结果文件不存在')
        return redirect(url_for('main.index'))
    with open(result_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    return render_template(
        'result.html',
        json_data=json.dumps(json_data, ensure_ascii=False, indent=2),
        download_url=url_for('main.download_result', task_id=task_id)
    )

@bp_main.route('/download/<task_id>')
def download_result(task_id):
    result_path = os.path.join(Config.RESULTS_FOLDER, f'{task_id}_result.json')
    if not os.path.exists(result_path):
        flash('结果文件不存在')
        return redirect(url_for('main.index'))
    return send_file(result_path, as_attachment=True, download_name=f'{task_id}_result.json')

@bp_main.route('/preview/<filename>')
def get_preview(filename):
    task_id = request.args.get('task_id')
    if not task_id:
        return "Task ID required", 400
    if filename.startswith('page_'):
        if '_compressed' in filename:
            file_path = os.path.join(Config.UPLOAD_FOLDER, task_id, 'compressed', filename)
        else:
            file_path = os.path.join(Config.UPLOAD_FOLDER, task_id, 'pdf_images', filename)
    else:
        if '_compressed' in filename:
            file_path = os.path.join(Config.UPLOAD_FOLDER, task_id, 'compressed', filename)
        else:
            file_path = os.path.join(Config.UPLOAD_FOLDER, task_id, filename)
    if not os.path.exists(file_path):
        original_filename = filename.replace('_compressed', '')
        if filename.startswith('page_'):
            original_path = os.path.join(Config.UPLOAD_FOLDER, task_id, 'pdf_images', original_filename)
        else:
            original_path = os.path.join(Config.UPLOAD_FOLDER, task_id, original_filename)
        if os.path.exists(original_path):
            file_path = original_path
        else:
            return "File not found", 404
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    mime_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif'
    }
    mimetype = mime_types.get(ext, 'image/jpeg')
    return send_file(file_path, mimetype=mimetype) 