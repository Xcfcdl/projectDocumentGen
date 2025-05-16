import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import axios from 'axios';

export const dynamic = 'force-dynamic';

async function pdfToImages(pdfPath: string, outputDir: string): Promise<string[]> {
  const converter = fromPath(pdfPath, {
    density: 150,
    saveFilename: 'page',
    savePath: outputDir,
    format: 'jpg',
    width: 1200,
    height: 1600,
  });
  const totalPages = await (converter as any).info().then((info: any) => info.numpages);
  const imagePaths: string[] = [];
  for (let i = 1; i <= totalPages; i++) {
    const res = await converter(i);
    if (res.path) imagePaths.push(res.path);
  }
  return imagePaths;
}

async function compressImage(imagePath: string, maxSize = 5 * 1024 * 1024): Promise<string> {
  let quality = 90;
  let outputPath = imagePath.replace('.jpg', '_compressed.jpg');
  let buffer = await sharp(imagePath).jpeg({ quality }).toBuffer();
  while (buffer.length > maxSize && quality > 10) {
    quality -= 10;
    buffer = await sharp(imagePath).jpeg({ quality }).toBuffer();
  }
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

async function callAIAPI(imagePath: string, apiKey: string): Promise<any> {
  const imageData = await fs.readFile(imagePath);
  const base64Data = imageData.toString('base64');
  // 这里只做骨架，实际可参考 pdf_processor.py 的 payload
  const payload = {
    model: 'glm-4v-plus-0111',
    messages: [
      { role: 'system', content: `你是一个专业的工程图纸数据提取专家。你的任务是将工程图纸中的信息转换为结构化的JSON数据。请最大限度提取图纸上的所有信息，包括但不限于：

1. 项目基本信息：
   - 项目名称、图纸标题、图号、版本号、日期
   - 设计单位、审核人、客户名称
   - 项目地点、计量单位
   - 图纸比例、阶段、专业、用途

2. 工程信息：
   - 工程类型（如混凝土道路、钢结构、景观绿化等）
   - 材料规格（如混凝土标号、钢材型号、植物规格等）
   - 适用的标准或规范
   - 总说明或设计规定

3. 工程量信息：
   - 数量（如构件数量、设备数量等）
   - 长度（如道路长度、管道长度等）
   - 面积（如路面面积、墙体面积等）
   - 体积（如混凝土体积、土方量等）
   - 其他参数（如管径、梁尺寸等）

4. 空间分布信息：
   - 区域划分（如A区、首层、走廊等）
   - 各区域内的工程构件及其工程量
   - 跨区域构件的工程量分配

5. 图形元素信息：
   - 构件、符号、详图索引
   - 剖面、轴线、图例
   - 边界框、多边形坐标点

6. 其他信息：
   - 批注、说明、技术要求
   - 设计说明、施工说明
   - 结构关系（如构件归属、系统划分等）

数据关联规则：
1. 构件关联：
   - 每个构件必须关联到其所属区域
   - 每个构件必须关联到其工程量信息
   - 每个构件必须关联到其材料信息
   - 跨区域构件需要标注所有相关区域

2. 工程量关联：
   - 工程量必须关联到具体构件
   - 工程量必须包含完整的单位信息
   - 工程量必须关联到相应的计算依据
   - 跨专业工程量需要标注所有相关专业

3. 空间关系关联：
   - 区域必须包含其边界信息
   - 区域必须包含其包含的构件列表
   - 区域必须包含其工程量汇总
   - 区域必须标注其所属系统

错误处理规则：
1. 数据缺失处理：
   - 必填字段缺失时使用"无"或null
   - 可选字段缺失时使用空数组或null
   - 数值字段缺失时使用0或null
   - 单位缺失时使用"无单位"

2. 数据异常处理：
   - 数值异常时标注"数据异常"
   - 单位不一致时进行单位换算
   - 关联关系异常时标注"关联异常"
   - 空间关系异常时标注"空间关系异常"

3. 数据修复建议：
   - 提供可能的数据修复方案
   - 标注需要人工确认的数据
   - 提供数据验证建议
   - 标注数据质量评分

质量控制要求：
1. 数据完整性：
   - 检查必填字段是否完整
   - 检查关联关系是否完整
   - 检查单位信息是否完整
   - 检查计算依据是否完整

2. 数据准确性：
   - 验证数值计算是否准确
   - 验证单位换算是否准确
   - 验证关联关系是否准确
   - 验证空间关系是否准确

3. 数据一致性：
   - 检查命名是否一致
   - 检查单位表示是否一致
   - 检查数值格式是否一致
   - 检查关联关系是否一致

请按照以下JSON结构返回数据：
{
  "project_info": {
    "name": "项目名称",
    "title": "图纸标题",
    "drawing_number": "图号",
    "revision": "版本号",
    "date": "日期",
    "design_unit": "设计单位",
    "reviewer": "审核人",
    "client": "客户名称",
    "location": "项目地点",
    "units": "计量单位",
    "scale": "图纸比例",
    "phase": "阶段",
    "specialty": "专业",
    "purpose": "用途"
  },
  "engineering_info": {
    "type": "工程类型",
    "materials": [
      {
        "name": "材料名称",
        "specification": "规格型号",
        "standard": "执行标准"
      }
    ],
    "standards": ["标准1", "标准2"],
    "general_notes": ["说明1", "说明2"]
  },
  "quantities": {
    "counts": [
      {
        "item": "构件名称",
        "quantity": "数量",
        "unit": "单位",
        "related_components": ["关联构件1", "关联构件2"],
        "calculation_basis": "计算依据",
        "quality_score": 0.95,
        "validation_status": "已验证"
      }
    ],
    "lengths": [
      {
        "item": "构件名称",
        "length": "长度",
        "unit": "单位",
        "related_components": ["关联构件1", "关联构件2"],
        "calculation_basis": "计算依据",
        "quality_score": 0.95,
        "validation_status": "已验证"
      }
    ],
    "areas": [
      {
        "item": "构件名称",
        "area": "面积",
        "unit": "单位",
        "related_components": ["关联构件1", "关联构件2"],
        "calculation_basis": "计算依据",
        "quality_score": 0.95,
        "validation_status": "已验证"
      }
    ],
    "volumes": [
      {
        "item": "构件名称",
        "volume": "体积",
        "unit": "单位",
        "related_components": ["关联构件1", "关联构件2"],
        "calculation_basis": "计算依据",
        "quality_score": 0.95,
        "validation_status": "已验证"
      }
    ],
    "other_params": [
      {
        "item": "构件名称",
        "param": "参数值",
        "unit": "单位",
        "related_components": ["关联构件1", "关联构件2"],
        "calculation_basis": "计算依据",
        "quality_score": 0.95,
        "validation_status": "已验证"
      }
    ]
  },
  "spatial_distribution": {
    "zones": [
      {
        "name": "区域名称",
        "boundary": {
          "type": "边界类型",
          "coordinates": [[x1,y1], [x2,y2]]
        },
        "components": [
          {
            "name": "构件名称",
            "quantities": {
              "type": "工程量类型",
              "value": "数值",
              "unit": "单位",
              "quality_score": 0.95,
              "validation_status": "已验证"
            },
            "related_zones": ["关联区域1", "关联区域2"],
            "system_belonging": "所属系统"
          }
        ],
        "total_quantities": {
          "type": "工程量类型",
          "value": "数值",
          "unit": "单位",
          "quality_score": 0.95,
          "validation_status": "已验证"
        }
      }
    ]
  },
  "graphic_elements": {
    "components": ["构件1", "构件2"],
    "symbols": ["符号1", "符号2"],
    "details": ["详图1", "详图2"],
    "sections": ["剖面1", "剖面2"],
    "axes": ["轴线1", "轴线2"],
    "legends": ["图例1", "图例2"],
    "boundaries": [
      {
        "type": "边界类型",
        "coordinates": [[x1,y1], [x2,y2]],
        "quality_score": 0.95,
        "validation_status": "已验证"
      }
    ]
  },
  "other_info": {
    "annotations": ["批注1", "批注2"],
    "technical_requirements": ["要求1", "要求2"],
    "design_notes": ["说明1", "说明2"],
    "construction_notes": ["说明1", "说明2"],
    "structural_relationships": [
      {
        "component": "构件名称",
        "belongs_to": "所属系统",
        "relationships": ["关系1", "关系2"],
        "quality_score": 0.95,
        "validation_status": "已验证"
      }
    ]
  },
  "data_quality": {
    "overall_score": 0.95,
    "completeness_score": 0.95,
    "accuracy_score": 0.95,
    "consistency_score": 0.95,
    "validation_status": "已验证",
    "issues": [
      {
        "type": "问题类型",
        "description": "问题描述",
        "severity": "严重程度",
        "suggestion": "修复建议"
      }
    ]
  }
}

请确保：
1. 所有数值都包含单位
2. 保持数据的层级结构清晰
3. 表格数据转换为数组格式
4. 缺失信息使用null或空数组
5. 不捏造数据，保持真实性
6. 坐标点使用二维数组格式
7. 所有文本使用中文
8. 数值类型的数据不要加引号
9. 包含数据质量评分
10. 包含数据验证状态
11. 包含数据关联信息
12. 包含错误处理信息

直接返回JSON数据，不要包含任何markdown标记或其他说明文字。` },
      { role: 'user', content: [
        { type: 'text', text: '请将这张工程图纸转换为结构化的JSON数据。' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
      ]}
    ]
  };
  const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 120000
  });
  return response.data;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return NextResponse.json({ error: '未上传PDF文件' }, { status: 400 });
  }
  const apiKey = process.env.BIGMODEL_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: '未配置AI接口密钥' }, { status: 500 });
  }
  const task_id = uuidv4();
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  await fs.ensureDir(uploadDir);
  const pdfPath = path.join(uploadDir, file.name);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(pdfPath, Buffer.from(arrayBuffer));

  // 异步处理（可用队列/子进程优化）
  (async () => {
    try {
      const imagePaths = await pdfToImages(pdfPath, uploadDir);
      const results = [];
      for (const img of imagePaths) {
        const compressed = await compressImage(img);
        const aiResult = await callAIAPI(compressed, apiKey);
        results.push(aiResult);
      }
      await fs.writeJson(path.join(uploadDir, 'ai_result.json'), results, { spaces: 2 });
      await fs.writeJson(path.join(uploadDir, 'extract_status.json'), { status: 'done', total: imagePaths.length, finished: imagePaths.length }, { spaces: 2 });
    } catch (e) {
      await fs.writeJson(path.join(uploadDir, 'extract_status.json'), { status: 'error', error: String(e) }, { spaces: 2 });
    }
  })();

  await fs.writeJson(path.join(uploadDir, 'extract_status.json'), { status: 'processing', total: 0, finished: 0 }, { spaces: 2 });
  return NextResponse.json({ task_id });
} 