import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `你是一个工程造价数据结构化专家。你的任务是将归纳整理后的工程文档数据，映射为目标概算表结构（JSON）。\n请严格按照目标结构输出，字段缺失可填"无"或空字符串，不可捏造数据。\n只返回JSON，不要包含markdown标记或其他说明。值的语言为中文。`;

export async function POST(req: NextRequest) {
  try {
    const { task_id, files, summary } = await req.json();
    const apiKey = process.env.DEEPSEEK_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({ error: '未配置AI接口密钥' }, { status: 500 });
    }
    // 读取概算表结构模板
    const templatePath = path.join(process.cwd(), 'public/datatem/概算.json');
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

    // 组装 prompt
    const userPrompt = `请将以下"归纳整理内容"映射为"概算表结构"对应的JSON格式。\n\n归纳整理内容：\n${JSON.stringify(summary, null, 2)}\n\n概算表结构示例：\n${JSON.stringify(template, null, 2)}\n\n请只输出JSON。值的语言为中文。`;

    // 调用 deepseek
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
    let budget;
    try {
      budget = JSON.parse(content);
    } catch (e) {
      return NextResponse.json({ error: 'AI返回内容无法解析为JSON', raw: content }, { status: 500 });
    }
    // 可选：保存 budget.json
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
    await fs.ensureDir(uploadDir);
    await fs.writeJson(path.join(uploadDir, 'budget.json'), budget, { spaces: 2 });
    return NextResponse.json({ summary: budget });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '生成概算表失败' }, { status: 500 });
  }
} 