from flask import Blueprint, jsonify, make_response, current_app
import os
import json
from openpyxl import Workbook
from config import Config
from utils.table_utils import extract_table_rows
from pdf_processor import DataRefiner

bp_table = Blueprint('table', __name__)

@bp_table.route('/generate-table/<task_id>')
def generate_table(task_id):
    result_path = os.path.join(Config.RESULTS_FOLDER, f'{task_id}_result.json')
    if not os.path.exists(result_path):
        return jsonify({'status': 'error', 'message': '结果文件不存在'}), 404
    with open(result_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    template_path = os.path.join('templates', 'datatemplates', '概算.json')
    with open(template_path, 'r', encoding='utf-8') as f:
        template_json = json.load(f)
    refiner = DataRefiner(Config.DEEPSEEK_API_KEY)
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
    table_rows = extract_table_rows(table_data)
    table_path = os.path.join(Config.RESULTS_FOLDER, f'{task_id}_table.json')
    with open(table_path, 'w', encoding='utf-8') as f:
        json.dump(table_rows, f, ensure_ascii=False, indent=2)
    return jsonify({'status': 'ok', 'table': table_rows, 'raw': table_data})

@bp_table.route('/download-table/<task_id>')
def download_table(task_id):
    table_path = os.path.join(Config.RESULTS_FOLDER, f'{task_id}_table.json')
    if not os.path.exists(table_path):
        return jsonify({'status': 'error', 'message': '请先生成概算表'}), 404
    with open(table_path, 'r', encoding='utf-8') as f:
        table_data = json.load(f)
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