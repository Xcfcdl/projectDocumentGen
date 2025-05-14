import os
import json
from pathlib import Path
from typing import List, Dict, Any
from loguru import logger
from pdf2image import convert_from_path
from PIL import Image
import requests
from tqdm import tqdm
from pydantic import BaseModel
import base64
from openai import OpenAI

# 配置日志
logger.add("pdf_processing.log", rotation="500 MB")

class ImageProcessor:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def convert_pdf_to_images(self, pdf_path: str, output_dir: str) -> List[str]:
        """将PDF转换为图片"""
        logger.info(f"开始转换PDF: {pdf_path}")
        try:
            # 创建输出目录
            os.makedirs(output_dir, exist_ok=True)
            
            # 转换PDF为图片
            images = convert_from_path(pdf_path)
            image_paths = []
            
            for i, image in enumerate(images):
                image_path = os.path.join(output_dir, f"page_{i+1}.jpg")
                image.save(image_path, "JPEG", quality=85)
                image_paths.append(image_path)
            
            logger.info(f"PDF转换完成，共生成 {len(image_paths)} 张图片")
            return image_paths
        except Exception as e:
            logger.error(f"PDF转换失败: {str(e)}")
            raise

    def compress_image(self, image_path: str, max_size: int = 5 * 1024 * 1024) -> str:
        """压缩图片到指定大小"""
        logger.info(f"开始压缩图片: {image_path}")
        try:
            img = Image.open(image_path)
            quality = 95
            output_path = image_path.replace(".jpg", "_compressed.jpg")
            
            while True:
                img.save(output_path, "JPEG", quality=quality)
                if os.path.getsize(output_path) <= max_size or quality <= 10:
                    break
                quality -= 5
            
            logger.info(f"图片压缩完成: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"图片压缩失败: {str(e)}")
            raise

    def extract_engineering_data(self, image_path: str) -> Dict[str, Any]:
        """使用GLM-4V-Flash提取工程数据"""
        logger.info(f"开始提取图片数据: {image_path}")
        try:
            # 读取图片文件并转换为base64
            with open(image_path, 'rb') as f:
                image_data = f.read()
                base64_data = base64.b64encode(image_data).decode('utf-8')

            # 构建请求数据
            payload = {
                "model": "glm-4v-plus-0111",
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的工程图纸数据提取专家。你的任务是将工程图纸中的信息转换为结构化的JSON数据。请最大限度提取图纸上的所有信息，包括但不限于：\n\n"
                                       "1. 标题、编号、日期、设计单位、审核人、图名栏、图签、图例、比例、阶段、专业、用途、页码等\n"
                                       "2. 所有尺寸、数量、规格、标高、坐标、面积、体积、重量等，务必带单位\n"
                                       "3. 所有表格（如材料表、明细表、工程量表、图纸目录等），表头和每一行都要结构化\n"
                                       "4. 所有构件、符号、详图索引、剖面、轴线、图例、图框等图形元素及其属性\n"
                                       "5. 所有批注、说明、技术要求、设计说明、施工说明等\n"
                                       "6. 所有结构关系（如某尺寸属于哪个构件、某构件属于哪个系统/楼层/分区等）\n"
                                       "7. 任何其他有助于工程资料归档和复用的信息\n\n"
                                       "请严格按照如下JSON结构返回，字段缺失请用null或空数组，不要遗漏任何有用信息。"
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "请将这张工程图纸转换为结构化的JSON数据。请遵循以下规则：\n\n"
                                       "1. 提取所有可见的文本信息，包括标题、编号、标注、说明等\n"
                                       "2. 识别并提取所有数值信息，如尺寸、数量、规格等\n"
                                       "3. 识别并提取所有表格数据\n"
                                       "4. 识别并提取所有图形元素的关键信息\n\n"
                                       "5. 识别并提取图纸中的结构，元素，标识，数据\n"
                                       "6.识别图纸展示的意图和概况\n\n"
                                       "请按照以下JSON格式返回数据：\n"
                                       "{\n"
                                       "  \"document_info\": {\n"
                                       "    \"title\": \"图纸标题\",\n"
                                       "    \"drawing_number\": \"图纸编号\",\n"
                                       "    \"date\": \"日期\",\n"
                                       "    \"designer\": \"设计单位\",\n"
                                       "    \"checker\": \"审核人\",\n"
                                       "    \"organization\": \"组织单位\",\n"
                                       "    \"revision\": \"版本\",\n"
                                       "    \"sheet_number\": \"图纸编号\",\n"
                                       "    \"total_sheets\": \"总图纸数\"\n"
                                       "  },\n"
                                       "  \"project_info\": {\n"
                                       "    \"name\": \"项目名称\",\n"
                                       "    \"location\": \"项目地点\",\n"
                                       "    \"scale\": \"图纸比例\",\n"
                                       "    \"stage\": \"阶段\",\n"
                                       "    \"discipline\": \"专业\",\n"
                                       "    \"purpose\": \"用途\"\n"
                                       "  },\n"
                                       "  \"technical_specs\": {\n"
                                       "    \"dimensions\": [],\n"
                                       "    \"materials\": [],\n"
                                       "    \"requirements\": []\n"
                                       "  },\n"
                                       "  \"quantities\": {\n"
                                       "    \"items\": []\n"
                                       "  },\n"
                                       "  \"tables\": [],\n"
                                       "  \"notes\": [],\n"
                                       "  \"graphics\": [],\n"
                                       "  \"annotations\": [],\n"
                                       "  \"other_info\": {}\n"
                                       "}\n\n"
                                       "注意：\n"
                                       "1. 如果某些字段没有信息，请使用null或空数组\n"
                                       "2. 确保所有数值都包含单位\n"
                                       "3. 保持数据的层级结构清晰\n"
                                       "4. 如果发现表格，请将其转换为数组格式"
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_data}"
                                }
                            }
                        ]
                    }
                ]
            }

            # 发送API请求
            response = requests.post(self.api_url, headers=self.headers, json=payload)
            
            # 检查响应状态
            if response.status_code != 200:
                logger.error(f"API响应错误: {response.status_code}")
                logger.error(f"错误详情: {response.text}")
                response.raise_for_status()
            
            # 解析响应
            result = response.json()
            logger.info(f"数据提取成功: {image_path}")
            return result
        except Exception as e:
            logger.error(f"数据提取失败: {str(e)}")
            raise

class DataRefiner:
    def __init__(self, api_key: str):
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )

    def refine_data(self, raw_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """使用 DeepSeek API 优化数据结构"""
        logger.info("开始优化数据结构")
        try:
            # 构建提示词
            system_prompt = """你是一个专业的数据结构优化专家。你的任务是将工程图纸提取的原始数据重新组织成更清晰、更有逻辑的结构。
请确保：
1. 合并重复信息
2. 统一数据格式
3. 补充缺失的关联信息，但是信息必须真实，不可捏造，如果确实没有的数据则填入无
4. 优化数据层级
5. 确保所有数值都包含单位
6. 将表格数据转换为标准格式

重要：你必须直接返回JSON数据，不要包含任何markdown标记或其他说明文字。返回的数据必须是可以被直接解析的JSON格式。"""

            user_prompt = f"""请将以下工程图纸数据优化为结构化的JSON格式。直接返回JSON数据，不要包含任何markdown标记或其他说明文字：

{json.dumps(raw_data, ensure_ascii=False, indent=2)}"""

            # 调用 DeepSeek API
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                stream=False
            )

            # 获取响应内容
            content = response.choices[0].message.content.strip()
            
            # 清理可能的markdown标记
            content = content.replace("```json", "").replace("```", "").strip()
            
            # 尝试解析JSON
            try:
                refined_data = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"JSON解析失败: {str(e)}")
                logger.error(f"API返回内容: {content}")
                # 如果解析失败，返回原始数据
                return {
                    "status": "error",
                    "message": "数据优化失败，返回原始数据",
                    "raw_data": raw_data
                }

            logger.info("数据优化完成")
            return refined_data
        except Exception as e:
            logger.error(f"数据优化失败: {str(e)}")
            # 发生错误时返回原始数据
            return {
                "status": "error",
                "message": f"处理过程出错: {str(e)}",
                "raw_data": raw_data
            }

def main():
    # 配置参数
    API_KEY = "7c40f3f01a0dd4b736592fdfeb8483f4.sHFwn85aWlXPx3kv"
    DEEPSEEK_API_KEY = "sk-d73a8621c4d749749daf1ec2208bcb90"
    PDF_PATH = "/Users/Zhuanz/development/tools/projectDocumentGen/2025砥柱村道路硬化施工图.pdf"
    OUTPUT_DIR = "processed_images"
    RESULTS_DIR = "extracted_data"

    # 创建处理器实例
    processor = ImageProcessor(API_KEY)
    refiner = DataRefiner(DEEPSEEK_API_KEY)

    try:
        # 转换PDF为图片
        image_paths = processor.convert_pdf_to_images(PDF_PATH, OUTPUT_DIR)
        
        # 处理每张图片
        all_results = []
        for image_path in tqdm(image_paths, desc="处理图片"):
            # 压缩图片
            compressed_path = processor.compress_image(image_path)
            
            # 提取数据
            result = processor.extract_engineering_data(compressed_path)
            all_results.append(result)
            
            # 保存单页结果
            page_num = os.path.basename(image_path).split("_")[1].split(".")[0]
            result_path = os.path.join(RESULTS_DIR, f"page_{page_num}_data.json")
            os.makedirs(RESULTS_DIR, exist_ok=True)
            with open(result_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

        # 保存原始完整结果
        with open(os.path.join(RESULTS_DIR, "raw_complete_data.json"), "w", encoding="utf-8") as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)

        # 使用 DeepSeek 优化数据结构
        logger.info("开始优化数据结构")
        refined_data = refiner.refine_data(all_results)
        
        # 保存优化后的结果
        with open(os.path.join(RESULTS_DIR, "refined_data.json"), "w", encoding="utf-8") as f:
            json.dump(refined_data, f, ensure_ascii=False, indent=2)

        logger.info("所有处理完成")
    except Exception as e:
        logger.error(f"处理过程出错: {str(e)}")
        raise

if __name__ == "__main__":
    main() 