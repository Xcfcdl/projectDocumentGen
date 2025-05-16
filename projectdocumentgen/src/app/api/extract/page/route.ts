import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `你是一个专业的工程图纸数据提取专家。你的任务是将工程图纸中的信息转换为结构化的JSON数据。请最大限度提取图纸上的所有信息，包括但不限于：\n\n1. 标题、编号、日期、设计单位、审核人、图名栏、图签、图例、比例、阶段、专业、用途、页码等\n2. 所有尺寸、数量、规格、标高、坐标、面积、体积、重量等，务必带单位\n3. 所有表格（如材料表、明细表、工程量表、图纸目录等），表头和每一行都要结构化\n4. 所有构件、符号、详图索引、剖面、轴线、图例、图框等图形元素及其属性\n5. 所有批注、说明、技术要求、设计说明、施工说明等\n6. 所有结构关系（如某尺寸属于哪个构件、某构件属于哪个系统/楼层/分区等）\n7. 任何其他有助于工程资料归档和复用的信息\n\n请严格按照如下JSON结构返回，字段缺失请用null或空数组，不要遗漏任何有用信息。`;

const USER_PROMPT = `请将这张工程图纸转换为结构化的JSON数据。请遵循以下规则：\n\n1. 提取所有可见的文本信息，包括标题、编号、标注、说明等\n2. 识别并提取所有数值信息，如尺寸、数量、规格等\n3. 识别并提取所有表格数据\n4. 识别并提取所有图形元素的关键信息\n5. 识别并提取图纸中的结构，元素，标识，数据\n6.识别图纸展示的意图和概况\n\n请按照以下JSON格式返回数据：{...}`;

async function callAIAPI(imagePath: string, apiKey: string): Promise<any> {
  const imageData = await fs.readFile(imagePath);
  const base64Data = imageData.toString('base64');
  const payload = {
    model: 'glm-4v-plus-0111',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [
        { type: 'text', text: USER_PROMPT },
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
  const { task_id, filename } = await req.json();
  if (!task_id || !filename) {
    return NextResponse.json({ error: '缺少 task_id 或 filename' }, { status: 400 });
  }
  const apiKey = process.env.BIGMODEL_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: '未配置AI接口密钥' }, { status: 500 });
  }
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  const imagePath = path.join(uploadDir, filename);
  if (!(await fs.pathExists(imagePath))) {
    return NextResponse.json({ error: '图片不存在' }, { status: 404 });
  }
  try {
    const aiResult = await callAIAPI(imagePath, apiKey);
    // 可选：保存单页提取结果
    await fs.writeJson(path.join(uploadDir, filename + '.ai.json'), aiResult, { spaces: 2 });
    return NextResponse.json({ result: aiResult });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
} 