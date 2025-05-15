import os
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pdf_processor import ImageProcessor, DataRefiner
import fitz

class ProcessingService:
    @staticmethod
    def process_single_image(processor, img_path):
        try:
            if img_path.endswith('_compressed.jpg'):
                compressed_path = img_path
            else:
                compressed_path = processor.compress_image(img_path)
            result = processor.extract_engineering_data(compressed_path)
            if isinstance(result, str):
                try:
                    result = json.loads(result)
                except json.JSONDecodeError:
                    result = {"error": "Invalid JSON response"}
            return os.path.basename(img_path), result
        except Exception as e:
            raise e

    @staticmethod
    def process_task(task_id, selected_files, selected_pages, task_upload_dir, results_folder, api_key, deepseek_api_key):
        status_path = os.path.join(results_folder, f'{task_id}_status.json')
        result_path = os.path.join(results_folder, f'{task_id}_result.json')
        results_path = os.path.join(results_folder, f'{task_id}_results.json')
        errors_path = os.path.join(results_folder, f'{task_id}_errors.json')
        try:
            with open(status_path, 'w', encoding='utf-8') as f:
                json.dump({'status': 'processing', 'total': 0}, f)
            with open(results_path, 'w', encoding='utf-8') as f:
                json.dump([], f)
            with open(errors_path, 'w', encoding='utf-8') as f:
                json.dump([], f)
            processor = ImageProcessor(api_key)
            all_image_paths = []
            for file_path in selected_files:
                if file_path.lower().endswith('.pdf'):
                    img_dir = os.path.join(task_upload_dir, 'pdf_images')
                    os.makedirs(img_dir, exist_ok=True)
                    all_image_paths.extend(processor.convert_pdf_to_images(file_path, img_dir))
                else:
                    all_image_paths.append(file_path)
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
            with open(status_path, 'w', encoding='utf-8') as f:
                json.dump({'status': 'processing', 'total': len(all_image_paths)}, f)
            all_results = []
            with ThreadPoolExecutor(max_workers=5) as executor:
                future_to_path = {
                    executor.submit(ProcessingService.process_single_image, processor, img_path): img_path 
                    for img_path in all_image_paths
                }
                for future in as_completed(future_to_path):
                    img_path = future_to_path[future]
                    try:
                        filename, result = future.result()
                        if result:
                            all_results.append((filename, result))
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
            refiner = DataRefiner(deepseek_api_key)
            refined_data = refiner.refine_data([r for _, r in all_results])
            with open(result_path, 'w', encoding='utf-8') as f:
                json.dump(refined_data, f, ensure_ascii=False, indent=2)
            with open(status_path, 'w', encoding='utf-8') as f:
                json.dump({'status': 'done'}, f)
        except Exception as e:
            with open(status_path, 'w', encoding='utf-8') as f:
                json.dump({'status': 'error', 'message': str(e)}, f) 