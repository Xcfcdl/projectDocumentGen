import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `你是一个专业的数据结构优化专家。你的任务是将工程图纸提取的原始数据重新组织成更清晰、更有逻辑的结构。\n请确保：\n1. 合并重复信息\n2. 统一数据格式\n3. 补充缺失的关联信息，但是信息必须真实，不可捏造，如果确实没有的数据则填入无\n4. 优化数据层级\n5. 确保所有数值都包含单位\n6. 将表格数据转换为标准格式\n\n重要：你必须直接返回JSON数据，不要包含任何markdown标记或其他说明文字。返回的数据必须是可以被直接解析的JSON格式。`;

export async function POST(req: NextRequest) {
  const { task_id, files } = await req.json();
  if (!task_id || !files || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: '缺少 task_id 或 files' }, { status: 400 });
  }
  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: '未配置AI接口密钥' }, { status: 500 });
  }
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  // 读取所有单页提取结果
  const rawResults = [];
  for (const filename of files) {
    const aiJsonPath = path.join(uploadDir, filename + '.ai.json');
    if (await fs.pathExists(aiJsonPath)) {
      const data = await fs.readJson(aiJsonPath);
      rawResults.push(data);
    }
  }
  if (rawResults.length === 0) {
    return NextResponse.json({ error: '未找到任何单页提取结果' }, { status: 404 });
  }
  // 调用 DeepSeek/ChatGPT 归纳整理
  const userPrompt = `请将以下工程图纸数据优化为结构化的JSON格式。直接返回JSON数据，不要包含任何markdown标记或其他说明文字：\n\n${JSON.stringify(rawResults, null, 2)}`;
  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000
    });
    let content = response.data.choices?.[0]?.message?.content?.trim() || '';
    content = content.replace(/```json|```/g, '').trim();
    let summary;
    try {
      summary = JSON.parse(content);
    } catch (e) {
      return NextResponse.json({ error: 'AI返回内容无法解析为JSON', raw: content }, { status: 500 });
    }
    await fs.writeJson(path.join(uploadDir, 'summary.json'), summary, { spaces: 2 });
    return NextResponse.json({ summary });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
} 